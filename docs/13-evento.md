# 13 — El evento: reglas, criterios y entregables

Todo lo que el jurado espera y todo lo que puede descalificarnos, en un solo lugar.
Fuente: materiales oficiales del Cursor Buildathon Bolivia 2026.

> ⚠️ **Ante cualquier duda, el reglamento oficial tiene precedencia** sobre este resumen y sobre
> cualquier otro material del evento. Este documento existe para no tener que abrir cinco páginas
> a las 4 de la mañana.

---

## Lo esencial

| | |
| --- | --- |
| Evento | Cursor Buildathon Bolivia 2026 — hackathon presencial de 24 horas |
| Fechas | 25 y 26 de julio de 2026 |
| Lugar | UTEPSA — Universidad Tecnológica Privada de Santa Cruz |
| Organiza | Cursor Bolivia · Community Leads: Diego Oliver y Silvia Irene Colque |
| Participantes | 100 builders seleccionados |
| Equipos | De 2 a 4 personas. No se permiten de 1 ni de 5+ |
| **Nuestro track** | **Bolivia Agents** (la elección es final, no se puede cambiar) |

---

## ⏰ El deadline — atención a esto

Los materiales del evento dan **dos horas distintas**:

| Fuente | Hora |
| --- | --- |
| Guía del track Bolivia Agents | **08:30** — "sin extensiones" |
| Reglamento oficial y agenda | **09:00** — "en punto", corte de código |

El reglamento dice tener precedencia, pero **la diferencia son 30 minutos y nadie quiere descubrir
cuál manda a las 08:45**. Trabajar con las 08:30 como hora real de entrega.

> **Código commiteado después del corte no será considerado por el jurado.**
> Los equipos que no entreguen a tiempo no participan del Demo Day.

---

## Criterios de evaluación

Cada juez puntúa de 1 a 10 por criterio. Tres jueces externos. Sus decisiones son finales.

| Criterio | Peso | Qué mira |
| --- | --- | --- |
| Claridad del problema y caso de uso | **20%** | ¿Qué resuelve? ¿Para quién en Bolivia/LatAm? ¿Por qué no estaba resuelto? |
| Nivel de ejecución técnica | **25%** | ¿Funciona de punta a punta? ¿Arquitectura razonable? ¿Escala más allá del demo? |
| Uso significativo de IA y agentes | **20%** | ¿Toma decisiones reales? ¿Usa herramientas? ¿El resultado es accionable? |
| Calidad de la demo y UX | **15%** | ¿Se entiende sin explicación larga? ¿Corre en vivo sin fricción? |
| Potencial real y originalidad | **20%** | ¿Tiene vida más allá del hackathon? ¿Hay mercado? ¿Es distinto? |

Dónde apuntar cada uno en nuestro caso: `docs/10-prioridades.md`.

---

## Entregables obligatorios

- [ ] **Producto desplegado y accesible** — URL funcional o API documentada, sin instalación ni cuenta especial
- [ ] **Demo en vivo durante el pitch** — los videos pregrabados complementan, no sustituyen
- [ ] **Repositorio público con README claro** — setup en menos de 5 pasos
- [ ] **Caso de uso definido** — quién lo usa, qué problema resuelve, por qué Bolivia/LatAm
- [ ] **Slides del pitch** — máximo 4 minutos de presentación
- [ ] **Formulario de entrega** en el portal del participante
- [ ] **Fuentes de datos citadas**

Formato del pitch: **4 minutos + 2 minutos de preguntas**. Al menos un integrante presente.

> Si la demo falla en vivo se pueden mostrar capturas o código: **impacta la puntuación pero no
> descalifica**. Por eso hay plan B en `docs/06-demo-pitch.md`.

---

## ❌ Lo que NO se acepta

Del track Bolivia Agents, textual:

- Chatbot genérico sin caso de uso claro
- **Demo que solo funciona con datos hardcodeados**
- Copia de un producto existente sin diferenciación para Bolivia
- Wrapper de API con un prompt, sin decisiones reales
- **Producto que solo corre en la laptop del equipo**
- Ideas genéricas sin valor claro para el mercado boliviano

> Los dos en negrita son los que nos aplican directamente y están en el backlog como críticos:
> conseguir **datos reales de un comercio** y tener el **deploy público** (`docs/02-equipo.md`).

Un agente ≠ un chatbot con prompt largo. Nuestra defensa es la traza de herramientas visible en
vivo: el modelo decide qué consultar y en qué orden.

---

## Motivos de descalificación

- Código previo no declarado — los proyectos deben iniciarse durante el evento
- Plagio o trabajo ajeno presentado como propio
- Violación grave del código de conducta
- No entregar a tiempo
- Venta o cesión del cupo o de créditos de sponsors
- Que el jurado detecte que el proyecto fue construido principalmente por un mentor

Sobre los mentores: **ayudan, no construyen.** No pueden escribir código sustancial ni tomar
decisiones de arquitectura por el equipo.

