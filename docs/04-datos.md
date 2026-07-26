# 04 — Datos

## Convención de moneda (leer antes de tocar cualquier cálculo)

| Sufijo  | Significa                                                    |
| ------- | ------------------------------------------------------------ |
| `...Usd` | Dólares. Solo el costo de compra al proveedor.                |
| `...Bob` | Bolivianos. Todo lo demás: precios, ventas, gastos, márgenes. |

**Regla central del producto:** el costo relevante de un producto **no** es lo que se pagó, sino lo que
costaría reponerlo hoy.

```
costoReposicionBob = costUsd × (imported ? tipoDeCambioHoy : purchaseFxRate)
margenRealPct      = (precioBob − costoReposicionBob) / precioBob × 100
```

Desde el 29/06/2026 Bolivia tiene **un solo Tipo de Cambio Oficial que flota**. Por eso `FxRate`
guarda `rate` y `regimen` (`fijo` | `flexible`) en vez del viejo par `official`/`parallel`: el
`regimen` marca el quiebre para no comparar peras con manzanas al calcular variaciones.

Si el margen real es negativo, cada venta reduce el capital del negocio aunque la caja muestre
ingresos. Esa es la métrica que ningún ERP disponible en el país calcula, y es el corazón del producto.

## Modelo de dominio

Definido con Zod en `packages/core/src/types.ts` — la validación y los tipos salen del mismo lugar.

| Entidad    | Campos que importan                                                       |
| ---------- | ------------------------------------------------------------------------- |
| `Product`  | `costUsd`, `purchaseFxRate` (a qué dólar se compró), `priceBob`, `stock`, `reorderPoint`, `imported` |
| `Sale`     | `date`, `items[]`, `totalBob`, `channel` (tienda · whatsapp · facebook · tiktok · mayoreo) |
| `Customer` | `lastPurchaseDate`, `totalSpentBob`, `purchaseCount`, `segment`           |
| `Expense`  | `category`, `amountBob`, `dueDate`, `paid` — las no pagadas con vencimiento son cuentas por pagar |
| `FxRate`   | `rate`, `regimen` (`fijo` o `flexible`), `date`, `source`                  |

`purchaseFxRate` es el campo clave: sin él no se puede contrastar el margen de entonces con el de hoy.

## Datos semilla (desarrollo)

`data/seed/` contiene el negocio de referencia **Importadora Ñuflo** — electrónica y accesorios en
Santa Cruz. Generado por `data/generate.mjs`, determinista, con fechas relativas a hoy:

```bash
node data/generate.mjs      # productos, ventas, clientes y gastos
node data/fetch-fx.mjs      # actualiza la serie desde la fuente configurada
```

**`generate.mjs` no toca `fx.json` a propósito.** La cotización se actualiza por separado con
`fetch-fx.mjs`; mezclarla con el generador del negocio borraría su trazabilidad.

El dataset está calibrado contra el régimen real: los productos se compraron con el dólar entre
7,6 y 9,9 Bs (lo que se pagaba antes de la unificación) y hoy se reponen a 11,37, lo que deja
**3 productos vendiéndose bajo costo de reposición y 6 con margen erosionado**, más una cuenta
vencida y tres productos por agotarse. El peor pasó de 27% de margen a −9%.

Para una demo con fecha fija: `DEMO_TODAY=2026-07-26` en el entorno.

> ⚠️ **Estos datos son de referencia, no de un comercio real.** El track descalifica demos que solo
> funcionan con datos hardcodeados. Antes del pitch hay que apuntar a datos reales — es la
> prioridad #2 del backlog (`docs/02-equipo.md`).

## Fuentes disponibles

`createContext()` (`packages/core/src/index.ts`) selecciona la fuente base:

- `DATA_SOURCE=seed`: JSON de `data/seed/`.
- `DATA_SOURCE=postgres` o `neon`: `PostgresDataSource` con `DATABASE_URL`.
- `DATA_SOURCE=supabase`: reservado, todavía cae a seed con una advertencia.

La fuente base se envuelve en `OverlayDataSource`. La interfaz puede importar CSV de productos,
ventas, clientes o gastos y reemplazar cada entidad por separado. Ese overlay vive en memoria y se
pierde al reiniciar la API; no es persistencia.

El avance de formalización usa otra tienda porque no forma parte de `DataSource`: con
`DATABASE_URL` se guarda en la tabla `compliance`; sin conexión queda en memoria y también se pierde
al reiniciar.

Para una fuente nueva, implementá la interfaz y enchufala en `createContext()`. No hay que tocar
herramientas ni prompts.

```ts
export class MiFuente implements DataSource {
  readonly name = 'excel-comercio-piloto';
  async products() { /* ... */ }
  async sales() { /* ... */ }
  async customers() { /* ... */ }
  async expenses() { /* ... */ }
  async fxHistory() { /* ... */ }
}
```

### Camino recomendado

| Fuente | Esfuerzo | Cuándo |
| ------ | -------- | ------ |
| CSV desde la interfaz | Bajo | Validar el formato; se pierde al reiniciar |
| Dataset autorizado en `data/seed/` | Bajo | Demo reproducible sin base |
| PostgreSQL (Neon, Render o Supabase) | Medio | Persistencia de las entidades base |
| API REST de Odoo (solo lectura) | Alto | Integración futura con un ERP existente |

Si un campo no existe en la fuente real (típicamente `purchaseFxRate`), **no lo inventes**: hacelo
opcional y que las herramientas lo omitan del cálculo comparativo, informándolo en el campo `nota`.

## Tipo de cambio

- **Hasta el 28/06/2026:** tipo oficial fijo en 6,96 Bs/USD más un paralelo que se movía aparte.
- **Desde el 29/06/2026:** un solo Tipo de Cambio Oficial que flota y se actualiza a diario
  (Resolución Ministerial 245/2026 y Resolución de Directorio 88/2026 del BCB). Al 25/07/2026
  está en Bs 11,37. El paralelo sigue existiendo (~Bs 11,69) pero la brecha es de ~2%.

El histórico de `data/seed/fx.json` es una captura versionada. Cada punto conserva `source`.
**Al conectar la fuente en vivo, documentá acá la URL exacta y la fecha de captura** — el track exige
citar fuentes, y el jurado lo va a preguntar.

```
Actualizador del histórico: https://dolarbluebolivia.click/
Fuente en vivo de la API:   https://boliviabolivar.com
Método en vivo:             scraping con Firecrawl, caché 15 min y fallback a SeedFxProvider
Respaldo:                   data/seed/fx.json
```

El proveedor en vivo es una referencia de mercado, no una conexión directa al BCB. La UI y las
respuestas deben mostrar el campo `source` que acompaña cada cotización.

## Colaboración con el Bolivia Data Track

Está permitido y recomendado consumir datasets de equipos del track de datos (índices de precios,
series cambiarias, datos de comercio exterior). Si se usa alguno:

1. Citá el equipo y el dataset en esta sección y en el README.
2. Documentá **qué construye nuestro agente encima** de ese dato — el track lo exige explícitamente.
3. Consumilo detrás de la interfaz `DataSource` o `FxProvider`, nunca directo desde una herramienta.
