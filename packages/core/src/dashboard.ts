import { TOOLS_BY_NAME, type ToolContext } from './tools/index.js';

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

  const [fx, margenes, ventas, inventario, finanzas, clientes, pagos] = await Promise.all([
    run('get_fx_rate', {}),
    run('analyze_margins', { soloEnRiesgo: true, limite: 5 }),
    run('sales_summary', { periodo: '30d' }),
    run('inventory_alerts', {}),
    run('financial_summary', { periodo: '30d' }),
    run('customer_insights', { diasInactividad: 30, limite: 5 }),
    run('accounts_payable', {}),
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
  };
}