Sobre la IA: **se fomenta usarla** (Cursor, Claude, Gemini). El jurado evalúa el producto, no el
proceso — pero **hay que poder demostrar comprensión del código en el Q&A**.

**No subir secretos al repositorio.** Nuestro chequeo:
`git log -p | grep -iE "sk-ant|AIza|npg_"`

---

## Agenda

**Sábado 25**

| Hora | |
| --- | --- |
| 08:00 | Acreditación |
| 08:30 | Inauguración: bienvenida, tracks y reglas |
| 09:00 | **Arranca el hackathon** |
| 12:30 | Almuerzo |
| 19:00 | Cena |
| 22:00 | Coffee break de medianoche |

**Domingo 26**

| Hora | |
| --- | --- |
| 07:00 | Desayuno |
| 09:00 | **Corte de código** + foto grupal |
| 10:00 | Pitch & Demos |
| 13:00 | Premios y cierre *(el reglamento menciona 14:00; confirmar en el momento)* |

---

## Premios y desafíos opcionales

| Premio | Detalle |
| --- | --- |
| Gran premio Buildathon | Mejor proyecto general, sin importar el track |
| Mejor track — Bolivia Agents | Agente más útil, con decisiones reales y demo en producción |
| **Best Use of Zavu** | **USD 500** — mejor uso de su mensajería multicanal |
| Inversiones con la API de Wallbit | Producto o feature sobre inversiones, ahorro o manejo de dólares |
| Mención — Mejor impacto social | Educación, salud, comunidad, ciencia o **PyMEs** |

**Los desafíos no son un track aparte**: seguimos en Bolivia Agents y marcamos la casilla en el
formulario de entrega si aplicamos.

### Cuáles nos convienen

**Zavu (USD 500) — el más alcanzable.** Canales: Telegram, SMS, Email y Voice (no WhatsApp).
Casos que premia: notificaciones y alertas automatizadas, seguimiento de clientes, automatización
de procesos. ✅ Implementado: la API corre el motor determinista de hallazgos cada día a las 08:00,
elige el más urgente y lo envía por Telegram mediante Zavu, con deduplicación diaria y disparo
manual para la demo. Criterios: **uso real en la demo, no sólo mención**.

**Mención de impacto social — marcarla.** PyMEs es un ámbito explícito de la mención y es
literalmente nuestro usuario. No cuesta nada más que tildar la casilla.

**Wallbit — no forzarlo.** Es para inversiones, ahorro o manejo de dólares con su API. Meterlo
sin necesidad real diluye el producto; el track penaliza justamente eso.

---

## Sponsors y créditos

Diez sponsors: **Zavu, Adaption, Wallbit, exa, Render, Wispr Flow, Firecrawl, Netlify,
ElevenLabs, fal.ai**.

Herramientas recomendadas por el track y qué usamos:

| Herramienta | Para qué | ¿La usamos? |
| --- | --- | --- |
| **Cursor** | Construir y refactorizar con IA | ✅ |
| **Render** | Deploy del backend y APIs | ✅ API y frontend |
| **Netlify** | Deploy del frontend | ⏳ `netlify.toml` listo para cuando lleguen créditos |
| **Firecrawl** | Scraping estructurado | ✅ `FirecrawlFxProvider` |
| **Zavu** | Mensajería multicanal | ✅ alerta diaria por Telegram + envío manual para la demo |
| Exa | Búsqueda semántica | ❌ |
| ElevenLabs / Wispr Flow | Voz | ❌ |
| fal.ai | Imágenes y video | ❌ (el módulo de marketing usa otro proveedor) |

> **Ningún sponsor da tokens de un LLM conversacional.** Ni Gemini ni Claude son sponsors: el
> motor de agentes corre con cuenta propia. Ver la advertencia de cuota en `CLAUDE.md`.

**Los créditos son personales e intransferibles.** Prohibida su venta, cesión o reventa; el abuso
implica revocación y descalificación.

---

## Colaboración con el Bolivia Data Track

Está permitido y recomendado usar datasets que produzcan equipos del track de datos, **como
insumo, no como producto terminado**. Si usamos alguno hay que coordinar con ese equipo, citar la
fuente y documentar qué construye nuestro agente encima. Cómo integrarlo sin romper nada:
`docs/04-datos.md`.

---

## Checklist final antes de entregar

- [ ] Las dos URLs responden desde un celular con datos móviles (no el WiFi del venue)
- [ ] `git log -p | grep -iE "sk-ant|AIza|npg_"` no devuelve nada
- [ ] README con setup en menos de 5 pasos y las URLs visibles
- [ ] Fuentes de datos citadas en `docs/04-datos.md`
- [ ] Slides listas, pitch cronometrado bajo 4 minutos
- [ ] Formulario del portal enviado **antes de las 08:30**
- [ ] Casillas marcadas: desafío Zavu (si quedó implementado) y mención de impacto social
- [ ] Plan B en capturas, por si falla el WiFi
