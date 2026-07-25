# 05 — Deploy

> **Hacé esto primero, con el esqueleto vacío.** Un producto perfecto sin URL pública no compite.
> Es la prioridad #1 del backlog (`docs/02-equipo.md`).

Dos servicios, ambos free tier y accesibles para el jurado sin cuenta ni instalación:

| Pieza    | Servicio | Config              |
| -------- | -------- | ------------------- |
| Frontend | Netlify  | `netlify.toml`      |
| API      | Render   | `render.yaml`       |

## 1. API en Render

1. Render → **New → Web Service** → conectá el repo de GitHub.
2. Render detecta `render.yaml`. Si lo configurás a mano:
   - **Runtime:** Node
   - **Build:** `npm install && npm run build --workspace=@pyme/core && npm run build --workspace=@pyme/api`
   - **Start:** `node apps/api/dist/server.js`
   - **Health check path:** `/health`
3. Variables de entorno (pestaña *Environment*):

   | Variable            | Valor                                         |
   | ------------------- | --------------------------------------------- |
   | `LLM_PROVIDER`      | `gemini` (o `anthropic`)                      |
   | `GEMINI_API_KEY`    | tu clave — **nunca en el repo**               |
   | `GEMINI_MODEL`      | `gemini-2.5-flash`                            |
   | `ANTHROPIC_API_KEY` | opcional, respaldo si Gemini falla en vivo    |
   | `CORS_ORIGIN`       | la URL de Netlify (dejalo en `*` mientras probás) |
   | `DATA_SOURCE`       | `seed`                                        |
   | `FX_SOURCE`         | `firecrawl` si hay clave, si no `static`      |
   | `FIRECRAWL_API_KEY` | opcional, para el dólar en vivo               |

4. Verificá: `curl https://TU-API.onrender.com/health` debe devolver el proveedor y el modelo:

   ```json
   {"ok":true,"dataSource":"seed","fxSource":"firecrawl",
    "llm":{"provider":"gemini","model":"gemini-2.5-flash"},"agents":5}
   ```

   Si `llm` trae un `error` en vez de `provider`, falta la clave del modelo.

## 2. Frontend en Netlify

1. Netlify → **Add new site → Import an existing project** → el mismo repo.
2. Toma `netlify.toml` automáticamente (build `npm run build:web`, publish `apps/web/dist`).
3. Variable de entorno: `VITE_API_URL = https://TU-API.onrender.com` (sin barra final).
4. **Redesplegá después de agregar la variable** — Vite inyecta las `VITE_*` en tiempo de build, así
   que un deploy previo no la toma.
5. Ajustá `CORS_ORIGIN` en Render a la URL de Netlify y guardá las URLs en el README.

## El arranque en frío de Render

El free tier duerme el servicio tras ~15 minutos sin tráfico, y despertarlo toma **30–60 segundos**.
En medio de un pitch de 4 minutos eso es fatal.

Mitigaciones, en orden de preferencia:

1. **Abrí `<API>/health` cinco minutos antes de subir al escenario.** Suficiente y gratis.
2. Un ping cada 10 minutos durante el Demo Day desde cualquier servicio de uptime.
3. En el frontend, mostrar "despertando el servidor…" en lugar de un error.

## Checklist previo al pitch

- [ ] `<API>/health` responde `ok: true` y `llm` trae `provider` y `model`
- [ ] Dos preguntas seguidas al agente funcionan sin 429 (si no, falta facturación en Gemini)
- [ ] `<API>/api/dashboard` devuelve datos
- [ ] La URL de Netlify carga el panel con números
- [ ] Un chat completo con un agente funciona de punta a punta desde la URL pública
- [ ] Probado en el celular de alguien del equipo, con datos móviles (no el WiFi del venue)
- [ ] `CORS_ORIGIN` apunta a la URL real de Netlify
- [ ] `git log -p | grep -i "sk-ant"` no devuelve nada

## Errores frecuentes

**CORS bloqueado.** `CORS_ORIGIN` en Render tiene que ser la URL exacta de Netlify, sin barra final.
Mientras depurás, `*` funciona.

**Falta la clave del modelo.** `/health` lo dice en el campo `llm`. El panel funciona igual (es
determinista) pero `/api/chat` devuelve 500.

**429 de Gemini en medio de la demo.** El free tier permite ~5 requests por minuto y cada pregunta
consume 3 o 4. Activá facturación en Google antes del pitch, o cambiá `LLM_PROVIDER=anthropic` en
Render — el cambio no requiere redeploy del frontend.

**El build de Netlify falla con "cannot find module @pyme/core".** El build tiene que compilar el core
primero — para eso `npm run build:web` corre ambos. No lo cambies por `vite build` pelado.

**El frontend apunta a localhost en producción.** Faltó `VITE_API_URL` o no se redesplegó después de
agregarla.

**El SSE se corta a mitad de respuesta.** Suele ser un proxy con buffering. Render no lo hace; si
pasa, revisá que no haya un CDN intermedio delante de la API.
