# 04 — Datos

## Convención de moneda (leer antes de tocar cualquier cálculo)

| Sufijo  | Significa                                                    |
| ------- | ------------------------------------------------------------ |
| `...Usd` | Dólares. Solo el costo de compra al proveedor.                |
| `...Bob` | Bolivianos. Todo lo demás: precios, ventas, gastos, márgenes. |

**Regla central del producto:** el costo relevante de un producto **no** es lo que se pagó, sino lo que
costaría reponerlo hoy.

```
costoReposicionBob = costUsd × (imported ? paralelo_hoy : oficial)
margenRealPct      = (precioBob − costoReposicionBob) / precioBob × 100
```

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
| `FxRate`   | `official`, `parallel`, `date`, `source`                                  |

`purchaseFxRate` es el campo clave: sin él no se puede contrastar el margen de entonces con el de hoy.

## Datos semilla (desarrollo)

`data/seed/` contiene el negocio de referencia **Importadora Ñuflo** — electrónica y accesorios en
Santa Cruz. Generado por `data/generate.mjs`, determinista, con fechas relativas a hoy:

```bash
node data/generate.mjs
```

El dataset está calibrado para que la demo tenga historia: productos comprados con el dólar entre
10.3 y 13.8 Bs, paralelo actual ~14.76 Bs, lo que deja **2 productos vendiéndose bajo costo de
reposición y 7 con margen erosionado**, más una cuenta vencida y tres productos por agotarse.

Para una demo con fecha fija: `DEMO_TODAY=2026-07-26` en el entorno.

> ⚠️ **Estos datos son de referencia, no de un comercio real.** El track descalifica demos que solo
> funcionan con datos hardcodeados. Antes del pitch hay que apuntar a datos reales — es la
> prioridad #2 del backlog (`docs/02-equipo.md`).

## Conectar datos reales

Implementá la interfaz y enchufala en `createContext()` (`packages/core/src/index.ts`). No hay que
tocar ninguna herramienta ni ningún prompt.

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

### Camino recomendado por esfuerzo

| Fuente | Esfuerzo | Cuándo |
| ------ | -------- | ------ |
| Export de Excel/CSV de un comercio → convertir a `data/seed/` | 2 h | **Hacé esto primero.** Datos reales con el mínimo de código |
| Supabase (Postgres free tier) | 4 h | Si se quiere persistencia y multiusuario |
| API REST de Odoo (solo lectura) | 6 h | Demuestra integración con el ERP que ya usa el comercio |

Si un campo no existe en la fuente real (típicamente `purchaseFxRate`), **no lo inventes**: hacelo
opcional y que las herramientas lo omitan del cálculo comparativo, informándolo en el campo `nota`.

## Tipo de cambio

- **Oficial:** 6.96 Bs/USD, tipo de referencia del BCB.
- **Paralelo:** el que efectivamente paga un importador. Es un mercado informal, así que no hay una
  única fuente oficial — se usa un promedio de referencias públicas.

El histórico de `data/seed/fx.json` es una serie de referencia generada para desarrollo.
**Al conectar la fuente en vivo, documentá acá la URL exacta y la fecha de captura** — el track exige
citar fuentes, y el jurado lo va a preguntar.

```
Fuente en vivo: https://boliviabolivar.com
Método:         scraping con Firecrawl (FirecrawlFxProvider), caché 15 min, fallback automático a SeedFxProvider
Capturado:      En tiempo real vía API de Firecrawl con respaldo estático en data/seed/fx.json
```

## Colaboración con el Bolivia Data Track

Está permitido y recomendado consumir datasets de equipos del track de datos (índices de precios,
series cambiarias, datos de comercio exterior). Si se usa alguno:

1. Citá el equipo y el dataset en esta sección y en el README.
2. Documentá **qué construye nuestro agente encima** de ese dato — el track lo exige explícitamente.
3. Consumilo detrás de la interfaz `DataSource` o `FxProvider`, nunca directo desde una herramienta.
