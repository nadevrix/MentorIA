import type { Customer, Expense, FxRate, Product, Sale } from './types.js';
import {
  daysAgo,
  marginPct,
  priceForMargin,
  replacementCostBob,
  round,
  salesInPeriod,
} from './tools/helpers.js';
import type { ToolContext } from './tools/registry.js';
import { buildTaxes, type Obligacion } from './taxes.js';

/**
 * Motor de hallazgos proactivos.
 *
 * Esta es la diferencia entre un chatbot y un director de negocio: el chatbot
 * espera la pregunta; esto detecta el problema antes de que el dueño lo note,
 * lo ordena por cuánta plata hay en juego y propone qué hacer.
 *
 * Deliberadamente SIN modelo. La detección es estadística y determinista:
 * corre en milisegundos, cuesta cero tokens y da el mismo resultado siempre.
 * El agente entra después, y sólo para interpretar y redactar — nunca para
 * calcular. Un número que el dueño ve acá siempre se puede reproducir.
 */

export type Severity = 'critica' | 'alta' | 'media' | 'baja';

const SEVERITY_RANK: Record<Severity, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

export interface Insight {
  /** Clave estable del hallazgo: mismo problema ⇒ misma clave entre corridas. */
  id: string;
  tipo: string;
  severidad: Severity;
  titulo: string;
  detalle: string;
  /** Bolivianos en juego. Es el criterio de orden: la plata manda. */
  impactoBob: number;
  /** Cómo se calculó el impacto, en una línea. La transparencia genera confianza. */
  impactoNota: string;
  /** Agente que puede profundizar en este hallazgo. */
  agenteId: string;
  /** Pregunta lista para mandar al chat de ese agente. */
  pregunta: string;
  /** Entidades involucradas, para que la UI pueda enlazar al detalle. */
  entidades?: { productos?: string[]; clientes?: string[] };
}

/** Umbrales del motor. Se exponen para poder ajustarlos por negocio. */
export interface InsightThresholds {
  /** Margen por debajo del cual un producto se considera erosionado (%). */
  margenMinimoPct: number;
  /** Margen al que aspira el negocio; base del precio sugerido (%). */
  margenObjetivoPct: number;
  /** Días sin venta para considerar capital dormido. */
  diasSinRotacion: number;
  /** Días sin comprar para considerar a un cliente en riesgo. */
  diasInactividadCliente: number;
  /** Caída de ventas contra el periodo anterior que dispara alerta (%). */
  caidaVentasPct: number;
  /** Movimiento del tipo de cambio en 30 días que dispara alerta (%). */
  fxDeltaPct: number;
}

export const DEFAULT_THRESHOLDS: InsightThresholds = {
  margenMinimoPct: 20,
  margenObjetivoPct: 35,
  diasSinRotacion: 60,
  diasInactividadCliente: 45,
  caidaVentasPct: 15,
  fxDeltaPct: 3,
};

/** Unidades vendidas por producto en los últimos N días. */
function unitsSold(sales: Sale[], days: 30 | 90): Map<string, number> {
  const period = days === 30 ? '30d' : '90d';
  const out = new Map<string, number>();
  for (const sale of salesInPeriod(sales, period)) {
    for (const item of sale.items) {
      out.set(item.productId, (out.get(item.productId) ?? 0) + item.quantity);
    }
  }
  return out;
}

