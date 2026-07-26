# 11 — Onboarding

## Preparar el entorno

Requisitos:

- Node.js 22 o superior;
- npm;
- acceso al repositorio;
- una rama propia;
- una clave Gemini o Anthropic sólo si se probará chat.

```bash
git clone https://github.com/nadevrix/MentorIA.git
cd MentorIA
git switch -c MI-NOMBRE
npm ci
cp .env.example .env
npm run typecheck
npm run build
npm run dev
```

Servicios locales:

```text
Web: http://localhost:5173
API: http://localhost:8787
Health: http://localhost:8787/health
```

## Contexto que debe conocer cualquier colaborador

Mentor IA es un copiloto para PyMEs importadoras bolivianas. El cálculo central compara el precio de
venta con el costo de reponer hoy, no sólo con el costo histórico.

Estado actual:

- cinco agentes;
- doce herramientas;
- Gemini predeterminado y Anthropic de respaldo;
- panel, hallazgos y simulador deterministas;
- API Hono con SSE;
- frontend React/Vite;
- JSON o PostgreSQL;
- despliegue actual completo en Render;
- frontend migrable a Netlify.

Antes de modificar una parte, leer:

| Cambio | Documento |
| --- | --- |
| Arquitectura o API | `docs/01-arquitectura.md` |
| Agentes o herramientas | `docs/03-agentes.md` |
| Datos o base | `docs/04-datos.md` |
| Render/Netlify | `docs/05-deploy.md` y `docs/12-infraestructura.md` |
| Hallazgos o simulador | `docs/08-insights.md` |
| Prioridad de producto | `docs/02-equipo.md` y `docs/10-prioridades.md` |

## Reglas

1. Trabajar en una rama propia; `main` es la rama desplegable.
2. No subir `.env`, claves, cadenas de base ni tokens.
3. Validar entradas HTTP y del modelo.
4. Mantener sufijos `Bob` y `Usd` en montos.
5. No inventar datos ni presentar semillas como un caso real.
6. No agregar agentes por defecto: primero mejorar los existentes.
7. Ejecutar typecheck y build antes de pedir integración.

```bash
npm run typecheck
npm run build
git status
git diff
```

## Prompt sugerido para un agente de código

```text
Trabajo en Mentor IA, repositorio https://github.com/nadevrix/MentorIA.

Antes de cambiar código:
1. Lee CLAUDE.md.
2. Revisa docs/02-equipo.md para el estado actual.
3. Lee el documento específico de la parte que tocarás.
4. Verifica la rama y los cambios existentes; no sobrescribas trabajo ajeno.

Contexto:
- Node 22+, npm workspaces y TypeScript estricto.
- packages/core contiene dominio, 5 agentes y 12 herramientas.
- apps/api es Hono/Node con REST y SSE.
- apps/web es React/Vite estático.
- El tipo de cambio vigente alimenta el costo de reposición de importados.
- Productos nacionales conservan su costo de compra en Bs.
- Gemini es el proveedor predeterminado; Anthropic es respaldo.
- El panel no usa LLM.
- Todo se despliega hoy en Render; Netlify será sólo para el frontend.

Reglas:
- No inventes cifras.
- No leas ni publiques .env.
- No hagas commit o push sin pedirlo.
- Antes de terminar corre npm run typecheck y npm run build.
```

## Flujo de colaboración

Actualizar la rama con frecuencia:

```bash
git fetch origin
git switch main
git pull origin main
git switch MI-NOMBRE
git merge main
```

Guardar trabajo:

```bash
git add -A
git commit -m "describe el propósito del cambio"
git push origin MI-NOMBRE
```

La integración, resolución de conflictos y manejo de secretos están detallados en
`docs/07-convenciones.md`.

## Prioridad vigente

1. Desplegar API Starter y Static Site mediante `render.yaml`.
2. Verificar `/health`, dashboard y SSE desde la URL pública.
3. Sustituir datos de referencia por un dataset autorizado.
4. Probar con una persona externa.
5. Corregir riesgos visibles antes de agregar funciones.
