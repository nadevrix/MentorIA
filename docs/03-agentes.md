# 03 — Agentes y herramientas

## Cómo agregar una herramienta

Una herramienta vive en `packages/core/src/tools/index.ts` y se define con `defineTool`:

```ts
const salesForecast = defineTool({
  name: 'sales_forecast',
  description:
    'Proyecta las ventas de los próximos N días usando la tendencia de los últimos 90. ' +
    'Usala cuando el usuario pregunte cuánto va a vender, si le alcanza para una compra, ' +
    'o quiera planificar reposición.',
  inputSchema: objectSchema({
    dias: { type: 'number', description: 'Horizonte de proyección. Por defecto 30.' },
  }),
  parse: z.object({ dias: z.number().int().positive().optional() }),
  async run(input, ctx) {
    const sales = await ctx.data.sales();
    // ...
    return { proyeccionBob: 0, metodo: 'promedio móvil 90 días' };
  },
});
```

Después:
1. Agregala al array `ALL_TOOLS`.
2. Agregá su `name` a la lista `tools` de los agentes que la necesiten (`agents/index.ts`).

Eso es todo — el runtime la expone y el modelo la descubre.

### Reglas para que el agente la use bien

| Regla | Por qué |
| ----- | ------- |
| La descripción dice **cuándo** llamarla, no solo qué hace | Es la palanca de mayor impacto sobre la tasa de invocación |
| Los nombres de campos van en español | Coherencia con el prompt y con la salida al usuario |
| Devolvé números ya redondeados | Evita que el modelo repita `47.30000000000001` |
| Devolvé contexto, no solo el número | `{ margenAlComprarPct, margenRealHoyPct }` le permite explicar la diferencia |
| Nunca lances si no hay datos: devolvé una lista vacía | Un throw corta el turno; una lista vacía deja que el agente lo explique |
| Agregá un campo `nota` cuando el cálculo tenga un supuesto | El agente lo transmite al usuario y evita conclusiones falsas |

## Cómo agregar un agente

En `packages/core/src/agents/index.ts`, agregá una entrada a `AGENTS`:

```ts
{
  id: 'marketing',
  name: 'Agente de Marketing',
  icon: '📣',
  tagline: 'Qué publicar y qué promocionar',
  tools: ['top_products', 'sales_summary', 'analyze_margins', 'customer_insights'],
  examples: ['¿Qué producto promociono esta semana?', 'Armame un posteo para Facebook'],
  systemPrompt: prompt(`
Sos el especialista en marketing.
- Nunca promociones un producto cuyo margen real esté bajo 15%: verificalo con analyze_margins.
- Cuando pidan un posteo, escribilo listo para publicar, con precio en Bs y llamada a la acción.
`),
}
```

El frontend lo levanta solo: `/api/agents` devuelve el catálogo y la UI dibuja la tarjeta.

### Criterios de diseño

- **Pocas herramientas por agente.** Menos opciones = mejores decisiones. Si un agente necesita las
  nueve, probablemente es el Director.
- **`prompt()` inyecta el contexto de país compartido.** Usalo siempre; no repitas las reglas de
  moneda o tipo de cambio en cada agente.
- **El prompt define criterio, no cálculos.** Si estás explicando una fórmula en el prompt, esa
  fórmula debería ser una herramienta.
- **Terminá el prompt con el formato de salida esperado.** Es lo que más mueve la calidad percibida.

## Catálogo actual

| Agente | ID | Herramientas |
| ------ | -- | ------------ |
| 🧭 Director de Negocio | `director` | fx, márgenes, ventas, inventario, clientes, finanzas, pagos |
| 💵 Cambiario y de Precios | `precios` | fx, márgenes, sugerir precio, inventario |
| 📦 Inventario | `inventario` | inventario, top productos, fx, ventas |
| 📊 Financiero | `finanzas` | finanzas, ventas, pagos, top productos, fx |
| 👥 Clientes | `clientes` | clientes, ventas, top productos |

## Herramientas disponibles

| Herramienta | Devuelve |
| ----------- | -------- |
| `get_fx_rate` | Oficial, paralelo, brecha, variación 30d, últimos 10 registros |
| `analyze_margins` | Margen al comprar vs. margen real de hoy, por producto; cuáles pierden plata |
| `suggest_price` | Precio sugerido para un margen objetivo, con escenario de dólar simulable |
| `sales_summary` | Total, cantidad, ticket promedio, por canal, variación vs. periodo anterior |
| `top_products` | Ranking por unidades, ingresos o utilidad estimada |
| `inventory_alerts` | Por agotarse, sin rotación, capital inmovilizado |
| `customer_insights` | Inactivos, mejores clientes, ticket promedio por cliente |
| `financial_summary` | Ingresos, CMV a reposición, gastos por categoría, utilidad y margen neto |
| `accounts_payable` | Pendientes, vencidas, próximas a vencer |

## Depuración

**El agente no llama la herramienta que debería.**
Reescribí la descripción empezando por el disparador: *"Usala cuando el usuario pregunte por…"*.
Si sigue sin llamarla, subí `effort` a `"high"` en `runtime.ts`.

**El agente inventa cifras.**
Casi siempre es una herramienta que devolvió vacío y el modelo rellenó. Verificá primero los datos;
después reforzá en el prompt del agente: *"Si una herramienta devuelve vacío, decilo."*

**El agente llama la misma herramienta muchas veces.**
Le falta algo en la respuesta y está reintentando. Agregá el campo que busca al retorno.

**Se agotan las 8 iteraciones.**
Suele ser un loop entre dos herramientas que se contradicen. Mirá la traza de `tool_use` en la UI.

**Probar una herramienta suelta, sin gastar tokens:**

```bash
node --input-type=module -e "
import { createContext, TOOLS_BY_NAME } from './packages/core/dist/index.js';
const ctx = createContext();
const t = TOOLS_BY_NAME.get('analyze_margins');
console.log(JSON.stringify(await t.run({ soloEnRiesgo: true }, ctx), null, 2));
"
```
