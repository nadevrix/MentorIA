# 01 — Arquitectura

## Idea central

El agente no "sabe" nada del negocio. **Percibe** llamando herramientas, **decide** cuáles llamar y en
qué orden, **ejecuta** y devuelve un resultado accionable. Todo el conocimiento del negocio vive en las
herramientas; el prompt solo define el rol y el criterio.

Esto importa para el criterio de evaluación "uso significativo de IA": la diferencia entre un wrapper
y un agente es que acá el modelo **toma decisiones reales** sobre qué consultar.

## Diagrama

```
┌──────────────── Netlify ────────────────┐
│  apps/web  (React + Vite)               │
│    Panel (determinista)  ·  Chat (SSE)  │
└──────────────┬──────────────────────────┘
               │  HTTP + Server-Sent Events
┌──────────────▼──────── Render ──────────────────────────────┐
│  apps/api  (Hono)                                            │
│    /api/dashboard  → cálculo determinista, sin modelo        │
│    /api/chat       → loop de agente, streaming               │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼──── packages/core ───────────────────────────┐
│                                                              │
│   runtime.ts ──► LlmProvider ──► ¿pide herramienta?          │
│       ▲          (gemini │ claude)        │                  │
│       └──────── resultado ◄── tools/ ─────┘                  │
│                                 │                            │
│                    ┌────────────┴────────────┐               │
│                    ▼                         ▼               │
│              DataSource                 FxProvider           │
│         (seed hoy · Postgres/Odoo)   (estático · Firecrawl)  │
└──────────────────────────────────────────────────────────────┘
```

## Las cuatro capas

### 1. Fuentes (`data/`, `fx/`)

`DataSource` y `FxProvider` son **interfaces**. Todo el sistema habla con ellas y nunca con una base de
datos concreta. Hoy hay una implementación sobre JSON; cambiarla por Supabase u Odoo es escribir otra
clase que cumpla el contrato — sin tocar ni una herramienta ni un prompt.

```ts
interface DataSource {
  products(): Promise<Product[]>;
  sales(): Promise<Sale[]>;
  customers(): Promise<Customer[]>;
  expenses(): Promise<Expense[]>;
  fxHistory(): Promise<FxRate[]>;
}
```

### 2. Herramientas (`tools/`)

Cada herramienta es una función pura sobre la fuente de datos, con:

| Campo         | Para qué                                                          |
| ------------- | ----------------------------------------------------------------- |
| `name`        | Identificador que ve el modelo                                    |
| `description` | **Prescriptiva**: dice *cuándo* llamarla, no solo qué hace        |
| `inputSchema` | JSON Schema enviado a la API                                       |
| `parse`       | Esquema Zod: valida en runtime lo que devolvió el modelo          |
| `run`         | La lógica de negocio                                               |

La descripción prescriptiva es la palanca de calidad más barata: `"Llamá a esta herramienta SIEMPRE
antes de hablar de precios"` cambia el comportamiento más que tres párrafos en el prompt de sistema.

Herramientas actuales: `get_fx_rate`, `analyze_margins`, `suggest_price`, `sales_summary`,
`top_products`, `inventory_alerts`, `customer_insights`, `financial_summary`, `accounts_payable`,
`generate_whatsapp_message`.

### 3. Agentes (`agents/`)

Un agente es **rol + subconjunto de herramientas + prompt**. Nada más. Darle a cada agente solo sus
herramientas mejora la precisión: el Agente de Clientes no puede distraerse con el tipo de cambio.

Todos comparten un bloque de contexto de país (`SHARED_CONTEXT`) que fija las reglas no negociables:
moneda, la diferencia entre oficial y paralelo, y prohibición de inventar cifras.

### 4. Proveedor de modelo (`llm/`)

`runtime.ts` no habla con el SDK de ningún proveedor: habla con la interfaz `LlmProvider`.
Hay dos adaptadores — `gemini.ts` y `anthropic.ts` — y `createLlmProvider()` elige según
`LLM_PROVIDER`, con caída automática al otro si falta la clave del elegido.

Esto existe por una razón de demo, no de purismo: **si el proveedor falla o rate-limitea en
vivo, se cambia una variable de entorno y el producto sigue andando.**

Dos particularidades de la API de Gemini que están resueltas en el adaptador y conviene
conocer antes de tocarlo:

