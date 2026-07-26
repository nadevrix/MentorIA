# 12 — Infraestructura: por qué tres servicios y no uno

Tres piezas, tres servicios, cada uno haciendo lo que sabe hacer:

```
Netlify  →  la interfaz          archivos estáticos servidos desde el borde
Render   →  la API con agentes   un servidor Node prendido, sin límite de tiempo
Neon     →  la base de datos     Postgres gestionado
```

Netlify y Render son **sponsors del Buildathon**, así que además de encajar técnicamente
suman en el uso de herramientas del evento.

---

## Qué es cada uno, en una frase

| Servicio | Qué es realmente |
| --- | --- |
| **Netlify** | Un almacén de archivos con red de distribución global. Guarda el HTML, CSS y JS ya compilados y los sirve desde el servidor más cercano al visitante. No ejecuta tu backend. |
| **Render** | Una computadora en la nube con tu servidor Node prendido, esperando pedidos. Ejecuta código de verdad, sin límite de duración. |
| **Neon** | Postgres gestionado. Sólo guarda datos; no sirve páginas ni corre tu código. |

---

## ¿Por qué no todo en Netlify?

Netlify **sí** puede correr backend, pero con un límite duro: **las funciones se cortan a los
10 segundos**.

El loop de un agente tarda más que eso:

```
pregunta → get_fx_rate → analyze_margins → suggest_price → respuesta
                    4 a 13 segundos, más el arranque
```

Y hay algo peor que la duración: **el chat transmite la respuesta mientras se genera** (por eso se
ven las trazas de herramientas en vivo). Eso necesita una conexión HTTP abierta todo el tiempo —
Server-Sent Events.

Netlify tiene funciones largas, de hasta 15 minutos, pero contestan `202 Recibido` de inmediato y
trabajan por detrás. **No pueden ir mandando texto al navegador**, que es justo lo que hace falta.

> Si algún día el chat dejara de transmitir en vivo y se volviera pregunta-respuesta simple,
> Netlify Functions podría alcanzar. Hoy no.

## ¿Por qué no todo en Render?

Render puede servir archivos estáticos, sí. Pero el free tier **duerme el servicio tras ~15 minutos
sin tráfico** y tarda 30–60 segundos en despertar.

Si la interfaz viviera ahí, **el sitio entero estaría dormido**, no sólo la API. El jurado abre la
URL y mira una pantalla en blanco durante casi un minuto.

Con el reparto actual, el frontend en Netlify **nunca duerme** (son archivos estáticos, siempre
disponibles). Lo único que puede estar frío es la API, y eso se resuelve abriendo `<API>/health`
cinco minutos antes del pitch.

| | Netlify (frontend) | Render (frontend) |
| --- | --- | --- |
| ¿Duerme? | No | Sí, a los 15 min |
| Primera carga en frío | Instantánea | 30–60 s |
| Distribución | Global, desde el borde | Una sola región |

## ¿Por qué no la base de datos en Render?

Se podría — Render ofrece Postgres. Pero:

| | Neon | Render Postgres |
| --- | --- | --- |
| Estado hoy | Creada, conecta, con el esquema cargado | Habría que crearla y migrar todo |
| Free tier | No expira | Expira a los ~30 días |
| Ganancia de mover | **Ninguna** | — |

Mover la base ahora cuesta una hora y no aporta nada. Lo único que importa es la **cercanía
geográfica**: Neon está en `us-east-2` (Ohio), así que `render.yaml` fija la API en Ohio también.
Si estuvieran en regiones lejanas, cada consulta pagaría el viaje de ida y vuelta, y el panel hace
varias por carga.

---

## Costo

Los tres tienen free tier suficiente para el hackathon:

| Servicio | Free tier | Riesgo real |
| --- | --- | --- |
| Netlify | Archivos estáticos, generoso | Ninguno |
| Render | 750 h/mes, duerme a los 15 min | El arranque en frío en el pitch |
| Neon | No expira | Ninguno a esta escala |

**El costo que sí importa no es de hosting: es el del modelo.** El free tier de Gemini permite
~5 requests por minuto y 20 por día, y cada pregunta al agente consume 3 o 4. Ver `CLAUDE.md`
para el detalle y `docs/02-equipo.md` para el estado de ese pendiente.

## El arranque en frío, en detalle

Es el único punto de fricción del reparto y conviene entenderlo:

1. Nadie usa la API por 15 minutos → Render la duerme.
2. Llega el primer pedido → tarda 30–60 s en levantarse.
3. A partir de ahí responde normal hasta el próximo período de inactividad.

Mitigaciones, en orden:

1. **Abrir `<API>/health` cinco minutos antes de subir al escenario.** Gratis y suficiente.
2. Un ping cada 10 minutos durante el Demo Day desde cualquier servicio de uptime.
3. En el frontend, mostrar "despertando el servidor…" en lugar de un error.

## Variables de entorno: quién necesita qué

**Render (la API):**

| Variable | Para qué |
| --- | --- |
| `LLM_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL` | El motor de agentes |
| `ANTHROPIC_API_KEY` | Respaldo: si Gemini rate-limitea, se cambia `LLM_PROVIDER` sin redeploy |
| `CORS_ORIGIN` | La URL de Netlify, **sin barra final** |
| `DATA_SOURCE`, `DATABASE_URL` | Vacías = datos semilla. `postgres` + cadena = Neon |
| `FX_SOURCE`, `FIRECRAWL_API_KEY` | Tipo de cambio en vivo |

**Netlify (la interfaz):**

| Variable | Para qué |
| --- | --- |
| `VITE_API_URL` | La URL de Render, **sin barra final** |

⚠️ Las variables `VITE_*` se inyectan **en tiempo de build**. Si cargás la variable después del
primer deploy, hay que **redesplegar**: si no, el sitio sigue apuntando a `localhost` y no se nota
hasta abrir el chat.

## Orden de despliegue

Siempre **API primero**, porque el frontend necesita su URL para compilarse:

1. Render → obtenés `https://TU-API.onrender.com`
2. Verificás `/health`
3. Netlify con `VITE_API_URL` apuntando ahí
4. Volvés a Render y ajustás `CORS_ORIGIN` a la URL de Netlify

El paso a paso completo está en `docs/05-deploy.md`.
