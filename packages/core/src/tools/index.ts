import { z } from 'zod';
import { PeriodSchema } from '../types.js';
import {
  daysAgo,
  marginPct,
  priceForMargin,
  replacementCostBob,
  round,
  salesInPeriod,
  withinPeriod,
} from './helpers.js';
import { defineTool, objectSchema, type ToolDefinition } from './registry.js';
import { simulateScenario } from '../simulate.js';

export * from './registry.js';
export * from './helpers.js';

const periodJson = {
  type: 'string',
  enum: ['hoy', '7d', '30d', '90d', 'todo'],
  description: 'Ventana de análisis. Por defecto 30d.',
};

// ---------------------------------------------------------------------------
// Tipo de cambio
// ---------------------------------------------------------------------------

const getFxRate = defineTool({
  name: 'get_fx_rate',
  description:
    'Devuelve el tipo de cambio vigente del BCB y su variación reciente. ' +
    'Llamá a esta herramienta SIEMPRE antes de hablar de costos, precios o márgenes de productos importados: ' +
    'desde la unificación de junio de 2026 hay un solo tipo de cambio y flota, así que el costo de ' +
    'reposición se mueve con él.',
  inputSchema: objectSchema({}),
  parse: z.object({}).passthrough(),
  async run(_input, ctx) {
    const history = await ctx.fx.history();
    const current = await ctx.fx.current();
    const monthAgo = history.find((r) => daysAgo(r.date) <= 30) ?? history[0];
    const change = monthAgo ? round(((current.rate - monthAgo.rate) / monthAgo.rate) * 100) : 0;

    // El tramo de régimen fijo no es comparable con el flexible: lo marcamos
    // para que el agente no lea una "subida" que en realidad es un cambio de régimen.
    const flexible = history.filter((r) => r.regimen === 'flexible');
    const desdeUnificacion =
      flexible.length >= 2
        ? round(((current.rate - flexible[0]!.rate) / flexible[0]!.rate) * 100)
        : null;

    return {
      fecha: current.date,
      tipoCambio: current.rate,
      regimen: current.regimen,
      variacion30dPct: change,
      unificacionDesde: flexible[0]?.date ?? null,
      variacionDesdeUnificacionPct: desdeUnificacion,
      fuente: current.source,
      historial: history.slice(-10).map((r) => ({ fecha: r.date, tipoCambio: r.rate })),
      nota:
        'Desde el 29/06/2026 el BCB unificó el régimen: hay un solo tipo de cambio y flota. ' +
        'Ya no existe la brecha oficial/paralelo.',
    };
  },
});

// ---------------------------------------------------------------------------
// Precios y márgenes — el núcleo del diferencial boliviano
// ---------------------------------------------------------------------------

