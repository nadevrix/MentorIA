# Mentor IA

**Agentes de IA que protegen el margen de las PyMEs bolivianas cuando cambia el costo de reponer.**

Desde el cambio de régimen de junio de 2026, el tipo de cambio boliviano es flexible. Un comercio
importador puede vender con la lista de precios de la semana pasada y descubrir demasiado tarde que
ya no puede reponer lo vendido. Mentor IA cruza productos, ventas, inventario, clientes, gastos y
tipo de cambio para convertir ese riesgo en acciones concretas.

> **Track:** Bolivia Agents · **Evento:** Cursor Buildathon Bolivia 2026

## Estado actual

- Monorepo npm con núcleo de dominio, API y SPA.
- Cinco agentes y doce herramientas con tool use real.
- Panel, nueve detectores y simulaciones deterministas: no consumen tokens.
- Chat y resumen diario en streaming mediante Server-Sent Events.
- Datos JSON incluidos; Postgres/Neon y carga CSV disponibles.
- Despliegue temporal preparado completamente en Render.

Las URL públicas se completan después del primer despliegue:

| Servicio | URL |
| --- | --- |
| Web | <https://mentor-ia-web.onrender.com> |
| API | <https://mentor-ia-api.onrender.com> |
| Salud | <https://mentor-ia-api.onrender.com/health> |

## Qué incluye

- **Panel de negocio:** ventas, margen a costo de reposición, utilidad, inventario y cuentas por pagar.
- **Hallazgos proactivos:** nueve detectores ordenados por urgencia e impacto en bolivianos.
- **Resumen diario:** un proveedor LLM redacta los hallazgos ya calculados, sin herramientas.
- **Agentes especializados:** Director, Precios, Inventario, Finanzas y Clientes/Marketing.
- **Simulador cambiario:** recalcula margen, utilidad y capital de reposición para un escenario.
- **Datos propios:** importa CSV por entidad sobre los datos base.
- **Impuestos y formalización:** estimaciones tributarias, formularios de referencia y seguimiento de trámites.
- **Marketing:** elige productos promocionables sin sacrificar margen y genera contenido.
- **Trazabilidad:** la interfaz muestra las herramientas que ejecuta cada agente.

## Stack

| Capa | Tecnología |
| --- | --- |
| Runtime | Node.js 22 LTS |
| Lenguaje | TypeScript estricto + Zod |
| LLM | Gemini por defecto; Anthropic como respaldo |
| Backend | Hono sobre Node, REST + SSE |
| Frontend | React 19, Vite 6 y Tailwind CSS 4 |
| Datos | JSON versionado o PostgreSQL mediante `pg` |
| Deploy actual | Render Web Service Starter + Render Static Site |
| Deploy posterior | API en Render + frontend en Netlify |

## Ejecutar en local

Requisitos: Node.js 22 o superior y npm.

```bash
git clone https://github.com/nadevrix/MentorIA.git
cd MentorIA
npm ci
cp .env.example .env
npm run dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:8787>
- Health: <http://localhost:8787/health>

El panel funciona sin una clave LLM. Para chat y resumen configurá `GEMINI_API_KEY` o
`ANTHROPIC_API_KEY` en `.env`.

## Comandos

```bash
npm run dev          # API y frontend
npm run dev:api      # sólo API
npm run dev:web      # sólo frontend
npm run typecheck    # core + API
npm run build        # core + API + frontend
npm run build:web    # core + frontend
npm run db:migrate   # esquema + FX de mercado; negocio vacío
npm run db:seed      # demo comercial opcional en Postgres
npm run db:reset     # vacía tablas del negocio (no toca FX)
```

## Arquitectura

```text
Navegador
  └─ apps/web (React/Vite, estático)
       └─ HTTP + SSE a VITE_API_URL
            └─ apps/api (Hono/Node)
                 └─ packages/core
                      ├─ LlmProvider: Gemini | Anthropic
                      ├─ DataSource: seed | PostgreSQL
                      └─ FxProvider: static | API pública | Firecrawl, con fallback
```

```text
packages/core/     Tipos, datos, agentes, herramientas y cálculos
apps/api/          API REST, SSE, CORS, límites de cuerpo y rate limit
apps/web/          SPA React
data/seed/         Dataset de referencia y catálogos
db/                Esquema y migrador idempotente de PostgreSQL
docs/              Documentación de producto, técnica y operativa
render.yaml        API y frontend en Render
netlify.toml       Migración futura del frontend
```

## Despliegue

Mientras se habilitan los créditos de Netlify, todo corre en Render:

1. `mentor-ia-api`: Web Service **Starter** en Ohio.
2. `mentor-ia-web`: Static Site gratuito servido por CDN.
3. La API usa los créditos disponibles de Render; Starter evita el cold start del plan Free.
4. Cuando llegue Netlify, sólo se mueve `apps/web`; la API y sus variables permanecen en Render.

El orden y las variables exactas están en [docs/05-deploy.md](docs/05-deploy.md). La decisión de
infraestructura está explicada en [docs/12-infraestructura.md](docs/12-infraestructura.md).

## Datos y límites actuales

- `DATA_SOURCE=seed` lee `data/seed/*.json` (desarrollo local).
- `DATA_SOURCE=postgres` requiere `DATABASE_URL` y `npm run db:migrate` (negocio vacío).
- Con Postgres, los CSV de la UI se persisten; con seed viven en memoria.
- El avance de formalización usa la tabla `compliance` cuando hay `DATABASE_URL`.
- No hay autenticación ni separación multiempresa todavía.
- Los endpoints de IA tienen un límite básico por IP; no sustituye autenticación para producción.

Los datos incluidos son de referencia. Antes de presentar cifras como un caso real, hay que cargar
un dataset autorizado y anonimizado. Ver [docs/04-datos.md](docs/04-datos.md).

## Documentación

| Documento | Contenido |
| --- | --- |
| [00 — Visión](docs/00-vision.md) | Problema, usuario y alcance |
| [01 — Arquitectura](docs/01-arquitectura.md) | Componentes, flujo y contratos |
| [02 — Estado](docs/02-equipo.md) | Implementado, riesgos y pendientes |
| [03 — Agentes](docs/03-agentes.md) | Catálogo de agentes y herramientas |
| [04 — Datos](docs/04-datos.md) | Modelo, fuentes y persistencia |
| [05 — Deploy](docs/05-deploy.md) | Render ahora y Netlify después |
| [06 — Demo](docs/06-demo-pitch.md) | Guion y lista de comprobación |
| [07 — Convenciones](docs/07-convenciones.md) | Git, código y comunicación |
| [08 — Hallazgos](docs/08-insights.md) | Detectores, simulador y resumen |
| [09 — Estrategia](docs/09-estrategia.md) | ICP, propuesta y roadmap |
| [10 — Prioridades](docs/10-prioridades.md) | Orden de trabajo |
| [11 — Onboarding](docs/11-onboarding.md) | Arranque para colaboradores |
| [12 — Infraestructura](docs/12-infraestructura.md) | Decisiones de hosting y operación |
| [13 — El evento](docs/13-evento.md) | **Reglas, criterios, entregables y deadline** |

## Licencia

MIT.
