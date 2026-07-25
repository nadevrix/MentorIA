# 08 — Motor de hallazgos y simulador

Los dos módulos que separan a PyME AI de un chatbot con acceso a la base de datos.

---

## 1. Por qué existe el motor de hallazgos

Un chatbot espera la pregunta. El problema es que el dueño de una PyME **no sabe qué
preguntar**: no se le ocurre consultar la rotación de inventario hasta que ya tiene Bs 47.000
dormidos en el estante.

El motor invierte la relación. Corre solo, detecta el problema y llega con la acción:

```
Chatbot          usuario pregunta → agente responde
Motor            sistema detecta → prioriza por Bs → propone acción → agente profundiza
```

`packages/core/src/insights.ts` · endpoint `GET /api/insights`

### Sin modelo, a propósito

La detección es **determinista y estadística**. No pasa por Claude.

| | Detección | Interpretación |
|---|---|---|
| Quién | `insights.ts` | Agente Claude |
| Costo | 0 tokens | Tokens normales |
| Latencia | milisegundos | segundos |
| Reproducible | Siempre igual | Varía en redacción |

Esto no es una optimización de costos: es la regla que hace confiable al producto. **Ningún
número que ve el dueño sale de un modelo.** El agente entra después, y sólo para explicar,
priorizar en lenguaje natural y redactar la acción. Si mañana el modelo cambia, los números
del panel no se mueven.

---

## 2. Anatomía de un hallazgo

```ts
interface Insight {
  id: string;          // clave estable: mismo problema ⇒ misma clave entre corridas
  tipo: string;        // 'precio_bajo_costo' | 'stock_critico' | ...
  severidad: 'critica' | 'alta' | 'media' | 'baja';
  titulo: string;      // una línea, con el número adentro
  detalle: string;     // 2-3 frases: qué pasa, por qué, qué implica
  impactoBob: number;  // plata en juego — el criterio de orden
  impactoNota: string; // cómo se calculó, en una línea
  agenteId: string;    // qué agente puede resolverlo
  pregunta: string;    // pregunta lista para mandar al chat
  entidades?: { productos?: string[]; clientes?: string[] };
}
```

Tres campos hacen el trabajo pesado:

- **`impactoBob`** — todo hallazgo se traduce a bolivianos. "El margen cayó 3,2 pp" no mueve a
  nadie; "estás perdiendo Bs 8.400 al mes" sí. Sin un número en Bs, el hallazgo no entra.
- **`impactoNota`** — la fórmula en una línea, visible en la interfaz. El dueño puede
  desconfiar del número; que pueda auditarlo es lo que construye la confianza.
- **`pregunta`** — cada hallazgo es un botón que abre el chat del agente correcto con la
  pregunta ya escrita. Un hallazgo sin acción es ruido.

### Orden: urgencia primero, plata después

```ts
insights.sort(
  (a, b) => SEVERITY_RANK[a.severidad] - SEVERITY_RANK[b.severidad] || b.impactoBob - a.impactoBob,
);
```

Deliberadamente **no** se ordena sólo por monto. Vender bajo costo de reposición es
estructuralmente más urgente que un quiebre de stock aunque el quiebre mueva más plata: uno
descapitaliza en silencio, el otro se nota el mismo día. Dentro de cada nivel de severidad, la
plata manda.

---

## 3. Los ocho detectores

Cada detector es una función pura `(World) => Insight[]`. Ninguno conoce a los demás.

| Tipo | Severidad | Dispara cuando | Impacto en Bs |
|---|---|---|---|
| `precio_bajo_costo` | crítica | `precio < costo de reposición hoy` | Pérdida × unidades vendidas en 30 d |
| `cuenta_vencida` | crítica | Obligación pasó su vencimiento | Monto vencido |
| `dolar_subio` | alta | Paralelo +3% en 30 d | Cuánto más cuesta reponer el stock importado |
| `caida_ventas` | alta | Ventas 30 d caen >15% vs. 30 d previos | Diferencia de facturación |
| `margen_erosionado` | alta | Margen real < 20% pero aún positivo | Lo que falta para llegar al margen objetivo |
| `stock_critico` | alta | Stock ≤ punto de reposición **y** el producto rota | Venta que se pierde en 30 d |
| `capital_dormido` | alta/media | Sin venta en 60 d con stock > 0 | Capital inmovilizado a costo de reposición |
| `cuenta_por_vencer` | media | Vence en ≤ 7 días | Monto por vencer |
| `cliente_en_riesgo` | media | ≥2 compras previas y 45 d sin comprar | Una compra promedio por cliente |

Dos decisiones que importan:

- **`stock_critico` exige rotación.** Quedarse sin un producto que nadie compra no es un
  problema. Filtrar por `demanda > 0` es lo que evita que la lista se llene de ruido.
- **Las cuentas por pagar no suman al total.** `totalImpactoBob` excluye `cuenta_vencida` y
  `cuenta_por_vencer`: son calendario, no pérdida. Sumarlas inflaría la cifra principal y
  volvería mentiroso el titular.

### Agregar un detector

Escribí la función, agregala al arreglo, listo:

```ts
function detectAlgoNuevo({ products, sales, fx, t }: World): Insight[] {
  // ...cálculo determinista...
  return [{ id: `algo-nuevo:${n}`, tipo: 'algo_nuevo', severidad: 'media', /* ... */ }];
}

const DETECTORS = [ /* ...existentes..., */ detectAlgoNuevo ];
```

Reglas para que el hallazgo sea usable:

1. `id` estable — misma situación, misma clave. Es lo que permite deduplicar entre corridas y,
   más adelante, recordar que el usuario ya lo descartó.
