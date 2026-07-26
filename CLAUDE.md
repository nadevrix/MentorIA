# CLAUDE.md

Contexto del proyecto para cualquier agente de IA que trabaje en este repo.
**Leé esto antes de tocar código.**

## Qué es esto

Copiloto de IA para PyMEs bolivianas, construido para el Cursor Buildathon Bolivia 2026
(track Bolivia Agents). Cinco agentes especializados leen los datos del negocio y devuelven
acciones concretas.

**El diferencial, y la razón de existir del producto:** el 29/06/2026 el BCB terminó 15 años de
tipo de cambio fijo (6,96) y pasó a un régimen flexible: hoy hay **un solo Tipo de Cambio Oficial
que flota y se actualiza a diario**. Ya subió ~17% en menos de un mes. Un comercio importador fija
precios con el dólar de cuando compró y repone con el de hoy — puede vender bien y estar perdiendo
capital sin saberlo. Ningún ERP disponible en el país calcula eso.

```
costoReposicionBob = costUsd × (importado ? tipoDeCambioHoy : purchaseFxRate)
margenRealPct      = (precioBob − costoReposicionBob) / precioBob × 100
```

Un producto nacional no se revalúa con el dólar: su costo en Bs es el de su compra.

El mercado paralelo sigue existiendo, pero la brecha pasó de más de 100% a ~2%. **No lo niegues,
pero tampoco lo trates como un mercado aparte**: el dato que manda es el TCO único.

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
  fx/                Tipo de cambio: serie estática o Firecrawl en vivo
  llm/               Capa de proveedor de modelo: gemini.ts, anthropic.ts
  tools/             Las 10 herramientas de los agentes
  agents/            Rol + herramientas + prompt de cada agente
  runtime.ts         Loop: modelo → herramienta → resultado → modelo
apps/api/          Hono + SSE
apps/web/          React + Vite + Tailwind v4
data/              Generador y datos semilla
```

## El motor es intercambiable

El runtime NO habla con el SDK de ningún proveedor: habla con la interfaz `LlmProvider`
(`packages/core/src/llm/types.ts`). Hay dos adaptadores, Gemini y Claude, y se elige con
`LLM_PROVIDER`. Si el proveedor configurado no tiene su clave, cae al otro en vez de romper.

**Por defecto corre Gemini** (`gemini-3.1-flash-lite`). Medido sobre el loop de este proyecto:
completa la cadena de herramientas en 4,2 s, contra 13 s de `gemini-2.5-flash`. Ningún modelo
`pro` tiene cuota en el free tier.

Los `flash-lite` sólo completan la cadena **gracias a que el prompt del agente de precios dice
explícitamente la secuencia esperada**. Si sacás esa regla, vuelven a quedarse en el diagnóstico
sin dar los precios.

Si agregás soporte para otro proveedor, implementá `LlmProvider` y sumalo a `createLlmProvider()`.
**No metas lógica de proveedor en `runtime.ts`** — ahí está el loop, y tiene que seguir siendo
agnóstico.

⚠️ **Límite de cuota:** el free tier de Gemini permite ~5 requests por minuto **y 20 por día** en
los modelos flash. Cada pregunta al agente consume 3 o 4 (una por vuelta del loop), así que son
unas 5 preguntas diarias. Para la demo en vivo hace falta facturación activada en Google, o
cambiar a `LLM_PROVIDER=anthropic`.

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
2. **Nunca commitees una API key ni el `.env`** (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
   `FIRECRAWL_API_KEY`, `DATABASE_URL`).

**Sí hay que pushear la rama propia, y seguido.** Es el backup del usuario y la única forma de
que quien integra vea el trabajo — lo que queda solo en la laptop no existe para el equipo.
Cuando algo funcione, ofrecé hacerlo:

```bash
npm run typecheck && npm run build:web    # que pase antes de pushear
git add -A
git commit -m "agrega simulador de escenario cambiario"
git push origin $(git branch --show-current)
```

Traé `main` cada 2 o 3 horas para no acumular un conflicto gigante:

```bash
git switch main && git pull origin main
git switch -                              # vuelve a la rama anterior
git merge main
```

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

## Documentación — leé la que corresponda ANTES de trabajar

No las leas todas. Abrí la del tema que vas a tocar, antes de escribir código:

| Si vas a… | Leé primero |
| --- | --- |
| Agregar o cambiar una herramienta o un agente | `docs/03-agentes.md` |
| Tocar datos, el modelo de dominio o conectar una fuente real | `docs/04-datos.md` |
| Tocar el loop de agentes, la API o entender cómo encaja todo | `docs/01-arquitectura.md` |
| Desplegar o depurar Netlify / Render | `docs/05-deploy.md` |
| Trabajar en la interfaz o preparar la demo | `docs/06-demo-pitch.md` |
| Hacer commit, merge o resolver un conflicto | `docs/07-convenciones.md` |
| Decidir **qué** construir o si algo vale la pena | `docs/08-estrategia.md` y `docs/02-equipo.md` |
| Entender el problema de negocio y el usuario | `docs/00-vision.md` |

Si el usuario te pide algo y no sabés por dónde empezar, la respuesta está en
`docs/02-equipo.md` (backlog ordenado por impacto). `docs/09-onboarding.md` tiene el flujo de
trabajo del equipo.

## Estado actual

Funcionando y verificado:
- Motor de agentes sobre Gemini, probado de punta a punta por HTTP (`/api/chat` con SSE)
- 5 agentes, 10 herramientas, panel determinista
- Tipo de cambio en vivo con Firecrawl (`FX_SOURCE=firecrawl`), con fallback a la serie
  estática si el scraping falla
- Simulador cambiario en la interfaz (`FxSimulator.tsx`)
- Tablas markdown y trazas de herramientas en el chat

Pendiente:
- **Datos reales de un comercio.** Los de `data/seed/` son generados — el track descalifica
  demos que solo corren con datos hardcodeados
- **Deploy.** Las URLs del README están vacías
- Base de datos: `DATABASE_URL` está en el `.env.example` pero no hay implementación de
  `DataSource` sobre Postgres todavía
- No hay tests
- Cuota de Gemini: ver la advertencia de arriba antes del pitch