const analyzeMargins = defineTool({
  name: 'analyze_margins',
  description:
    'Recalcula el margen REAL de cada producto usando el costo de reposición al tipo de cambio de hoy ' +
    '(los importados se revalúan con el dólar; los nacionales quedan al costo de su compra) ' +
    'y lo compara con el margen que tenía al comprar. ' +
    'Usala cuando el usuario pregunte si está ganando, qué producto conviene, o si debe subir precios. ' +
    'Devuelve los productos ordenados de peor a mejor margen.',
  inputSchema: objectSchema({
    soloEnRiesgo: {
      type: 'boolean',
      description: 'Si es true, devuelve solo los productos cuyo margen real cayó por debajo de margenMinimoPct.',
    },
    margenMinimoPct: {
      type: 'number',
      description: 'Umbral de margen saludable en porcentaje. Por defecto 20.',
    },
    limite: { type: 'number', description: 'Máximo de productos a devolver. Por defecto 20.' },
  }),
  parse: z.object({
    soloEnRiesgo: z.boolean().optional(),
    margenMinimoPct: z.number().optional(),
    limite: z.number().int().positive().optional(),
  }),
  async run(input, ctx) {
    const min = input.margenMinimoPct ?? 20;
    const limit = input.limite ?? 20;
    const [products, fx] = await Promise.all([ctx.data.products(), ctx.fx.current()]);

    const rows = products.map((p) => {
      const costoHoy = replacementCostBob(p, fx.rate);
      const costoCompra = round(p.costUsd * p.purchaseFxRate);
      const margenHoy = marginPct(p.priceBob, costoHoy);
      return {
        id: p.id,
        sku: p.sku,
        nombre: p.name,
        importado: p.imported,
        precioBob: p.priceBob,
        // El costo en dólares es lo único que permite recalcular el margen a otro tipo de
        // cambio. Sin él, un simulador tiene que estimarlo dividiendo el costo histórico por
        // el paralelo de hoy — y eso da un costo hasta 30% menor que el real.
        costUsd: p.costUsd,
        costoAlComprarBob: costoCompra,
        costoReposicionHoyBob: costoHoy,
        margenAlComprarPct: marginPct(p.priceBob, costoCompra),
        margenRealHoyPct: margenHoy,
        enRiesgo: margenHoy < min,
        pierdeDinero: p.priceBob < costoHoy,
        stock: p.stock,
      };
    });

    const filtered = input.soloEnRiesgo ? rows.filter((r) => r.enRiesgo) : rows;
    filtered.sort((a, b) => a.margenRealHoyPct - b.margenRealHoyPct);

    return {
      tipoCambioUsado: { tipoCambio: fx.rate, fecha: fx.date, regimen: fx.regimen },
      margenMinimoPct: min,
      totalProductos: rows.length,
      totalEnRiesgo: rows.filter((r) => r.enRiesgo).length,
      totalPerdiendoDinero: rows.filter((r) => r.pierdeDinero).length,
      productos: filtered.slice(0, limit),
    };
  },
});

const suggestPrice = defineTool({
  name: 'suggest_price',
  description:
    'Calcula el precio recomendado en Bs para uno o varios productos, dado un margen objetivo y ' +
    'opcionalmente un escenario de tipo de cambio ("¿y si el dólar sube a 15?"). ' +
    'Usala cuando el usuario pida actualizar precios, simular escenarios cambiarios o proteger su margen.',
  inputSchema: objectSchema(
    {
      productIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs o SKUs de productos. Si se omite, aplica a todos los productos en riesgo.',
      },
      margenObjetivoPct: {
        type: 'number',
        description: 'Margen deseado sobre el precio de venta, en porcentaje. Por defecto 35.',
      },
      tipoCambioSimulado: {
        type: 'number',
        description: 'Bs por USD a usar en la simulación. Si se omite, usa el tipo de cambio vigente.',
      },
    },
    ['margenObjetivoPct'],
  ),
  parse: z.object({
    productIds: z.array(z.string()).optional(),
    margenObjetivoPct: z.number(),
    tipoCambioSimulado: z.number().positive().optional(),
  }),
  async run(input, ctx) {
    const [products, fx] = await Promise.all([ctx.data.products(), ctx.fx.current()]);
    const rate = input.tipoCambioSimulado ?? fx.rate;

    const ids = new Set(input.productIds ?? []);
    const target = ids.size
      ? products.filter((p) => ids.has(p.id) || ids.has(p.sku))
      : products.filter((p) => marginPct(p.priceBob, replacementCostBob(p, fx.rate)) < 20);

    return {
      escenario: {
        tipoCambioUsado: rate,
        esSimulacion: input.tipoCambioSimulado !== undefined,
        tipoCambioActual: fx.rate,
      },
      margenObjetivoPct: input.margenObjetivoPct,
      recomendaciones: target.map((p) => {
        // Sólo los importados se revalúan con el escenario; los nacionales no.
        const costo = round(p.costUsd * (p.imported ? rate : p.purchaseFxRate));
        const sugerido = priceForMargin(costo, input.margenObjetivoPct);
        return {
          id: p.id,
          sku: p.sku,
          nombre: p.name,
          precioActualBob: p.priceBob,
          costoReposicionBob: costo,
          margenActualPct: marginPct(p.priceBob, costo),
          precioSugeridoBob: sugerido,
          ajustePct: round(((sugerido - p.priceBob) / p.priceBob) * 100),
          stockAfectado: p.stock,
        };
      }),
    };
  },
});

