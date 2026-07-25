import type { FxRate, Product, Sale } from './types.js';
import { marginPct, priceForMargin, round, salesInPeriod } from './tools/helpers.js';
import type { ToolContext } from './tools/registry.js';

/**
 * Simulador de escenario cambiario.
 *
 * "¿Qué pasa si el dólar llega a 15?" es la pregunta que un importador
 * boliviano se hace todas las semanas y que ningún ERP le responde.
 * Acá se responde sobre el catálogo completo y en bolivianos: cuántos
 * productos quedan bajo costo, cuánto margen se pierde, cuánta utilidad
 * mensual se evapora y cuánto capital extra hace falta para reponer.
 *
 * Determinista y sin modelo, igual que el motor de hallazgos: el agente
 * interpreta el resultado, no lo calcula.
 */

export interface ScenarioProduct {
  id: string;
  sku: string;
  nombre: string;
  importado: boolean;
  precioActualBob: number;
  costoActualBob: number;
  costoEscenarioBob: number;
  margenActualPct: number;
  margenEscenarioPct: number;
  precioSugeridoBob: number;
  ajusteNecesarioPct: number;
  bajoCostoEnEscenario: boolean;
  unidades30d: number;
}

export interface ScenarioResult {
  escenario: {
    tipoCambioActual: number;
    tipoCambioSimulado: number;
    variacionPct: number;
    regimen: 'fijo' | 'flexible';
  };
  margenObjetivoPct: number;
  productosBajoCosto: { antes: number; despues: number };
  margenPromedioPct: { antes: number; despues: number };
  /** Utilidad mensual estimada al ritmo de venta de los últimos 30 días. */
  utilidadMensualBob: { antes: number; despues: number; delta: number };
  /** Bs adicionales para reponer el inventario actual al nuevo tipo de cambio. */
  capitalAdicionalBob: number;
  /** Aumento promedio de precios necesario para sostener el margen objetivo. */
  ajustePromedioNecesarioPct: number;
  productos: ScenarioProduct[];
}

/**
 * Costo de reposición a un tipo de cambio arbitrario.
 * Sólo los importados se revalúan: el costo en Bs de un nacional no depende del dólar.
 */
function costAt(p: Product, rate: number): number {
  return round(p.costUsd * (p.imported ? rate : p.purchaseFxRate));
}

function unitsSold30d(sales: Sale[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const sale of salesInPeriod(sales, '30d')) {
    for (const item of sale.items) {
      out.set(item.productId, (out.get(item.productId) ?? 0) + item.quantity);
    }
  }
  return out;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((s, v) => s + v, 0) / values.length);
}

export interface SimulateOptions {
  /** Bs por USD del escenario. */
  tipoCambioSimulado: number;
  /** Margen al que el negocio quiere sostener sus precios (%). Por defecto 35. */
  margenObjetivoPct?: number;
  /** Máximo de productos en el detalle. Por defecto 25, ordenados por urgencia. */
  limite?: number;
}

export async function simulateScenario(
  ctx: ToolContext,
  options: SimulateOptions,
): Promise<ScenarioResult> {
  const objetivo = options.margenObjetivoPct ?? 35;
  const limite = options.limite ?? 25;

  const [products, sales, fx]: [Product[], Sale[], FxRate] = await Promise.all([
    ctx.data.products(),
    ctx.data.sales(),
    ctx.fx.current(),
  ]);

  const rate = options.tipoCambioSimulado;
  const units = unitsSold30d(sales);

  const rows: ScenarioProduct[] = products.map((p) => {
    const costoActual = costAt(p, fx.rate);
    const costoEscenario = costAt(p, rate);
    const sugerido = priceForMargin(costoEscenario, objetivo);
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.name,
      importado: p.imported,
      precioActualBob: p.priceBob,
      costoActualBob: costoActual,
      costoEscenarioBob: costoEscenario,
      margenActualPct: marginPct(p.priceBob, costoActual),
      margenEscenarioPct: marginPct(p.priceBob, costoEscenario),
      precioSugeridoBob: sugerido,
      ajusteNecesarioPct: p.priceBob > 0 ? round(((sugerido - p.priceBob) / p.priceBob) * 100) : 0,
      bajoCostoEnEscenario: p.priceBob < costoEscenario,
      unidades30d: units.get(p.id) ?? 0,
    };
  });

  // Utilidad mensual = margen unitario × unidades vendidas en 30 días.
  const utilidadAntes = round(
    rows.reduce((s, r) => s + (r.precioActualBob - r.costoActualBob) * r.unidades30d, 0),
  );
  const utilidadDespues = round(
    rows.reduce((s, r) => s + (r.precioActualBob - r.costoEscenarioBob) * r.unidades30d, 0),
  );

  const capitalAdicional = round(
    products
      .filter((p) => p.imported)
      .reduce((s, p) => s + p.stock * p.costUsd * (rate - fx.rate), 0),
  );

  // Sólo los que necesitan subir cuentan en el promedio: los sanos no diluyen.
  const ajustes = rows.filter((r) => r.ajusteNecesarioPct > 0).map((r) => r.ajusteNecesarioPct);

  // El detalle prioriza lo que más duele: primero lo que queda bajo costo.
  const detalle = [...rows].sort(
    (a, b) => Number(b.bajoCostoEnEscenario) - Number(a.bajoCostoEnEscenario) || a.margenEscenarioPct - b.margenEscenarioPct,
  );

  return {
    escenario: {
      tipoCambioActual: fx.rate,
      tipoCambioSimulado: rate,
      variacionPct: fx.rate > 0 ? round(((rate - fx.rate) / fx.rate) * 100) : 0,
      regimen: fx.regimen,
    },
    margenObjetivoPct: objetivo,
    productosBajoCosto: {
      antes: rows.filter((r) => r.precioActualBob < r.costoActualBob).length,
      despues: rows.filter((r) => r.bajoCostoEnEscenario).length,
    },
    margenPromedioPct: {
      antes: average(rows.map((r) => r.margenActualPct)),
      despues: average(rows.map((r) => r.margenEscenarioPct)),
    },
    utilidadMensualBob: {
      antes: utilidadAntes,
      despues: utilidadDespues,
      delta: round(utilidadDespues - utilidadAntes),
    },
    capitalAdicionalBob: capitalAdicional,
    ajustePromedioNecesarioPct: average(ajustes),
    productos: detalle.slice(0, limite),
  };
}
