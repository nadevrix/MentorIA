# CLAUDE.md

Contexto operativo para agentes de código que trabajen en Mentor IA.

## Producto

Mentor IA es un copiloto de decisión para PyMEs importadoras bolivianas. Compara precios de venta con
el costo de reposición al tipo de cambio vigente y convierte los riesgos detectados en acciones.

```text
costoReposicionBob = costUsd × (imported ? tipoCambioVigente : purchaseFxRate)
margenRealPct = (priceBob − costoReposicionBob) / priceBob × 100
```

Un producto nacional no se revaloriza automáticamente con el dólar; usa el tipo de su compra. Los
montos operativos están en bolivianos salvo los costos `costUsd`.

## Estado real

- Node.js 22+ y npm workspaces.
- TypeScript estricto y Zod.
- Cinco agentes y doce herramientas.
- Gemini predeterminado; Anthropic como respaldo.
- Hono/Node para REST y SSE.
- React 19 + Vite 6 + Tailwind CSS 4.
- Panel, hallazgos, impuestos y simulador deterministas.
- JSON semilla (local) o PostgreSQL vacío (producción).
- CSV por entidad: persistente en Postgres, en memoria con seed.
- Render Web Service Starter + Render Static Site + Render Postgres.
- Netlify reservado para migrar sólo el frontend.
- No hay autenticación ni aislamiento multiempresa.
- No hay suite de tests automatizada.

## Estructura

```text
packages/core/
  src/types.ts                  contrato de dominio
  src/data/source.ts            interfaz DataSource
  src/data/seed-source.ts       JSON
  src/data/postgres-source.ts   PostgreSQL
  src/data/overlay-source.ts    CSV (Postgres o memoria)
  src/fx/provider.ts            estático, API pública o Firecrawl con fallback
  src/llm/                      adaptadores Gemini y Anthropic
  src/tools/index.ts            12 herramientas
  src/agents/index.ts           5 agentes
  src/runtime.ts                loop de tool use
  src/dashboard.ts              panel determinista
  src/insights.ts               detectores
  src/simulate.ts               escenarios
  src/brief.ts                  resumen sin herramientas

apps/api/src/server.ts          API Hono, CORS, SSE y límites
apps/web/src/                   SPA React
data/seed/                      dataset y catálogos de referencia
db/schema.sql                   esquema PostgreSQL
db/migrate.mjs                 migración idempotente
render.yaml                    despliegue actual
netlify.toml                   frontend futuro
```

## Contratos delicados

Avisar antes de modificar:

- `packages/core/src/types.ts`
- `packages/core/src/data/source.ts`

Estos archivos afectan datos, herramientas, API y migraciones.

## Proveedores

`createLlmProvider()` resuelve:

```text
LLM_PROVIDER=gemini
  ├─ GEMINI_API_KEY disponible → Gemini
  └─ si falta y hay ANTHROPIC_API_KEY → Anthropic

LLM_PROVIDER=anthropic
  ├─ ANTHROPIC_API_KEY disponible → Anthropic
  └─ si falta y hay GEMINI_API_KEY → Gemini
```

El runtime sólo conoce `LlmProvider`. No agregar lógica de proveedor dentro de `runtime.ts`.

El resumen diario usa el mismo selector. No debe exigir una clave Anthropic si Gemini está
configurado.

## Agentes y herramientas

Agentes:

1. `director`
2. `precios`
3. `inventario`
4. `finanzas`
5. `clientes`

Herramientas:

1. `get_fx_rate`
2. `analyze_margins`
3. `suggest_price`
4. `simulate_scenario`
5. `sales_summary`
6. `top_products`
7. `inventory_alerts`
8. `marketing_candidates`
9. `customer_insights`
10. `financial_summary`
11. `accounts_payable`
12. `generate_whatsapp_message`

Las descripciones de herramientas deben indicar **cuándo** llamarlas. El prompt define rol y
criterio; los cálculos pertenecen a herramientas deterministas.

## Datos

`createContext()` selecciona la fuente base:

- `seed`: JSON versionado;
- `postgres` o `neon`: `PostgresDataSource`;
- `supabase`: no implementado; cae a seed con advertencia.

La fuente se envuelve en `OverlayDataSource`. Los CSV importados:

- reemplazan una entidad a la vez;
- se comparten dentro de la instancia;
- se pierden al reiniciar;
- no deben considerarse almacenamiento.

Con PostgreSQL:

```bash
npm run db:migrate
```

No ejecutar `db:reset` contra datos que deban conservarse.

## API

Rutas principales:

```text
GET    /health
GET    /api/agents
GET    /api/dashboard
GET    /api/insights
POST   /api/simulate
GET    /api/brief              SSE
POST   /api/chat               SSE
GET    /api/marketing
POST   /api/image
GET    /api/taxes
GET    /api/taxes/formularios
GET    /api/formalizacion
PUT    /api/formalizacion/:id
GET    /api/data
POST   /api/data/:entidad
DELETE /api/data/:entidad
```

Todo input HTTP debe validarse o tener límite de cuerpo. Nunca devolver stack traces.

Chat, resumen e imágenes usan rate limit local por IP y ruta. Es adecuado para una instancia de
demo, no para producción distribuida.

## Despliegue

Estado temporal:

```text
Render Static Site → frontend
Render Starter     → API
```

Los USD 100 de crédito cubren el Web Service Starter. El Static Site no se suspende. Starter tampoco
tiene el cold start del plan Free.

Cuando lleguen créditos de Netlify:

```text
Netlify        → frontend
Render Starter → API
```

`VITE_API_URL` es build-time. Cambiarla exige redesplegar el frontend. `CORS_ORIGIN` debe contener
los dominios exactos sin barra final.

## Reglas

1. Nunca inventar cifras.
2. Nunca presentar datos semilla como un cliente real.
3. Nunca subir `.env`, claves o cadenas de conexión.
4. Mantener sufijos `Bob` y `Usd`.
5. Validar datos en los bordes.
6. No convertir el panel en una llamada LLM.
7. No agregar agentes sin una necesidad validada.
8. No asumir persistencia para datos en memoria.
9. No hacer commit ni push salvo petición explícita.
10. Preservar cambios locales ajenos.

## Comandos

```bash
npm ci
npm run dev
npm run dev:api
npm run dev:web
npm run typecheck
npm run build
npm run build:web
npm run db:migrate
```

Antes de integrar:

```bash
npm run typecheck && npm run build
```

## Qué leer

| Trabajo | Documento |
| --- | --- |
| Entender el producto | `docs/00-vision.md` |
| API, runtime o capas | `docs/01-arquitectura.md` |
| Estado y pendientes | `docs/02-equipo.md` |
| Agentes o herramientas | `docs/03-agentes.md` |
| Datos o PostgreSQL | `docs/04-datos.md` |
| Render o Netlify | `docs/05-deploy.md`, `docs/12-infraestructura.md` |
| Saber qué exige el jurado, qué descalifica o cuándo es el deadline | `docs/13-evento.md` |
| Demo | `docs/06-demo-pitch.md` |
| Git y convenciones | `docs/07-convenciones.md` |
| Hallazgos y simulador | `docs/08-insights.md` |
| Estrategia | `docs/09-estrategia.md` |
| Prioridades | `docs/10-prioridades.md` |
| Incorporarse al equipo | `docs/11-onboarding.md` |
