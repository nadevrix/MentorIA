# 05 — Despliegue

## Estrategia vigente

Hasta que se habiliten los créditos de Netlify, el producto completo se despliega en Render:

| Componente | Tipo de servicio | Plan |
| --- | --- | --- |
| `mentor-ia-api` | Web Service Node | Starter |
| `mentor-ia-web` | Static Site | Gratuito |

La API Starter cuesta aproximadamente USD 7/mes y se cubre con los USD 100 de créditos disponibles.
No se suspende por inactividad. El frontend estático se sirve por CDN y tampoco tiene cold start.

Cuando llegue Netlify, sólo se moverá el frontend. La API seguirá en Render.

## Requisitos previos

1. El repositorio debe estar disponible en `https://github.com/nadevrix/MentorIA`.
2. La rama a desplegar debe contener `render.yaml`.
3. No debe haber secretos en Git; `.env` ya está ignorado.
4. Debe existir al menos una clave: `GEMINI_API_KEY` o `ANTHROPIC_API_KEY`.
5. Antes de subir cambios:

```bash
npm ci
npm run typecheck
npm run build
npm audit
```

## Crear los servicios con el Blueprint

1. En Render, abrir **New → Blueprint**.
2. Conectar el repositorio `nadevrix/MentorIA`.
3. Elegir la rama de producción.
4. Render leerá `render.yaml` y propondrá dos servicios.
5. Completar los secretos solicitados:
   - `GEMINI_API_KEY`: clave principal.
   - `ANTHROPIC_API_KEY`: respaldo opcional.
   - `VITE_API_URL`: usar inicialmente la URL esperada de la API, por ejemplo
     `https://mentor-ia-api.onrender.com`.
6. Aplicar el Blueprint.

Si Render asigna otro dominio a la API, corregir `VITE_API_URL` en `mentor-ia-web` y lanzar
**Manual Deploy → Deploy latest commit**. Esta variable se inserta durante el build; cambiarla sin
redesplegar no modifica el JavaScript publicado.

## Configuración de la API

La configuración versionada es:

```text
Runtime: Node
Node: 22
Plan: Starter
Region: Ohio
Build: npm ci && npm run build --workspace=@pyme/core && npm run build --workspace=@pyme/api
Start: node apps/api/dist/server.js
Health check: /health
```

Variables principales:

| Variable | Valor inicial | Uso |
| --- | --- | --- |
| `LLM_PROVIDER` | `gemini` | Proveedor preferido |
| `GEMINI_API_KEY` | secreto | Chat y resumen |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Modelo principal |
| `ANTHROPIC_API_KEY` | secreto opcional | Respaldo |
| `CORS_ORIGIN` | `https://mentor-ia-web.onrender.com` | Origen autorizado |
| `DATA_SOURCE` | `seed` | Datos versionados |
| `FX_SOURCE` | `static` | Histórico local |
| `AI_RATE_LIMIT_MAX` | `6` | Solicitudes de IA por IP/ruta/ventana |
| `AI_RATE_LIMIT_WINDOW_MS` | `60000` | Ventana del límite |

El repositorio ya contiene el dominio asignado. Si el Blueprint se replica con otro nombre, cambiar
`CORS_ORIGIN` por el nuevo dominio exacto, sin barra final:

```text
https://mentor-ia-web.onrender.com
```

El middleware acepta varios orígenes separados por coma. Esto permite una migración sin corte:

```text
https://mentor-ia-web.onrender.com,https://mentor-ia.netlify.app
```

## Verificación inicial

### Salud

```bash
curl https://TU_API.onrender.com/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "dataSource": "overlay",
  "baseSource": "seed",
  "fxSource": "static",
  "llm": {
    "provider": "gemini",
    "model": "gemini-3.1-flash-lite"
  },
  "imageProvider": null,
  "agents": 5
}
```

`dataSource: "overlay"` es correcto: la capa de CSV envuelve a la fuente base. El campo que confirma
si se usa JSON o Postgres es `baseSource`.

### Panel determinista

```bash
curl https://TU_API.onrender.com/api/dashboard
curl https://TU_API.onrender.com/api/insights
```

Ambos deben funcionar incluso si el proveedor LLM está caído.

### Streaming

Probar desde la URL pública:

1. El resumen diario debe empezar a escribir texto.
2. Una pregunta al agente debe mostrar `tool_use`, `tool_result` y texto incremental.
3. Dos preguntas consecutivas deben completar sin 429 del proveedor.

## PostgreSQL opcional

El primer despliegue usa `DATA_SOURCE=seed`. Para conectar Neon:

1. Crear la base cerca de Ohio.
2. Configurar `DATABASE_URL` en la API.
3. Ejecutar localmente contra la base remota:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

4. Cambiar `DATA_SOURCE=postgres`.
5. Redesplegar la API.
6. Confirmar `baseSource: "postgres"` en `/health`.

No usar `db:reset` contra una base con datos que deban conservarse.

## Migración posterior del frontend a Netlify

No se mueve la API ni la base:

1. Importar el mismo repositorio en Netlify.
2. Netlify detectará `netlify.toml`.
3. Configurar `VITE_API_URL=https://TU_API.onrender.com`.
4. Desplegar y probar la URL `.netlify.app`.
5. Agregar temporalmente ambos dominios a `CORS_ORIGIN`.
6. Cambiar el dominio público.
7. Retirar Render Static cuando la versión de Netlify esté verificada.

## Problemas frecuentes

**El frontend intenta llamar a `localhost:8787`.** Falta `VITE_API_URL` en el Static Site o no se
redesplegó después de cambiarla.

**CORS bloquea el navegador.** `CORS_ORIGIN` no coincide con el origen completo del frontend.
No incluir rutas ni barra final.

**`/health` muestra `llm.error`.** Falta una clave válida o el proveedor seleccionado no está
configurado.

**El panel funciona pero el chat no.** El panel no usa LLM. Revisar claves, cuota, modelo y logs de
Render.

**Respuesta 429 de Mentor IA.** Se alcanzó `AI_RATE_LIMIT_MAX`. Esperar la ventana o ajustar el límite.

**Respuesta 429 de Gemini/Anthropic.** Es la cuota del proveedor, no el rate limit local. Activar
facturación o cambiar `LLM_PROVIDER`.

**Los CSV desaparecieron.** El overlay vive en memoria y se pierde en reinicios o despliegues. Es
comportamiento actual, no almacenamiento persistente.

**El build no encuentra `@pyme/core`.** Ejecutar desde la raíz y usar los comandos workspace del
Blueprint; no reemplazarlos por `vite build`.

## Lista final

- [ ] `/health` informa proveedor y modelo.
- [ ] `baseSource` coincide con la fuente prevista.
- [ ] Dashboard e insights responden.
- [ ] Frontend usa la API pública.
- [ ] `CORS_ORIGIN` ya no es `*`.
- [ ] Resumen y chat transmiten por SSE.
- [ ] Probado desde un teléfono con datos móviles.
- [ ] No hay secretos en el historial Git.
- [ ] Las URL definitivas están en `README.md`.
