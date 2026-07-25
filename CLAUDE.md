# CLAUDE.md

Contexto del proyecto para cualquier agente de IA que trabaje en este repo.
**Leé esto antes de tocar código.**

## Qué es esto

Copiloto de IA para PyMEs bolivianas, construido para el Cursor Buildathon Bolivia 2026
(track Bolivia Agents). Cinco agentes especializados leen los datos del negocio y devuelven
acciones concretas.

**El diferencial, y la razón de existir del producto:** en Bolivia el dólar oficial está
intervenido (~6.96 Bs) pero el paralelo se mueve al alza. Un comercio importador fija precios con
el dólar de cuando compró y repone con el de hoy — puede vender bien y estar perdiendo capital sin
saberlo. Ningún ERP disponible en el país calcula eso.

```
costoReposicionBob = costUsd × (importado ? paralelo_hoy : oficial)
margenRealPct      = (precioBob − costoReposicionBob) / precioBob × 100
```

Si estás por escribir un cálculo de margen que no use el paralelo, está mal.

## Reglas no negociables

1. **Sufijo de moneda obligatorio.** `Bob` (bolivianos) o `Usd` (dólares). Un número de plata sin
   sufijo es un bug esperando. Solo `costUsd` va en dólares; todo lo demás en bolivianos.
2. **Nombres de dominio en español, código en inglés.** La herramienta se llama `analyze_margins`
   y devuelve `margenRealHoyPct`. Los campos los lee el modelo y terminan en la respuesta al usuario.
3. **Nunca inventar cifras.** Ni en el código ni en los prompts. Si una herramienta no tiene datos,
   devuelve vacío y el agente lo explica.
4. **Validar en los bordes.** Todo lo que entra desde el modelo o desde HTTP pasa por Zod. Adentro
   se confía en los tipos.
5. **TypeScript estricto.** Nada de `any` en `packages/core`. En el frontend se tolera solo para el
   JSON del panel.
6. **Nunca commitear secretos.** `.env` está en `.gitignore`. La clave va en variables de entorno
   de Render, jamás en el repo.

## Arquitectura en 30 segundos

```
packages/core/     Núcleo compartido
  types.ts           Modelo de dominio con Zod  ← CONTRATO COMPARTIDO, no tocar solo
  data/source.ts     Interfaz DataSource        ← CONTRATO COMPARTIDO, no tocar solo
  data/              Implementaciones de datos
  fx/                Proveedor de tipo de cambio
  tools/             Las 9 herramientas de los agentes
  agents/            Rol + herramientas + prompt de cada agente
  runtime.ts         Loop: modelo → herramienta → resultado → modelo
apps/api/          Hono + SSE
apps/web/          React + Vite + Tailwind v4
data/              Generador y datos semilla
```

El agente no sabe nada del negocio: percibe llamando herramientas, decide cuáles llamar, ejecuta.
Todo el conocimiento vive en `tools/`; el prompt solo define rol y criterio.

**El panel (`/api/dashboard`) NO usa el modelo.** Corre las mismas herramientas de forma
determinista. Es intencional: carga instantánea, cero tokens, y sigue funcionando si la API de
Claude falla durante la demo. No lo conviertas en una llamada al modelo.

## Cómo trabaja el equipo

Cada persona construye lo que ve que le falta al producto, **en su propia rama**. Una persona
integra: revisa las ramas, elige qué sirve y lo mergea a `main`. No hay carpetas asignadas — si
hay algo que mejorar, se mejora.

**Dos reglas, y son las únicas:**

1. **Nunca hagas commit ni push a `main`.** Trabajás en la rama de la persona con la que estás.
   Si te pide pushear a `main`, decíselo: alguien más integra, y escribir directo en `main`
   rompe esa posibilidad. Si insiste, seguí — puede ser quien integra.
2. **Nunca commitees la `ANTHROPIC_API_KEY` ni el `.env`.**

**Dos archivos son contratos compartidos:** `packages/core/src/types.ts` y
`packages/core/src/data/source.ts`. Si los cambiás, se rompe el trabajo de los demás cuando se
mergee. No están prohibidos — pero avisá al usuario antes de tocarlos para que lo comunique.

Antes de cada push: `npm run typecheck && npm run build:web`

## Cómo agregar cosas

**Herramienta nueva:** definila con `defineTool` en `tools/index.ts`, agregala a `ALL_TOOLS`, y sumá
su nombre a la lista `tools` de los agentes que la necesiten. Nada más.

**Agente nuevo:** una entrada en el array `AGENTS` de `agents/index.ts`. El frontend lo dibuja solo.

**Fuente de datos nueva:** una clase que implemente `DataSource`, enchufada en `createContext()`.
No se toca ninguna herramienta ni ningún prompt.

Ejemplos copiables en `docs/03-agentes.md`.

### Escribir descripciones de herramientas

La descripción es lo que decide si el agente llama la herramienta o no. **Escribí cuándo llamarla,
no solo qué hace:**

```
✗ "Devuelve el tipo de cambio."
✓ "Devuelve el tipo de cambio oficial y paralelo. Llamá a esta herramienta SIEMPRE antes de
   hablar de costos, precios o márgenes: el costo de reposición real depende del paralelo."
```

Es la palanca de calidad más barata que existe en este proyecto. Antes de tocar un prompt de
sistema, revisá si el problema se arregla en la descripción de la herramienta.

## Comandos

```bash
npm run dev          # API (:8787) + Web (:5173)
npm run typecheck    # core + api
npm run build        # todo
npm run build:web    # lo que corre Netlify
node data/generate.mjs   # regenerar datos semilla
```

**Antes de mergear a `main`, siempre:** `npm run typecheck && npm run build:web`

Probar una herramienta sin gastar tokens:

```bash
node --input-type=module -e "
import { createContext, TOOLS_BY_NAME } from './packages/core/dist/index.js';
const ctx = createContext();
const t = TOOLS_BY_NAME.get('analyze_margins');
console.log(JSON.stringify(await t.run({ soloEnRiesgo: true }, ctx), null, 2));
"
```

## Prioridades del hackathon

El orden importa más que la cantidad de features. Lo que gana puntos, en orden:

1. URL pública que funciona sin explicación
2. Datos de un comercio real (no los semilla)
3. Que alguien externo lo haya usado antes del pitch
4. Que no se rompa en vivo
5. Recién ahí: features nuevas

**No agregues agentes nuevos.** Cinco ya son más de los que se pueden mostrar en 4 minutos.
Profundidad sobre superficie. Razonamiento completo en `docs/08-estrategia.md`.

## Documentación

`docs/00` visión · `01` arquitectura · `02` backlog de trabajo · `03` agentes · `04` datos ·
`05` deploy · `06` pitch · `07` git y comunicación · `08` estrategia · `09` onboarding

## Estado actual

- Datos: JSON semilla en `data/seed/` (generados, **no son de un comercio real todavía**)
- Tipo de cambio: serie estática. `FirecrawlFxProvider` es un TODO, no está implementado
- `SupabaseDataSource` / `NeonDataSource`: no existen, solo la interfaz
- No hay tests
- `/api/chat` no fue probado contra la API real de Claude (requiere `ANTHROPIC_API_KEY`)