| Particularidad | Qué pasa si se ignora |
| --- | --- |
| Separa los eventos SSE con **CRLF** (`\r\n\r\n`), no con `\n\n` | El stream se parsea como un solo fragmento: el turno vuelve **vacío y sin error** |
| Los modelos 3.x devuelven un `thought_signature` por cada llamado a herramienta y exigen recibirlo de vuelta | Responden **400** y el loop no pasa del primer paso |

También traduce los JSON Schema de las herramientas al dialecto de Gemini (tipos en
mayúsculas, sin claves extra) y omite `parameters` cuando la herramienta no recibe nada,
porque una declaración con `parameters` vacío es rechazada.

### 5. Runtime (`runtime.ts`)

Loop manual de tool use, agnóstico del proveedor:

1. Enviar mensajes + herramientas al modelo (con streaming).
2. Emitir cada delta de texto como evento.
3. Si la respuesta trae bloques `tool_use`: ejecutarlos **todos en paralelo**, emitir los eventos, y
   devolver **todos** los `tool_result` en un solo mensaje de usuario.
4. Repetir hasta que el modelo deje de pedir herramientas (máx. 8 vueltas).

Detalles que importan:

- **Límite de iteraciones.** Un agente colgado en vivo arruina el pitch. A las 8 vueltas corta con error.
- **Errores de herramienta no rompen el loop.** Se devuelven con `is_error: true` y el modelo corrige.
- **Prompt caching** en el bloque de sistema: el prompt y las herramientas son idénticos entre turnos,
  así que a partir del segundo mensaje se pagan a ~10%.
- **Validación con Zod** de todo input del modelo antes de ejecutar.

## El panel no usa el modelo

`/api/dashboard` corre las mismas herramientas de forma determinista y devuelve JSON. Razones:

1. La pantalla principal carga en milisegundos, no en 15 segundos.
2. No gasta tokens en cada refresh.
3. Si la API de Claude falla en vivo, **el panel sigue funcionando** y el pitch tiene plan B.

El modelo entra cuando hay que interpretar y decidir, no para formatear números.

## Streaming (SSE)

`/api/chat` es POST, así que no se puede usar `EventSource`: el frontend consume el stream con
`fetch` + `ReadableStream` (`apps/web/src/lib/api.ts`). Cada evento del loop viaja como un SSE:

| Evento        | La UI hace                                    |
| ------------- | --------------------------------------------- |
| `start`       | Marca el agente como activo                   |
| `text`        | Va escribiendo la respuesta                   |
| `tool_use`    | Muestra "⏳ analyze_margins"                   |
| `tool_result` | Cambia a "✓ analyze_margins"                   |
| `done`        | Cierra el turno, guarda uso de tokens         |
| `error`       | Muestra el error sin romper la conversación   |

Mostrar las herramientas mientras corren es lo que hace visible que hay un agente detrás y no un
prompt. Vale puntos en la demo.

## Modelo, costo y cuota

Modelo por defecto: **`gemini-2.5-flash`**. La elección se midió corriendo el mismo prompt
contra cada modelo disponible y contando qué herramientas llamaba:

| Modelo | Herramientas | Tiempo | ¿Da los precios? |
| --- | --- | --- | --- |
| `gemini-3.1-flash-lite` | 2 | 3.9 s | ❌ |
| `gemini-2.5-flash-lite` | 2 | 12.1 s | ❌ |
| **`gemini-2.5-flash`** | **3** | 11-13 s | ✅ |
| `gemini-3-flash-preview` | 3 | 27.6 s | ✅ |
| Cualquier `pro` | — | — | ❌ sin cuota en free tier |

Los `flash-lite` detectan el problema y explican que hay productos en rojo, pero terminan el
turno sin llamar `suggest_price` — es decir, sin decir a cuánto subir. Para un producto cuyo
remate es el precio sugerido, eso no sirve.

⚠️ **Cuota: el free tier de Gemini permite ~5 requests por minuto**, y cada pregunta al agente
consume 3 o 4 (una por vuelta del loop). Sin facturación activada, la segunda pregunta seguida
falla con un 429. Antes del pitch: activar facturación en Google, o cambiar a
`LLM_PROVIDER=anthropic`.

`max_tokens` es 8000 por turno, para dejar espacio al razonamiento más la respuesta.

## Por qué Render y no Netlify Functions para la API

Una vuelta del loop con varias herramientas puede tomar 20–40 segundos. Las funciones síncronas de
Netlify cortan a los 10. Render free tier no tiene ese límite y soporta SSE largo. El costo es el
arranque en frío del free tier (~30 s): **hay que despertar la API antes del pitch** (ver
`docs/06-demo-pitch.md`).