const simulateScenarioTool = defineTool({
  name: 'simulate_scenario',
  description:
    'Simula qué le pasa al negocio completo si el dólar llega a un valor dado: cuántos productos quedan ' +
    'bajo costo, cómo cae el margen promedio y la utilidad mensual, cuánto capital extra hace falta para ' +
    'reponer el inventario y qué aumento de precios se necesita. ' +
    'Usala para preguntas de escenario ("¿y si sube a 15?", "¿aguanto si el dólar se dispara?") o para ' +
    'decidir si conviene comprar mercadería por adelantado. Para ajustar precios producto por producto ' +
    'al tipo de cambio de HOY, usá suggest_price en su lugar.',
  inputSchema: objectSchema(
    {
      tipoCambioSimulado: {
        type: 'number',
        description: 'Bs por USD del escenario a evaluar. Ejemplo: 15.',
      },
      margenObjetivoPct: {
        type: 'number',
        description: 'Margen que el negocio quiere sostener, en porcentaje. Por defecto 35.',
      },
      limite: { type: 'number', description: 'Máximo de productos en el detalle. Por defecto 25.' },
    },
    ['tipoCambioSimulado'],
  ),
  parse: z.object({
    tipoCambioSimulado: z.number().positive(),
    margenObjetivoPct: z.number().optional(),
    limite: z.number().int().positive().optional(),
  }),
  async run(input, ctx) {
    return simulateScenario(ctx, input);
  },
});

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

const salesSummary = defineTool({
  name: 'sales_summary',
  description:
    'Resumen de ventas de un periodo: total facturado, número de ventas, ticket promedio, ' +
    'desglose por canal y comparación contra el periodo anterior equivalente. ' +
    'Usala para "¿cómo van mis ventas?", "¿cómo estuvo el mes?" o cualquier pregunta de desempeño comercial.',
  inputSchema: objectSchema({ periodo: periodJson }),
  parse: z.object({ periodo: PeriodSchema.optional() }),
  async run(input, ctx) {
    const period = input.periodo ?? '30d';
    const all = await ctx.data.sales();
    const current = salesInPeriod(all, period);

    const total = round(current.reduce((s, v) => s + v.totalBob, 0));
    const byChannel = new Map<string, number>();
    for (const sale of current) {
      byChannel.set(sale.channel, round((byChannel.get(sale.channel) ?? 0) + sale.totalBob));
    }

    // Periodo anterior equivalente: mismo tamaño de ventana, desplazado.
    const window = period === 'todo' ? Number.POSITIVE_INFINITY : { hoy: 1, '7d': 7, '30d': 30, '90d': 90 }[period];
    const previous = all.filter((s) => {
      const age = daysAgo(s.date);
      return age >= window && age < window * 2;
    });
    const previousTotal = round(previous.reduce((s, v) => s + v.totalBob, 0));

    return {
      periodo: period,
      totalBob: total,
      cantidadVentas: current.length,
      ticketPromedioBob: current.length ? round(total / current.length) : 0,
      porCanal: Object.fromEntries(byChannel),
      periodoAnteriorBob: previousTotal,
      variacionPct: previousTotal ? round(((total - previousTotal) / previousTotal) * 100) : null,
    };
  },
});

