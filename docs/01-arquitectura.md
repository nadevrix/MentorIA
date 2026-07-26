# 01 — Arquitectura

## Idea central

El agente no "sabe" nada del negocio. **Percibe** llamando herramientas, **decide** cuáles llamar y en
qué orden, **ejecuta** y devuelve un resultado accionable. Todo el conocimiento del negocio vive en las
herramientas; el prompt solo define el rol y el criterio.

Esto importa para el criterio de evaluación "uso significativo de IA": la diferencia entre un wrapper
y un agente es que acá el modelo **toma decisiones reales** sobre qué consultar.

## Diagrama

```
┌──────────── Render Static Site ─────────┐
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
│       (seed · Postgres · Odoo)   (local · API · Firecrawl)   │
└──────────────────────────────────────────────────────────────┘
```

El frontend migrará a Netlify cuando estén disponibles sus créditos; el resto del diagrama no cambia.

## Las cinco capas

### 1. Fuentes (`data/`, `fx/`)

`DataSource` y `FxProvider` son **interfaces**. Todo el sistema habla con ellas y nunca con una base de
datos concreta. Hay implementaciones sobre JSON y PostgreSQL; el tipo de cambio puede salir del
histórico local, de la API pública de Dólar Blue Bolivia o de Firecrawl. Conectar otro origen, como
Odoo, exige una clase que cumpla el contrato, sin tocar herramientas ni prompts.
`DATA_SOURCE=supabase` todavía no es una implementación: falla de forma explícita.

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

Herramientas actuales: `get_fx_rate`, `analyze_margins`, `suggest_price`, `simulate_scenario`,
`sales_summary`, `top_products`, `inventory_alerts`, `marketing_candidates`, `customer_insights`,
`financial_summary`, `accounts_payable` y `generate_whatsapp_message`.

### 3. Agentes (`agents/`)

Un agente es **rol + subconjunto de herramientas + prompt**. Nada más. Darle a cada agente solo sus
herramientas mejora la precisión: el Agente de Clientes no puede distraerse con el tipo de cambio.

Todos comparten un bloque de contexto de país (`SHARED_CONTEXT`) que fija las reglas no negociables:
moneda, régimen flexible vigente, tratamiento distinto de productos importados y nacionales, y
prohibición de inventar cifras.

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
- **Caché dependiente del proveedor.** El adaptador puede aprovechar caché de contexto cuando la API
  elegida lo soporta; el runtime no asume un mecanismo ni un descuento concreto.
- **Validación con Zod** de todo input del modelo antes de ejecutar.

## El panel no usa el modelo

`/api/dashboard` corre las mismas herramientas de forma determinista y devuelve JSON. Razones:

1. La pantalla principal carga en milisegundos, no en 15 segundos.
2. No gasta tokens en cada refresh.
3. Si el proveedor LLM falla en vivo, **el panel sigue funcionando** y el pitch tiene plan B.

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

## Superficie HTTP

La API expone 16 rutas:

```text
GET    /health
GET    /api/agents
GET    /api/dashboard
GET    /api/insights
POST   /api/simulate
GET    /api/brief
POST   /api/chat
GET    /api/marketing
POST   /api/image
GET    /api/taxes
GET    /api/taxes/formularios
GET    /api/formalizacion
PUT    /api/formalizacion/:itemId
GET    /api/data
POST   /api/data/:entidad
DELETE /api/data/:entidad
```

`/api/brief` y `/api/chat` transmiten SSE. Las rutas de datos reemplazan entidades en el overlay
temporal; formalización persiste en PostgreSQL sólo cuando existe `DATABASE_URL`.

## Modelo, costo y cuota

Modelo por defecto: **`gemini-3.1-flash-lite`**. La elección se midió corriendo el mismo prompt
contra cada modelo disponible y contando qué herramientas llamaba:

| Modelo | Herramientas | Tiempo | ¿Da los precios? |
| --- | --- | --- | --- |
| **`gemini-3.1-flash-lite`** | **3** | **4,2 s** | ✅ con la regla de secuencia en el prompt |
| `gemini-2.5-flash-lite` | 2 | 12.1 s | ❌ |
| `gemini-2.5-flash` | 3 | 11-13 s | ✅ |
| `gemini-3-flash-preview` | 3 | 27.6 s | ✅ |
| Cualquier `pro` | — | — | ❌ sin cuota en free tier |

Los `flash-lite` originalmente terminaban el turno sin llamar `suggest_price` — detectaban el
problema pero no decían a cuánto subir. Se arregló **escribiendo la secuencia esperada en el
prompt del agente**, no cambiando de modelo: ahora completan la cadena y son 3× más rápidos.

**Cuota:** una pregunta puede realizar varias llamadas, una por vuelta del loop. Los límites de
Gemini dependen del modelo, proyecto y facturación, así que no deben asumirse desde este documento.
Antes del pitch hay que probar el guion completo y tener `LLM_PROVIDER=anthropic` como respaldo si
existe una clave.

`max_tokens` es 8000 por turno, para dejar espacio al razonamiento más la respuesta.

## Por qué la API queda en Render

Una vuelta del loop puede realizar varias llamadas al modelo y mantener una respuesta SSE abierta.
La implementación actual es un servidor Node con `@hono/node-server`, no una función serverless.
Render lo ejecuta sin adaptar la entrada ni el streaming. El plan Starter cubierto por los créditos
disponibles evita la suspensión por inactividad; el frontend usa un Static Site independiente.
