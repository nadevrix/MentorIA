import { TOOLS_BY_NAME, type ToolContext } from './tools/index.js';
import { daysAgo, round } from './tools/helpers.js';

/** Serie diaria de facturación, con los días sin ventas en cero. */
async function salesSeries(ctx: ToolContext, days: number) {
  const sales = await ctx.data.sales();
  const byDay = new Map<string, number>();
  for (const sale of sales) {
    const age = daysAgo(sale.date);
    if (age < 0 || age >= days) continue;
    const key = sale.date.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + sale.totalBob);
  }

  // Rellenar huecos: un gráfico de tendencia con días faltantes miente sobre la forma.
  const out: { fecha: string; totalBob: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ fecha: d, totalBob: round(byDay.get(d) ?? 0) });
  }
  return out;
}

/**
 * Serie del tipo de cambio. Un solo valor por punto desde la unificación;
 * `regimen` permite marcar el quiebre del 29/06/2026 en el gráfico.
 */
async function fxSeries(ctx: ToolContext, days: number) {
  const history = await ctx.fx.history();
  return history
    .filter((r) => daysAgo(r.date) < days)
    .map((r) => ({ fecha: r.date.slice(0, 10), tipoCambio: r.rate, regimen: r.regimen }));
}

/**
 * Snapshot para la pantalla principal.
 *
 * Deliberadamente NO usa el modelo: son las mismas herramientas de los agentes
 * ejecutadas de forma determinista. La pantalla carga instantánea y barata,
 * y el agente entra cuando hay que interpretar.
 */
export async function buildDashboard(ctx: ToolContext) {
  const run = async (name: string, input: unknown) => {
    const tool = TOOLS_BY_NAME.get(name);
    if (!tool) throw new Error(`Herramienta desconocida: ${name}`);
    return tool.run(tool.parse.parse(input) as never, ctx);
  };

  const [fx, margenes, ventas, inventario, finanzas, clientes, pagos, topProductos, serieVentas, serieFx] =
    await Promise.all([
      run('get_fx_rate', {}),
      run('analyze_margins', { soloEnRiesgo: true, limite: 5 }),
      run('sales_summary', { periodo: '30d' }),
      run('inventory_alerts', {}),
      run('financial_summary', { periodo: '30d' }),
      run('customer_insights', { diasInactividad: 30, limite: 5 }),
      run('accounts_payable', {}),
      run('top_products', { periodo: '30d', criterio: 'utilidad', limite: 6 }),
      salesSeries(ctx, 30),
      fxSeries(ctx, 90),
    ]);

  return {
    generadoEn: new Date().toISOString(),
    fx,
    margenes,
    ventas,
    inventario,
    finanzas,
    clientes,
    pagos,
    topProductos,
    series: { ventas: serieVentas, fx: serieFx },
  };
}
