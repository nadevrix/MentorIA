# 12 — Infraestructura

## Decisión actual

Durante la etapa inicial, todo el producto se aloja en Render:

```text
Render Static Site  → apps/web → HTML, CSS y JavaScript por CDN
Render Web Service  → apps/api → Hono, SSE y ejecución de agentes
Datos               → JSON versionado; Neon/Postgres es opcional
```

Esta decisión aprovecha los USD 100 de créditos disponibles, reduce proveedores durante la demo y
no exige adaptar el código. Cuando se habiliten los créditos de Netlify, sólo cambia el host del
frontend:

```text
Netlify             → apps/web
Render Web Service  → apps/api
Neon/Postgres       → sin cambios
```

## Por qué son dos servicios

El frontend es una SPA compilada. Después de `vite build` sólo quedan archivos estáticos en
`apps/web/dist`; no necesita un proceso Node.

La API sí necesita un proceso:

- mantiene conexiones SSE abiertas;
- ejecuta loops de herramientas que pueden durar varios segundos;
- consulta proveedores LLM y fuentes externas;
- conserva temporalmente el overlay CSV en memoria.

Servir ambos como Web Service desperdiciaría recursos. Intentar convertir la API a funciones
serverless requeriría otra entrada, revisar streaming, límites y estado. No aporta valor al hackathon.

## Render Static Site

Un Static Site de Render:

- se sirve por CDN global;
- no se suspende por inactividad;
- tiene TLS y dominio `.onrender.com`;
- reconstruye al cambiar la rama conectada;
- aplica rewrites y headers definidos en `render.yaml`.

El cold start de Render afecta a los **Web Services Free**, no a los Static Sites. La documentación
anterior del proyecto mezclaba ambos tipos de servicio.

## Render Web Service Starter

La API usa Starter:

- aproximadamente USD 7/mes;
- 512 MB de RAM y 0,5 CPU;
- no se suspende tras 15 minutos;
- admite el servidor Node y el streaming SSE actual;
- expone `/health` para diagnóstico.

El plan Free serviría para pruebas, pero introduce cerca de un minuto de arranque después de estar
inactivo. Con créditos disponibles no hay razón para asumir ese riesgo en la presentación.

La región configurada es Ohio. Si se conecta una base externa, conviene crearla en la misma región
o lo más cerca posible.

## Datos y persistencia

### Producción (Render)

`DATA_SOURCE=postgres` + Render Postgres (`mentor-ia-db`, `basic-256mb`, Ohio). El
`preDeployCommand` ejecuta `npm run db:migrate`: esquema vacío de negocio + histórico FX de
mercado. Los CSV de la UI se escriben en Postgres y sobreviven reinicios.

Todavía no hay autenticación ni tenancy: todos los visitantes de la instancia comparten la misma
base. Eso es aceptable para el pitch de un solo comercio piloto; no para multi-cliente.

### Desarrollo local

`DATA_SOURCE=seed` carga JSON de `data/seed/` sin necesidad de base. Los CSV quedan en memoria del
proceso. Para probar Postgres en local: `DATABASE_URL=... DATA_SOURCE=postgres npm run db:migrate`.

### Demo comercial opcional

Los JSON de `data/seed/` (productos, ventas, etc.) no se cargan solos. Cuando haga falta una demo
reproducible: `npm run db:seed`.

### Redis

No hace falta Redis hoy. No hay colas, sesiones distribuidas, pub/sub ni workers. El rate limit es
local porque el despliegue usa una sola instancia. Redis se evaluará sólo si se escala a varias
réplicas o se agregan trabajos asíncronos.

## Flujo de una petición

```text
Navegador
  ├─ GET /api/dashboard ───────────────┐
  └─ POST /api/chat + ReadableStream ──┤
                                       v
                                Hono en Render
                                  ├─ DataSource
                                  ├─ FxProvider
                                  └─ LlmProvider
                                       ├─ Gemini
                                       └─ Anthropic
```

El panel, hallazgos, impuestos y simulador son deterministas. El chat y el resumen usan LLM. Por eso
una caída del proveedor no debería dejar el panel vacío.

## Seguridad operativa actual

- CORS acepta uno o varios orígenes configurados.
- `/health` y `/api/*` comparten la política CORS.
- Chat, resumen e imágenes tienen rate limit por IP y ruta.
- JSON y CSV tienen límites de tamaño.
- Las claves sólo existen en variables del Web Service.
- El frontend nunca recibe claves privadas.

Esto sigue siendo un MVP público:

- no hay autenticación;
- no hay aislamiento por empresa;
- las mutaciones de CSV y formalización son compartidas;
- el rate limit en memoria no es defensa suficiente para producción.

Antes de usar datos sensibles o abrir el producto a clientes se necesita autenticación, tenancy
y límites globales.

## Variables por servicio

### API

```text
LLM_PROVIDER
GEMINI_API_KEY
GEMINI_MODEL
ANTHROPIC_API_KEY
CORS_ORIGIN
DATA_SOURCE
DATABASE_URL
FX_SOURCE
FIRECRAWL_API_KEY
IMAGE_PROVIDER
IMAGE_API_KEY
AI_RATE_LIMIT_MAX
AI_RATE_LIMIT_WINDOW_MS
MAX_JSON_BODY_BYTES
MAX_CSV_BODY_BYTES
```

### Frontend

```text
VITE_API_URL
```

`VITE_API_URL` se inserta durante el build. Cada cambio exige un nuevo deploy del Static Site.

## Costo y crédito

Con la configuración inicial:

- API Starter: alrededor de USD 7/mes;
- frontend estático: sin instancia de cómputo;
- base: no requerida en modo seed;
- consumo LLM: se factura en el proveedor del modelo, no en Render.

Los USD 100 de Render cubren ampliamente la API durante el hackathon. Debe vigilarse por separado
la cuota de Gemini o Anthropic: una conversación puede realizar varias llamadas al modelo.

## Migración a Netlify

La migración no cambia el código:

1. Netlify ejecuta `npm run build:web`.
2. Publica `apps/web/dist`.
3. Recibe `VITE_API_URL` con la misma API.
4. Render autoriza temporalmente ambos dominios en `CORS_ORIGIN`.
5. Tras probar Netlify, se retira el Static Site de Render.

No conviene usar Vercel como puente: la SPA es compatible, pero agregaría una tercera configuración
y otra migración sin resolver ningún problema técnico.

El procedimiento operativo completo está en `docs/05-deploy.md`.