2. `impactoBob` real, nunca inventado. Si no se puede cuantificar, el hallazgo no va.
3. `impactoNota` explicando la fórmula en una línea.
4. `pregunta` que un dueño escribiría, no jerga interna.

Los umbrales viven en `DEFAULT_THRESHOLDS` y se pueden sobreescribir por negocio:

```ts
await buildInsights(ctx, { margenMinimoPct: 25, diasSinRotacion: 90 });
```

---

## 4. Simulador de escenario cambiario

`packages/core/src/simulate.ts` · `POST /api/simulate` · tool `simulate_scenario`

"¿Qué pasa si el dólar llega a 15?" es la pregunta que un importador boliviano se hace todas
las semanas y que ningún ERP le responde. El simulador la contesta sobre el **catálogo
completo**, no producto por producto:

| Salida | Qué responde |
|---|---|
| `productosBajoCosto` | Cuántos productos quedan bajo costo, antes y después |
| `margenPromedioPct` | Cuánto margen se evapora |
| `utilidadMensualBob` | Cuánta utilidad mensual se pierde al ritmo de venta actual |
| `capitalAdicionalBob` | Cuántos Bs extra hacen falta para reponer el mismo inventario |
| `ajustePromedioNecesarioPct` | Cuánto habría que subir precios para sostener el margen |
| `productos[]` | Detalle por SKU, ordenado por urgencia |

### Verificación de identidad

La prueba que hay que correr después de tocar este archivo: **simular al tipo de cambio actual
debe dar delta cero.**

```bash
curl -s localhost:8787/api/simulate -H 'content-type: application/json' \
  -d '{"tipoCambioSimulado": 14.76}' | jq '.utilidadMensualBob.delta, .capitalAdicionalBob'
# → 0
# → 0
```

Si eso no da cero, hay un error de signo o de conversión en algún lado.

### Simulador vs. `suggest_price`

Se confunden fácil, y el prompt del agente de precios lo aclara explícitamente:

| | `simulate_scenario` | `suggest_price` |
|---|---|---|
| Pregunta | "¿y si el dólar sube a X?" | "¿a cuánto dejo estos productos hoy?" |
| Alcance | Negocio completo | Producto por producto |
| Tipo de cambio | Hipotético | El de hoy |
| Sirve para | Decidir si comprar por adelantado | Ejecutar el ajuste de precios |

El agente arranca por el escenario y recién después baja al detalle.

---

## 5. El resumen del día

`packages/core/src/brief.ts` · `GET /api/brief` (SSE)

Cierra el ciclo: los detectores encuentran y cuantifican, el Director redacta.

```
insights.ts (determinista)  →  brief.ts (Claude, sin tools)  →  3 frases en streaming
```

**El modelo no tiene herramientas.** Recibe los hallazgos ya calculados en el mensaje de usuario
y su único trabajo es redactarlos. No puede consultar nada más, así que no puede aparecer con un
número que no salió del motor determinista. Es la misma regla del resto del sistema, aplicada de
la forma más estricta posible: en vez de pedirle al prompt que no invente, se le saca la
capacidad de hacerlo.

Detalles de implementación que importan:

- **`effort: 'low'`** — redactar tres frases sobre datos ya calculados no requiere razonamiento
  profundo, y este texto es lo primero que aparece en pantalla. La latencia manda.
- **`cache_control` en el system prompt** — es idéntico en cada corrida; cachearlo abarata el
  resumen diario cuando corre por cron para muchos negocios.
- **Emite los mismos `AgentEvent` que `runAgent`** — el frontend reutiliza el parser de SSE que
  ya tenía para el chat, sin plumbing nuevo.
- **Degrada en silencio** — si falta `ANTHROPIC_API_KEY`, el endpoint responde 500 y el componente
  se oculta. Los hallazgos deterministas de abajo ya cuentan la historia completa; una demo no se
  cae por no tener llave.

## 6. Cómo se ve en la interfaz

```
┌─ QUÉ RESOLVER HOY ──────────── 7 hallazgos · Bs 64.254 en juego ─┐
│                                                                  │
│ ▌🔴 2 productos se venden bajo costo de reposición    Bs 51      │
│ ▌   Con el dólar a Bs 14,76, reponer estos productos            │
│ ▌   cuesta más de lo que cobrás...                              │
│ ▌   [ ¿Qué precios tengo que subir y a cuánto? ]                │
│                                                                  │
│ ▌🟡 3 productos que rotan están por agotarse      Bs 41.790     │
│ ▌   [ ¿Qué repongo y conviene comprar ahora o esperar? ]         │
└──────────────────────────────────────────────────────────────────┘
```

El botón de cada hallazgo lleva al agente que lo puede resolver **con la pregunta ya hecha**.
`App.tsx` remonta el chat con `key` para que el estado arranque limpio y no queden closures
viejos de la conversación anterior.

El simulador es un deslizador con recálculo en vivo (debounce de 180 ms, petición anterior
abortada con `AbortController`) y termina en un botón que manda el escenario al agente de
precios para que diga qué hacer.

---

## 7. Qué falta

- **Persistencia de hallazgos.** Hoy se recalculan en cada request. Para "no me muestres más
  este tipo de alerta" hace falta guardarlos con su `id` y un estado (nuevo/visto/descartado).
- **Detección de anomalías por serie temporal.** `caida_ventas` compara dos ventanas fijas.
  Lo correcto es mediana + MAD sobre 90 días desestacionalizados: una venta mayorista atípica
  hoy destruye el promedio y dispara una alerta falsa.
- **Push proactivo.** El motor está listo para correr en un cron y mandar el resumen por
  WhatsApp a las 8:00. Hoy sólo responde cuando el frontend pregunta.