const topProducts = defineTool({
  name: 'top_products',
  description:
    'Ranking de productos por unidades vendidas, ingresos o utilidad estimada en un periodo. ' +
    'Usala para "¿qué producto me deja más?", "¿qué promociono?" o para priorizar reposición.',
  inputSchema: objectSchema({
    periodo: periodJson,
    criterio: {
      type: 'string',
      enum: ['unidades', 'ingresos', 'utilidad'],
      description: 'Criterio de ordenamiento. Por defecto utilidad.',
    },
    limite: { type: 'number', description: 'Cuántos devolver. Por defecto 10.' },
  }),
  parse: z.object({
    periodo: PeriodSchema.optional(),
    criterio: z.enum(['unidades', 'ingresos', 'utilidad']).optional(),
    limite: z.number().int().positive().optional(),
  }),
  async run(input, ctx) {
    const period = input.periodo ?? '30d';
    const criterio = input.criterio ?? 'utilidad';
    const [products, sales, fx] = await Promise.all([ctx.data.products(), ctx.data.sales(), ctx.fx.current()]);
    const byId = new Map(products.map((p) => [p.id, p]));

    const agg = new Map<string, { unidades: number; ingresos: number; utilidad: number }>();
    for (const sale of salesInPeriod(sales, period)) {
      for (const item of sale.items) {
        const product = byId.get(item.productId);
        if (!product) continue;
        const costo = replacementCostBob(product, fx.rate);
        const row = agg.get(item.productId) ?? { unidades: 0, ingresos: 0, utilidad: 0 };
        row.unidades += item.quantity;
        row.ingresos = round(row.ingresos + item.quantity * item.unitPriceBob);
        row.utilidad = round(row.utilidad + item.quantity * (item.unitPriceBob - costo));
        agg.set(item.productId, row);
      }
    }

    const rows = [...agg.entries()].map(([id, v]) => ({
      id,
      nombre: byId.get(id)?.name ?? id,
      unidades: v.unidades,
      ingresosBob: v.ingresos,
      utilidadEstimadaBob: v.utilidad,
      stockActual: byId.get(id)?.stock ?? 0,
    }));

    const key = criterio === 'unidades' ? 'unidades' : criterio === 'ingresos' ? 'ingresosBob' : 'utilidadEstimadaBob';
    rows.sort((a, b) => (b[key] as number) - (a[key] as number));

    return { periodo: period, criterio, productos: rows.slice(0, input.limite ?? 10) };
  },
});

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

const inventoryAlerts = defineTool({
  name: 'inventory_alerts',
  description:
    'Detecta productos por agotarse (stock bajo el punto de reorden), productos sin rotación ' +
    '(sin ventas en 60 días con stock inmovilizado) y el capital total inmovilizado en inventario. ' +
    'Usala para preguntas de stock, reposición o "¿qué compro?".',
  inputSchema: objectSchema({
    diasSinRotacion: { type: 'number', description: 'Umbral de días sin venta. Por defecto 60.' },
  }),
  parse: z.object({ diasSinRotacion: z.number().int().positive().optional() }),
  async run(input, ctx) {
    const stale = input.diasSinRotacion ?? 60;
    const [products, sales, fx] = await Promise.all([ctx.data.products(), ctx.data.sales(), ctx.fx.current()]);

    const lastSale = new Map<string, string>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const prev = lastSale.get(item.productId);
        if (!prev || sale.date > prev) lastSale.set(item.productId, sale.date);
      }
    }

    const porAgotarse = products
      .filter((p) => p.stock <= p.reorderPoint)
      .map((p) => ({
        id: p.id,
        nombre: p.name,
        stock: p.stock,
        puntoReorden: p.reorderPoint,
        costoReposicionUnitarioBob: replacementCostBob(p, fx.rate),
        importado: p.imported,
      }));

    const sinRotacion = products
      .filter((p) => {
        const last = lastSale.get(p.id);
        return p.stock > 0 && (!last || daysAgo(last) > stale);
      })
      .map((p) => ({
        id: p.id,
        nombre: p.name,
        stock: p.stock,
        diasSinVenta: lastSale.has(p.id) ? daysAgo(lastSale.get(p.id)!) : null,
        capitalInmovilizadoBob: round(p.stock * replacementCostBob(p, fx.rate)),
      }));

    const capitalTotal = round(
      products.reduce((s, p) => s + p.stock * replacementCostBob(p, fx.rate), 0),
    );

    return {
      capitalInmovilizadoTotalBob: capitalTotal,
      porAgotarse,
      sinRotacion,
      resumen: `${porAgotarse.length} productos por agotarse, ${sinRotacion.length} sin rotación en ${stale} días.`,
    };
  },
});

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

