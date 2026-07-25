# PyME AI

**Agentes de IA que protegen el margen de las PyMEs bolivianas cuando se mueve el dólar.**

En Bolivia el dólar oficial está intervenido en 6.96 Bs, pero el paralelo se mueve todas las semanas.
Un comercio importador compró su mercadería con el dólar a 11 y hoy repone a 14.76: sigue vendiendo
al mismo precio, ve movimiento en caja y cree que gana — pero ya no puede reponer lo que vende.
Nadie le avisa. Su Excel no sabe de tipo de cambio.

PyME AI sí. Cinco agentes especializados leen las ventas, el inventario, los clientes y el tipo de
cambio del negocio, **recalculan el margen real al costo de reposición de hoy** y devuelven acciones
concretas: qué precio subir, a cuánto, qué cliente contactar, qué pago vence.

> **Track:** Bolivia Agents · **Evento:** Cursor Buildathon Bolivia 2026

---

## Correr en local (4 pasos)

```bash
git clone <URL-DEL-REPO> && cd buildathoncursor
npm install
cp .env.example .env        # y pegá tu ANTHROPIC_API_KEY
npm run dev                 # API en :8787 · Web en :5173
```

Abrí <http://localhost:5173>. Los datos semilla ya están en el repo; para regenerarlos con fechas
frescas: `node data/generate.mjs`.

## Demo desplegada

| Pieza    | URL                          |
| -------- | ---------------------------- |
| Frontend | _(Netlify — completar)_      |
| API      | _(Render — completar)_       |
| Health   | `<API>/health`               |

---

## Qué hace, concretamente

- **Panel determinista** — los mismos cálculos que usan los agentes, corridos sin modelo. Carga
  instantánea y sin costo de tokens: márgenes en riesgo, ventas vs. mes anterior, utilidad neta,
  capital inmovilizado, cuentas vencidas.
- **5 agentes con herramientas reales** — cada uno ve solo las herramientas de su dominio y decide
  cuáles llamar y en qué orden. No es un prompt largo: es un loop de percepción → decisión → ejecución.
- **Simulación cambiaria** — "¿qué pasa si el dólar llega a 15?" recalcula todo el catálogo y
  devuelve el precio sugerido producto por producto.
- **Trazabilidad en vivo** — la UI muestra qué herramienta está corriendo el agente mientras piensa.

### Los agentes

| Agente                       | Resuelve                                             |
| ---------------------------- | ---------------------------------------------------- |
| 🧭 Director de Negocio       | "¿Cómo estoy? ¿Qué hago hoy?" — cruza todas las áreas |
| 💵 Cambiario y de Precios    | Margen real, precios sugeridos, escenarios de dólar   |
| 📦 Inventario                | Reposición, rotación, capital dormido                 |
| 📊 Financiero                | Utilidad, gastos, liquidez, cuentas por pagar         |
| 👥 Clientes (CRM)            | Inactivos, mejores clientes, mensajes de reactivación |

## Stack

| Capa       | Tecnología                                | Por qué                                             |
| ---------- | ----------------------------------------- | --------------------------------------------------- |
| Agentes    | Claude Opus 5 (`@anthropic-ai/sdk`)       | Tool use nativo, decide qué consultar                |
| Backend    | Node 20 + Hono, SSE                       | Streaming sin límite de 10s de las funciones edge    |
| Frontend   | React 19 + Vite + Tailwind v4             | Build de <1s, despliegue directo en Netlify          |
| Tipos      | TypeScript + Zod, compartidos vía workspace | Un solo modelo de dominio para todo el equipo       |
| Deploy     | Netlify (web) + Render (API)              | Free tier, accesible para el jurado sin instalar nada |

## Estructura

```
packages/core/     Núcleo: modelo de dominio, herramientas, agentes, loop de ejecución
  src/types.ts       Esquemas Zod del negocio (productos, ventas, clientes, gastos, FX)
  src/data/          Contrato DataSource + implementación con datos semilla
  src/fx/            Proveedor de tipo de cambio (paralelo)
  src/tools/         Las 9 herramientas que pueden invocar los agentes
  src/agents/        Definición de cada agente: rol, herramientas, prompt
  src/runtime.ts     Loop: modelo → herramienta → resultado → modelo
apps/api/          Servidor Hono: /health, /api/agents, /api/dashboard, /api/chat (SSE)
apps/web/          Interfaz React: panel + chat con agentes
data/              Generador y datos semilla del negocio piloto
docs/              Visión, arquitectura, división del equipo, deploy, guion del pitch
```

## Documentación

| Documento                                     | Para qué                                    |
| --------------------------------------------- | ------------------------------------------- |
| [00 — Visión](docs/00-vision.md)              | Problema, usuario, propuesta de valor       |
| [01 — Arquitectura](docs/01-arquitectura.md)  | Cómo funciona el loop de agentes            |
| [02 — División del equipo](docs/02-equipo.md) | **Quién hace qué durante las 24h**          |
| [03 — Agentes](docs/03-agentes.md)            | Cómo agregar o modificar un agente          |
| [04 — Datos](docs/04-datos.md)                | Modelo de datos y cómo conectar datos reales |
| [05 — Deploy](docs/05-deploy.md)              | Netlify + Render paso a paso                |
| [06 — Demo y pitch](docs/06-demo-pitch.md)    | Guion de 4 minutos y plan B                 |
| [07 — Convenciones](docs/07-convenciones.md)  | Git, estilo, cómo no pisarse                |

## Créditos y datos

Los datos incluidos en `data/seed/` son de un negocio de referencia generados con
`data/generate.mjs` para desarrollo. **Para la demo final se usan datos reales del comercio piloto**
(ver [docs/04-datos.md](docs/04-datos.md)). El tipo de cambio paralelo es un dato de mercado; la
fuente en vivo se documenta en el mismo archivo.

## Licencia

MIT.
