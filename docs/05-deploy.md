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
| `DATA_SOURCE` | `postgres` | Base vacía de negocio + CSV persistente |
| `DATABASE_URL` | desde Blueprint | Render Postgres (`mentor-ia-db`) |
| `FX_SOURCE` | `dolar-blue-bolivia` | Tasa oficial unificada vía API pública, con fallback local |
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
  "baseSource": "postgres",
  "fxSource": "dolar-blue-bolivia",
  "llm": {
    "provider": "gemini",
    "model": "gemini-3.1-flash-lite"
  },
  "imageProvider": null,
  "agents": 5
}
```

`dataSource: "overlay"` es correcto: la capa de CSV envuelve a la fuente base. El campo que confirma
Postgres es `baseSource: "postgres"`. El negocio arranca vacío hasta importar CSV.

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

## PostgreSQL (Render)

El Blueprint (`render.yaml`) ya define `mentor-ia-db` (plan `basic-256mb`, región Ohio) y enlaza
`DATABASE_URL` a la API. En el build corre `npm run db:migrate`: crea el esquema, deja el negocio
vacío y carga solo el histórico de mercado en `fx_rates`.

Tras sincronizar el Blueprint:

1. Confirmar que existe la base `mentor-ia-db` en el dashboard.
2. Verificar `baseSource: "postgres"` en `/health`.
3. En la UI, **Mis datos** debe mostrar las cuatro entidades en **vacío**.
4. Subir un CSV de productos y confirmar que sobrevive un redeploy.

Comandos útiles contra la base remota:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate   # esquema + FX si falta
DATABASE_URL='postgresql://...' npm run db:seed      # demo comercial opcional
DATABASE_URL='postgresql://...' npm run db:reset     # vacía el negocio (no toca FX)
```

No usar `db:reset` ni `db:seed` contra una base con datos reales que deban conservarse.

Neon sigue siendo compatible (`DATA_SOURCE=postgres` + `DATABASE_URL`), pero con créditos de Render
la opción por defecto es Render Postgres en la misma región que la API.

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

**Los CSV desaparecieron (con `DATA_SOURCE=seed`).** En local los CSV viven en memoria. En
producción con Postgres (`DATA_SOURCE=postgres`) deberían persistir; confirmar `baseSource:
"postgres"` en `/health`. Si la importación falló, revisar logs de la API (p. ej. FK de clientes en
ventas).

**El build falla en `db:migrate`.** Verificar que `DATABASE_URL` esté enlazada desde
`mentor-ia-db` y que la base ya exista (sincronizar el Blueprint).

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