const marketingCandidates = defineTool({
  name: 'marketing_candidates',
  description:
    'Devuelve qué productos conviene promocionar y por qué, con los datos que sostienen la decisión: ' +
    'margen real, stock, rotación y capital inmovilizado. Clasifica cada uno en una razón ' +
    '("liquidar" para lo que no rota, "empujar" para lo que deja buen margen y hay stock, ' +
    '"estrella" para lo que ya se vende bien). ' +
    'Usala SIEMPRE antes de proponer una campaña, un post o una promoción: sin esto estarías ' +
    'inventando qué promocionar. Nunca recomiendes promocionar algo que no salga de acá.',
  inputSchema: objectSchema({
    limite: { type: 'number', description: 'Máximo de productos a devolver. Por defecto 6.' },
    diasSinRotacion: { type: 'number', description: 'Umbral de días sin venta. Por defecto 60.' },
  }),
  parse: z.object({
    limite: z.number().int().positive().optional(),
    diasSinRotacion: z.number().int().positive().optional(),
  }),
  async run(input, ctx) {
    const stale = input.diasSinRotacion ?? 60;
    const [products, sales, fx] = await Promise.all([
      ctx.data.products(),
      ctx.data.sales(),
      ctx.fx.current(),
    ]);

    const units = new Map<string, number>();
    const lastSale = new Map<string, string>();
    for (const sale of salesInPeriod(sales, '30d')) {
      for (const item of sale.items) {
        units.set(item.productId, (units.get(item.productId) ?? 0) + item.quantity);
      }
    }
    for (const sale of sales) {
      for (const item of sale.items) {
        const prev = lastSale.get(item.productId);
        if (!prev || sale.date > prev) lastSale.set(item.productId, sale.date);
      }
    }

    const rows = products.map((p) => {
      const costo = replacementCostBob(p, fx.rate);
      const margen = marginPct(p.priceBob, costo);
      const vendidas = units.get(p.id) ?? 0;
      const ultima = lastSale.get(p.id);
      const diasSinVender = ultima ? daysAgo(ultima) : null;
      const dormido = p.stock > 0 && (diasSinVender === null || diasSinVender > stale);

      // Un producto sin margen no se promociona: vender más de algo que pierde
      // plata sólo acelera la descapitalización.
      const razon = margen <= 0
        ? 'no_promocionar'
        : dormido
          ? 'liquidar'
          : vendidas >= 5 && margen >= 25
            ? 'estrella'
            : p.stock > 0 && margen >= 25
              ? 'empujar'
              : 'no_promocionar';

      return {
        id: p.id,
        sku: p.sku,
        nombre: p.name,
        categoria: p.category,
        razon,
        precioBob: p.priceBob,
        margenRealPct: margen,
        stock: p.stock,
        unidades30d: vendidas,
        diasSinVender,
        capitalInmovilizadoBob: dormido ? round(p.stock * costo) : 0,
        // Cuánto se puede descontar sin quedar bajo costo de reposición.
        descuentoMaximoPct: p.priceBob > 0 ? Math.max(0, round(((p.priceBob - costo) / p.priceBob) * 100)) : 0,
      };
    });

    const promocionables = rows.filter((r) => r.razon !== 'no_promocionar');
    const orden = { liquidar: 0, empujar: 1, estrella: 2 } as Record<string, number>;
    promocionables.sort(
      (a, b) => (orden[a.razon] ?? 9) - (orden[b.razon] ?? 9) || b.capitalInmovilizadoBob - a.capitalInmovilizadoBob,
    );

    return {
      tipoCambioUsado: fx.rate,
      totalProductos: rows.length,
      promocionables: promocionables.length,
      descartados: rows.length - promocionables.length,
      notaDescartados:
        'Los descartados no tienen margen suficiente: promocionarlos aceleraría la pérdida.',
      candidatos: promocionables.slice(0, input.limite ?? 6),
    };
  },
});

// ---------------------------------------------------------------------------
// Clientes (CRM)
// ---------------------------------------------------------------------------