/** Fecha de la última venta de cada producto. */
function lastSaleByProduct(sales: Sale[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const prev = out.get(item.productId);
      if (!prev || sale.date > prev) out.set(item.productId, sale.date);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detectores. Cada uno recibe el mundo y devuelve cero o más hallazgos.
// ---------------------------------------------------------------------------

interface World {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  fx: FxRate;
  fxHistory: FxRate[];
  impuestos: Obligacion[];
  t: InsightThresholds;
}

/**
 * El hallazgo que vende el producto: productos que se venden por debajo de lo
 * que cuesta reponerlos hoy. El negocio factura, parece sano, y se descapitaliza.
 */
function detectSellingBelowCost({ products, sales, fx, t }: World): Insight[] {
  const units = unitsSold(sales, 30);
  const afectados = products
    .map((p) => {
      const costo = replacementCostBob(p, fx.rate);
      return { p, costo, perdidaUnitaria: round(costo - p.priceBob), vendidas: units.get(p.id) ?? 0 };
    })
    .filter((r) => r.perdidaUnitaria > 0);

  if (afectados.length === 0) return [];

  // Sólo cuenta como pérdida lo que efectivamente se vende.
  const impacto = round(afectados.reduce((s, r) => s + r.perdidaUnitaria * r.vendidas, 0));
  const peor = [...afectados].sort((a, b) => b.perdidaUnitaria - a.perdidaUnitaria)[0]!;

  return [
    {
      id: `precio-bajo-costo:${afectados.length}`,
      tipo: 'precio_bajo_costo',
      severidad: 'critica',
      titulo: `${afectados.length} ${afectados.length === 1 ? 'producto se vende' : 'productos se venden'} por debajo del costo de reposición`,
      detalle:
        `Con el dólar a Bs ${fx.rate}, reponer estos productos cuesta más de lo que cobrás por ellos. ` +
        `El peor es ${peor.p.name}: lo vendés a Bs ${peor.p.priceBob} y reponerlo cuesta Bs ${peor.costo} ` +
        `(perdés Bs ${peor.perdidaUnitaria} por unidad). Cada venta te descapitaliza.`,
      impactoBob: impacto,
      impactoNota: 'Pérdida sobre las unidades realmente vendidas en los últimos 30 días.',
      agenteId: 'precios',
      pregunta: '¿Qué precios tengo que subir y a cuánto?',
      entidades: { productos: afectados.map((r) => r.p.id) },
    },
  ];
}

/** Productos que aún ganan, pero por debajo del piso saludable. */
function detectErodedMargin({ products, sales, fx, t }: World): Insight[] {
  const units = unitsSold(sales, 30);
  const afectados = products
    .map((p) => {
      const costo = replacementCostBob(p, fx.rate);
      return { p, costo, margen: marginPct(p.priceBob, costo), vendidas: units.get(p.id) ?? 0 };
    })
    .filter((r) => r.margen >= 0 && r.margen < t.margenMinimoPct && r.p.priceBob >= r.costo);

  if (afectados.length === 0) return [];

  // Lo que se deja de ganar por no estar en el margen objetivo.
  const impacto = round(
    afectados.reduce((s, r) => {
      const sugerido = priceForMargin(r.costo, t.margenObjetivoPct);
      return s + Math.max(0, sugerido - r.p.priceBob) * r.vendidas;
    }, 0),
  );

  return [
    {
      id: `margen-erosionado:${afectados.length}`,
      tipo: 'margen_erosionado',
      severidad: 'alta',
      titulo: `${afectados.length} ${afectados.length === 1 ? 'producto tiene' : 'productos tienen'} margen por debajo del ${t.margenMinimoPct}%`,
      detalle:
        `Todavía ganás con ellos, pero poco: el margen real quedó bajo el piso saludable porque el costo ` +
        `de reposición subió y el precio no. Ajustarlos al ${t.margenObjetivoPct}% recupera la diferencia.`,
      impactoBob: impacto,
      impactoNota: `Diferencia entre el precio actual y el necesario para un margen del ${t.margenObjetivoPct}%, sobre las ventas de 30 días.`,
      agenteId: 'precios',
      pregunta: `¿Qué productos tienen el margen más flojo y a cuánto debería dejarlos para llegar al ${t.margenObjetivoPct}%?`,
      entidades: { productos: afectados.map((r) => r.p.id) },
    },
  ];
}

/** Quiebre inminente de productos que sí rotan: la venta perdida más cara. */
function detectStockouts({ products, sales, fx }: World): Insight[] {
  const units = unitsSold(sales, 30);
  const enRiesgo = products
    .map((p) => {
      const demanda = units.get(p.id) ?? 0;
      const faltante = Math.max(0, demanda - p.stock);
      return { p, demanda, faltante };
    })
    // Sólo importa si el producto rota: quedarse sin algo que nadie compra no es problema.
    .filter((r) => r.demanda > 0 && r.p.stock <= r.p.reorderPoint);

  if (enRiesgo.length === 0) return [];

  const impacto = round(enRiesgo.reduce((s, r) => s + r.faltante * r.p.priceBob, 0));
  const urgente = [...enRiesgo].sort((a, b) => b.faltante * b.p.priceBob - a.faltante * a.p.priceBob)[0]!;

  return [
    {
      id: `stock-critico:${enRiesgo.length}`,
      tipo: 'stock_critico',
      severidad: impacto > 0 ? 'alta' : 'media',
      titulo: `${enRiesgo.length} ${enRiesgo.length === 1 ? 'producto que rota está' : 'productos que rotan están'} por agotarse`,
      detalle:
        `Están en o bajo su punto de reposición y se siguen vendiendo. El más urgente es ${urgente.p.name}: ` +
        `quedan ${urgente.p.stock} y en los últimos 30 días vendiste ${urgente.demanda}. ` +
        `Si el dólar viene subiendo, comprar hoy sale más barato que comprar en dos semanas.`,
      impactoBob: impacto,
      impactoNota: 'Venta que se pierde en los próximos 30 días si no se repone, al ritmo actual.',
      agenteId: 'inventario',
      pregunta: '¿Qué tengo que reponer y conviene comprar ahora o esperar?',
      entidades: { productos: enRiesgo.map((r) => r.p.id) },
    },
  ];
}

/** Capital que está durmiendo en el estante en vez de trabajar. */
function detectDeadStock({ products, sales, fx, t }: World): Insight[] {
  const last = lastSaleByProduct(sales);
  const dormidos = products
    .filter((p) => {
      const l = last.get(p.id);
      return p.stock > 0 && (!l || daysAgo(l) > t.diasSinRotacion);
    })
    .map((p) => ({ p, capital: round(p.stock * replacementCostBob(p, fx.rate)) }));

  if (dormidos.length === 0) return [];

  const capital = round(dormidos.reduce((s, r) => s + r.capital, 0));
  const total = round(
    products.reduce((s, p) => s + p.stock * replacementCostBob(p, fx.rate), 0),
  );
  const pct = total ? round((capital / total) * 100) : 0;

  return [
    {
      id: `capital-dormido:${dormidos.length}`,
      tipo: 'capital_dormido',
      severidad: pct >= 20 ? 'alta' : 'media',
      titulo: `Bs ${capital.toLocaleString('es-BO')} inmovilizados en ${dormidos.length} productos sin rotación`,
      detalle:
        `Son el ${pct}% de tu inventario y no se venden hace más de ${t.diasSinRotacion} días. ` +
        `Ese capital podría estar comprando lo que sí rota` +
        (pct >= 20 ? '. Conviene liquidar con descuento antes de que pierdan más valor.' : '.'),
      impactoBob: capital,
      impactoNota: 'Capital inmovilizado valuado al costo de reposición de hoy.',
      agenteId: 'inventario',
      pregunta: '¿Qué mercadería tengo dormida y cómo la liquido?',
      entidades: { productos: dormidos.map((r) => r.p.id) },
    },
  ];
}

/** Obligaciones vencidas y por vencer. */
function detectPayables({ expenses }: World): Insight[] {
  const pending = expenses.filter((e) => !e.paid && e.dueDate);
  const vencidas = pending.filter((e) => daysAgo(e.dueDate!) > 0);
  const proximas = pending.filter((e) => {
    const d = -daysAgo(e.dueDate!);
    return d >= 0 && d <= 7;
  });

  const out: Insight[] = [];

  if (vencidas.length) {
    const monto = round(vencidas.reduce((s, e) => s + e.amountBob, 0));
    out.push({
      id: `cuentas-vencidas:${vencidas.length}`,
      tipo: 'cuenta_vencida',
      severidad: 'critica',
      titulo: `${vencidas.length} ${vencidas.length === 1 ? 'cuenta vencida' : 'cuentas vencidas'} por Bs ${monto.toLocaleString('es-BO')}`,
      detalle:
        `Ya pasaron su fecha de vencimiento. La más atrasada lleva ${Math.max(...vencidas.map((e) => daysAgo(e.dueDate!)))} días. ` +
        `Quedar mal con un proveedor te sube el precio de la próxima compra.`,
      impactoBob: monto,
      impactoNota: 'Monto total vencido y sin pagar.',
      agenteId: 'finanzas',
      pregunta: '¿Qué pagos tengo vencidos y con qué cuento para cubrirlos?',
    });
  }

  if (proximas.length) {
    const monto = round(proximas.reduce((s, e) => s + e.amountBob, 0));
    out.push({
      id: `cuentas-proximas:${proximas.length}`,
      tipo: 'cuenta_por_vencer',
      severidad: 'media',
      titulo: `Bs ${monto.toLocaleString('es-BO')} por pagar esta semana`,
      detalle: `${proximas.length} ${proximas.length === 1 ? 'obligación vence' : 'obligaciones vencen'} en los próximos 7 días.`,
      impactoBob: monto,
      impactoNota: 'Monto que vence dentro de 7 días.',
      agenteId: 'finanzas',
      pregunta: '¿Tengo con qué cubrir los pagos de esta semana?',
    });
  }

  return out;
}

/**
 * Vencimientos con el SIN.
 *
 * Un impuesto vencido no es sólo el monto: son multas e intereses que crecen
 * todos los días, y una deuda tributaria bloquea trámites. Por eso lo vencido
 * va como crítico aunque el monto sea chico.
 */
function detectTaxes({ impuestos }: World): Insight[] {
  const vencidas = impuestos.filter((o) => o.estado === 'vencida' && o.montoBob > 0);
  const proximas = impuestos.filter((o) => o.estado === 'proxima' && o.montoBob > 0);
  const out: Insight[] = [];

  if (vencidas.length) {
    const monto = round(vencidas.reduce((s, o) => s + o.montoBob, 0));
    const peor = vencidas[0]!;
    out.push({
      id: `impuesto-vencido:${vencidas.map((o) => o.tipo).join('-')}`,
      tipo: 'impuesto_vencido',
      severidad: 'critica',
      titulo: `${vencidas.length} ${vencidas.length === 1 ? 'declaración vencida' : 'declaraciones vencidas'} por Bs ${monto.toLocaleString('es-BO')}`,
      detalle:
        `${peor.nombre} del periodo ${peor.periodo} venció hace ${Math.abs(peor.diasParaVencer)} días. ` +
        `Una deuda con el SIN suma multas e intereses todos los días y traba trámites. ` +
        `Es una estimación: confirmá el monto exacto con tu contador antes de pagar.`,
      impactoBob: monto,
      impactoNota: 'Suma estimada de las declaraciones que ya pasaron su vencimiento.',
      agenteId: 'finanzas',
      pregunta: '¿Qué impuestos tengo vencidos y con qué cuento para pagarlos?',
    });
  }

  if (proximas.length) {
    const monto = round(proximas.reduce((s, o) => s + o.montoBob, 0));
    const primera = proximas[0]!;
    out.push({
      id: `impuesto-proximo:${proximas.map((o) => o.tipo).join('-')}`,
      tipo: 'impuesto_proximo',
      severidad: 'alta',
      titulo: `Bs ${monto.toLocaleString('es-BO')} de impuestos vencen en ${primera.diasParaVencer} días`,
      detalle:
        `${proximas.map((o) => o.nombre).join(' y ')} del periodo ${primera.periodo}. ` +
        `Conviene tener ese monto reservado antes del ${primera.vencimiento}, ` +
        `porque sale de la caja el mismo mes en que hay que reponer mercadería.`,
      impactoBob: monto,
      impactoNota: 'Estimación de lo que vence en los próximos 10 días.',
      agenteId: 'finanzas',
      pregunta: '¿Me alcanza la caja para los impuestos que vencen esta semana?',
    });
  }

  return out;
}

/** Clientes valiosos que dejaron de comprar. */
function detectChurnRisk({ customers, t }: World): Insight[] {
  const inactivos = customers
    .filter((c) => c.purchaseCount >= 2 && daysAgo(c.lastPurchaseDate) >= t.diasInactividadCliente)
    .map((c) => ({ c, ticket: c.purchaseCount ? round(c.totalSpentBob / c.purchaseCount) : 0 }))
    .sort((a, b) => b.c.totalSpentBob - a.c.totalSpentBob);

  if (inactivos.length === 0) return [];

  // Valor recuperable conservador: una compra promedio por cliente.
  const impacto = round(inactivos.reduce((s, r) => s + r.ticket, 0));
  const top = inactivos[0]!;

  return [
    {
      id: `clientes-inactivos:${inactivos.length}`,
      tipo: 'cliente_en_riesgo',
      severidad: 'media',
      titulo: `${inactivos.length} ${inactivos.length === 1 ? 'cliente que ya te compraba no vuelve' : 'clientes que ya te compraban no vuelven'} hace ${t.diasInactividadCliente}+ días`,
      detalle:
        `El más valioso es ${top.c.name}, que gastó Bs ${top.c.totalSpentBob.toLocaleString('es-BO')} ` +
        `en ${top.c.purchaseCount} compras y lleva ${daysAgo(top.c.lastPurchaseDate)} días sin aparecer. ` +
        `Recuperar un cliente que ya te conoce cuesta mucho menos que conseguir uno nuevo.`,
      impactoBob: impacto,
      impactoNota: 'Una compra promedio por cliente inactivo, como valor recuperable conservador.',
      agenteId: 'clientes',
      pregunta: 'Armame un mensaje de WhatsApp para reactivar a mis clientes inactivos.',
      entidades: { clientes: inactivos.map((r) => r.c.id) },
    },
  ];
}

/** Caída de ventas contra el periodo anterior equivalente. */
function detectSalesDrop({ sales, t }: World): Insight[] {
  const actual = salesInPeriod(sales, '30d');
  const previo = sales.filter((s) => {
    const age = daysAgo(s.date);
    return age >= 30 && age < 60;
  });

  const totalActual = round(actual.reduce((s, v) => s + v.totalBob, 0));
  const totalPrevio = round(previo.reduce((s, v) => s + v.totalBob, 0));
  if (totalPrevio <= 0) return [];

  const variacion = round(((totalActual - totalPrevio) / totalPrevio) * 100);
  if (variacion > -t.caidaVentasPct) return [];

  return [
    {
      id: 'caida-ventas:30d',
      tipo: 'caida_ventas',
      severidad: 'alta',
      titulo: `Las ventas cayeron ${Math.abs(variacion)}% contra el mes anterior`,
      detalle:
        `Facturaste Bs ${totalActual.toLocaleString('es-BO')} en los últimos 30 días, contra ` +
        `Bs ${totalPrevio.toLocaleString('es-BO')} en los 30 anteriores. Vale la pena mirar si es un ` +
        `producto puntual, un cliente que dejó de comprar o un quiebre de stock.`,
      impactoBob: round(totalPrevio - totalActual),
      impactoNota: 'Diferencia de facturación contra el periodo anterior equivalente.',
      agenteId: 'director',
      pregunta: '¿Por qué cayeron mis ventas este mes?',
    },
  ];
}

/** Movimiento del tipo de cambio que obliga a revisar precios. */
function detectFxMove({ products, fx, fxHistory, t }: World): Insight[] {
  // Comparar contra el régimen fijo daría una "subida" que en realidad es el
  // cambio de régimen del 29/06/2026. Sólo se compara flexible contra flexible.
  const comparables = fxHistory.filter((r) => r.regimen === fx.regimen);
  const antes = comparables.find((r) => daysAgo(r.date) <= 30) ?? comparables[0];
  if (!antes || antes.rate <= 0 || antes.date === fx.date) return [];

  const delta = round(((fx.rate - antes.rate) / antes.rate) * 100);
  if (delta < t.fxDeltaPct) return [];

  const dias = daysAgo(antes.date);
  // Cuánto más caro es reponer el inventario importado que en aquel momento.
  const encarecimiento = round(
    products
      .filter((p) => p.imported)
      .reduce((s, p) => s + p.stock * p.costUsd * (fx.rate - antes.rate), 0),
  );

  return [
    {
      id: `fx-subio:${delta}`,
      tipo: 'dolar_subio',
      severidad: 'alta',
      titulo: `El dólar subió ${delta}% en ${dias} días`,
      detalle:
        `Pasó de Bs ${antes.rate} a Bs ${fx.rate}. Desde que el tipo de cambio flota, cada movimiento ` +
        `te encarece la reposición: reponer tu inventario importado cuesta hoy ` +
        `Bs ${encarecimiento.toLocaleString('es-BO')} más que entonces. Si no ajustaste precios en ese ` +
        `plazo, tu margen real ya no es el que muestra tu lista.`,
      impactoBob: encarecimiento,
      impactoNota: `Cuánto más caro es reponer el stock importado actual respecto de hace ${dias} días.`,
      agenteId: 'precios',
      pregunta: '¿Cómo me afectó la subida del dólar y qué precios ajusto?',
    },
  ];
}

const DETECTORS = [
  detectSellingBelowCost,
  detectTaxes,
  detectFxMove,
  detectPayables,
  detectSalesDrop,
  detectErodedMargin,
  detectStockouts,
  detectDeadStock,
  detectChurnRisk,
];

/**
 * Corre todos los detectores y devuelve los hallazgos ordenados por urgencia
 * y por plata en juego. Lo que más cuesta va primero, siempre.
 */
export async function buildInsights(
  ctx: ToolContext,
  overrides: Partial<InsightThresholds> = {},
): Promise<{ generadoEn: string; umbrales: InsightThresholds; totalImpactoBob: number; insights: Insight[] }> {
  const t = { ...DEFAULT_THRESHOLDS, ...overrides };
  const [products, sales, customers, expenses, fx, fxHistory, impuestos] = await Promise.all([
    ctx.data.products(),
    ctx.data.sales(),
    ctx.data.customers(),
    ctx.data.expenses(),
    ctx.fx.current(),
    ctx.fx.history(),
    // Con la configuración por defecto: el último dígito del NIT lo elige el
    // usuario en el apartado de impuestos, y ahí ve las fechas exactas.
    buildTaxes(ctx).then((t) => t.obligaciones),
  ]);

  const world: World = { products, sales, customers, expenses, fx, fxHistory, impuestos, t };
  const insights = DETECTORS.flatMap((detect) => detect(world));

  insights.sort(
    (a, b) => SEVERITY_RANK[a.severidad] - SEVERITY_RANK[b.severidad] || b.impactoBob - a.impactoBob,
  );

  return {
    generadoEn: new Date().toISOString(),
    umbrales: t,
    // Las cuentas por pagar no son pérdida, son calendario: no suman al total.
    totalImpactoBob: round(
      insights
        .filter(
          (i) =>
            i.tipo !== 'cuenta_vencida' &&
            i.tipo !== 'cuenta_por_vencer' &&
            i.tipo !== 'impuesto_vencido' &&
            i.tipo !== 'impuesto_proximo',
        )
        .reduce((s, i) => s + i.impactoBob, 0),
    ),
    insights,
  };
}