const customerInsights = defineTool({
  name: 'customer_insights',
  description:
    'Devuelve clientes inactivos (sin comprar en N días), los de mayor valor acumulado y su segmento. ' +
    'Usala para "¿a quién contacto hoy?", campañas de recuperación o priorización comercial.',
  inputSchema: objectSchema({
    diasInactividad: { type: 'number', description: 'Días sin comprar para considerar inactivo. Por defecto 30.' },
    limite: { type: 'number', description: 'Máximo de clientes por lista. Por defecto 10.' },
  }),
  parse: z.object({
    diasInactividad: z.number().int().positive().optional(),
    limite: z.number().int().positive().optional(),
  }),
  async run(input, ctx) {
    const threshold = input.diasInactividad ?? 30;
    const limit = input.limite ?? 10;
    const customers = await ctx.data.customers();

    const enriched = customers.map((c) => ({
      id: c.id,
      nombre: c.name,
      telefono: c.phone ?? null,
      segmento: c.segment,
      diasSinComprar: daysAgo(c.lastPurchaseDate),
      totalGastadoBob: c.totalSpentBob,
      compras: c.purchaseCount,
      ticketPromedioBob: c.purchaseCount ? round(c.totalSpentBob / c.purchaseCount) : 0,
    }));

    return {
      diasInactividad: threshold,
      inactivos: enriched
        .filter((c) => c.diasSinComprar >= threshold)
        .sort((a, b) => b.totalGastadoBob - a.totalGastadoBob)
        .slice(0, limit),
      mejoresClientes: [...enriched].sort((a, b) => b.totalGastadoBob - a.totalGastadoBob).slice(0, limit),
      totalClientes: enriched.length,
    };
  },
});

// ---------------------------------------------------------------------------
// Finanzas y contabilidad
// ---------------------------------------------------------------------------

const financialSummary = defineTool({
  name: 'financial_summary',
  description:
    'Estado financiero del periodo: ingresos, costo de mercadería vendida (valuado a reposición de hoy), ' +
    'gastos operativos por categoría, utilidad estimada y margen neto. ' +
    'Usala para "¿estoy ganando dinero?", cierres de mes y reportes.',
  inputSchema: objectSchema({ periodo: periodJson }),
  parse: z.object({ periodo: PeriodSchema.optional() }),
  async run(input, ctx) {
    const period = input.periodo ?? '30d';
    const [products, sales, expenses, fx] = await Promise.all([
      ctx.data.products(),
      ctx.data.sales(),
      ctx.data.expenses(),
      ctx.fx.current(),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));

    const periodSales = salesInPeriod(sales, period);
    const ingresos = round(periodSales.reduce((s, v) => s + v.totalBob, 0));

    let cmv = 0;
    for (const sale of periodSales) {
      for (const item of sale.items) {
        const p = byId.get(item.productId);
        if (p) cmv += item.quantity * replacementCostBob(p, fx.rate);
      }
    }
    cmv = round(cmv);

    const periodExpenses = expenses.filter((e) => withinPeriod(e.date, period) && e.category !== 'mercaderia');
    const porCategoria: Record<string, number> = {};
    for (const e of periodExpenses) {
      porCategoria[e.category] = round((porCategoria[e.category] ?? 0) + e.amountBob);
    }
    const gastos = round(periodExpenses.reduce((s, e) => s + e.amountBob, 0));
    const utilidad = round(ingresos - cmv - gastos);

    return {
      periodo: period,
      ingresosBob: ingresos,
      costoMercaderiaVendidaBob: cmv,
      utilidadBrutaBob: round(ingresos - cmv),
      gastosOperativosBob: gastos,
      gastosPorCategoria: porCategoria,
      utilidadNetaBob: utilidad,
      margenNetoPct: ingresos ? round((utilidad / ingresos) * 100) : 0,
      nota: 'El CMV se valúa al costo de reposición de hoy, no al costo histórico: mide si el negocio puede reponer lo que vendió.',
    };
  },
});

const accountsPayable = defineTool({
  name: 'accounts_payable',
  description:
    'Lista las obligaciones pendientes de pago con su vencimiento, marcando las vencidas y las que vencen ' +
    'en los próximos días. Usala para "¿qué debo pagar?", control de flujo de caja y alertas diarias.',
  inputSchema: objectSchema({
    diasProximos: { type: 'number', description: 'Ventana de vencimientos próximos en días. Por defecto 7.' },
  }),
  parse: z.object({ diasProximos: z.number().int().positive().optional() }),
  async run(input, ctx) {
    const horizon = input.diasProximos ?? 7;
    const expenses = await ctx.data.expenses();
    const pending = expenses.filter((e) => !e.paid && e.dueDate);

    const rows = pending.map((e) => {
      const dias = -daysAgo(e.dueDate!); // negativo => ya venció
      return {
        id: e.id,
        descripcion: e.description,
        categoria: e.category,
        montoBob: e.amountBob,
        vencimiento: e.dueDate,
        diasParaVencer: dias,
        vencida: dias < 0,
      };
    });
    rows.sort((a, b) => a.diasParaVencer - b.diasParaVencer);

    return {
      totalPendienteBob: round(rows.reduce((s, r) => s + r.montoBob, 0)),
      vencidas: rows.filter((r) => r.vencida),
      proximas: rows.filter((r) => !r.vencida && r.diasParaVencer <= horizon),
      todas: rows,
    };
  },
});

// ---------------------------------------------------------------------------
// CRM y Comunicaciones (WhatsApp)
// ---------------------------------------------------------------------------

const generateWhatsAppMessage = defineTool({
  name: 'generate_whatsapp_message',
  description:
    'Genera un mensaje personalizado de WhatsApp listo para copiar o enviar a un cliente ' +
    '(reactivación de compras, cobranza de deuda o promoción). Usala cuando el usuario pida ' +
    'redactar un mensaje para un cliente, cobrarle o enviar una oferta.',
  inputSchema: objectSchema({
    clienteNombre: { type: 'string', description: 'Nombre del cliente destino.' },
    tipo: {
      type: 'string',
      enum: ['reactivacion', 'cobranza', 'promocion'],
      description: 'Tipo de mensaje a redactar.',
    },
    productoNombre: { type: 'string', description: 'Nombre del producto relacionado (opcional).' },
    montoPendienteBob: { type: 'number', description: 'Monto pendiente de pago en Bs (para cobranza).' },
  }),
  parse: z.object({
    clienteNombre: z.string(),
    tipo: z.enum(['reactivacion', 'cobranza', 'promocion']),
    productoNombre: z.string().optional(),
    montoPendienteBob: z.number().optional(),
  }),
  async run(input) {
    const name = input.clienteNombre.trim();
    let text = '';

    if (input.tipo === 'reactivacion') {
      text = `Hola ${name}! 👋 Te escribimos de la tienda. Hace unos días que no nos visitas y queríamos contarte que llegaron novedades que te van a encantar${input.productoNombre ? ` (especialmente en ${input.productoNombre})` : ''}. ¡Pásate por el local o respóndenos este mensaje para enviarte los detalles! 📦✨`;
    } else if (input.tipo === 'cobranza') {
      const montoStr = input.montoPendienteBob ? ` por Bs ${input.montoPendienteBob}` : '';
      text = `Estimado/a ${name}, le saludamos cordialmente. Le escribimos para recordarle el saldo pendiente${montoStr}. Agradecemos su confirmación de pago o que nos indique cuándo podrá realizar la transferencia. ¡Muchas gracias! 🙏`;
    } else {
      text = `¡Hola ${name}! 🔥 Queremos ofrecerte una oportunidad especial en ${input.productoNombre ?? 'nuestros productos de alta demanda'}. Mantén tu stock al mejor precio. ¡Escríbenos para coordinar tu pedido! 🚀`;
    }

    const encoded = encodeURIComponent(text);
    return {
      clienteNombre: name,
      tipo: input.tipo,
      mensajeTexto: text,
      linkWaMe: `https://wa.me/?text=${encoded}`,
      recomendacion: 'Copia el texto o usa el link wa.me para abrir WhatsApp directamente.',
    };
  },
});

// ---------------------------------------------------------------------------

export const ALL_TOOLS: ToolDefinition<never>[] = [
  getFxRate,
  analyzeMargins,
  suggestPrice,
  simulateScenarioTool,
  salesSummary,
  topProducts,
  inventoryAlerts,
  marketingCandidates,
  customerInsights,
  financialSummary,
  accountsPayable,
  generateWhatsAppMessage,
] as unknown as ToolDefinition<never>[];

export const TOOLS_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export function toolsFor(names: readonly string[]): ToolDefinition<never>[] {
  return names.flatMap((n) => {
    const tool = TOOLS_BY_NAME.get(n);
    if (!tool) throw new Error(`Herramienta desconocida: ${n}`);
    return [tool];
  });
}

