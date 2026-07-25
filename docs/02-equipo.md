# 02 — Backlog de trabajo

**Cómo trabajamos:** cada persona construye lo que ve que le falta al producto, en su propia rama.
Una persona integra: revisa las ramas, elige qué sirve y lo mergea a `main`. No hay carpetas
asignadas. Flujo de git y las dos reglas en `docs/07-convenciones.md`; el prompt para arrancar en
`docs/09-onboarding.md`.

Este documento no reparte tareas: es el **menú de lo que hace falta**, ordenado por lo que más
suma al puntaje. Si no sabés por dónde empezar, empezá por arriba. Antes de agarrar algo grande,
avisá en el grupo para que no lo hagan dos personas a la vez.

Razonamiento completo de las prioridades en `docs/08-estrategia.md`.

---

## 🔴 Crítico — sin esto no competimos

### 1. Deploy en Netlify + Render

Un producto perfecto sin URL pública no compite. La configuración ya está escrita
(`netlify.toml`, `render.yaml`); el paso a paso está en `docs/05-deploy.md`. **Hacelo hoy, aunque
el producto esté a medias**, y después iterá encima.

*Listo cuando:* las dos URLs responden y están en el README.

### 2. Datos reales de un comercio

El track descalifica demos que solo corren con datos hardcodeados. Un export de Excel de ventas e
inventario de una tienda conocida alcanza: convertirlo al formato de `data/seed/` o escribir un
`ExcelDataSource` que implemente la interfaz `DataSource`.

Es el salto más grande de toda la lista: cruza de "demo" a "producto".

*Listo cuando:* el panel muestra números de un negocio de verdad.

### 3. Probar `/api/chat` contra la API real

El loop de agentes compila y los tipos cierran, pero nunca se ejecutó contra la API de Claude.
Con la `ANTHROPIC_API_KEY` puesta son 2 minutos. **Antes que cualquier feature nueva.**

---

## 🟡 Alto impacto

### 4. Dólar paralelo en vivo (Firecrawl, sponsor)

Implementar `FirecrawlFxProvider` cumpliendo la interfaz `FxProvider`, con caché en memoria de
~15 min y **fallback a `SeedFxProvider` si falla**. Un scraping caído nunca debe romper la demo.

Documentar la fuente exacta y la fecha de captura en `docs/04-datos.md`: el track exige citar
fuentes y el jurado lo va a preguntar.

### 5. Simulador cambiario en la interfaz

Un slider de tipo de cambio (12 → 18 Bs) que recalcula la tabla de precios sugeridos en vivo.
Es el momento "wow" del pitch.

### 6. Alertas automáticas (reto Zavu, USD 500)

Un cron que corre `analyze_margins` y dispara una alerta por Telegram o email cuando un producto
cae bajo su margen mínimo. Encaja natural con el producto y es un premio adicional.

### 7. Que alguien externo lo use antes del pitch

Aunque sea un comerciante conocido por WhatsApp. Poder decir *"lo probó Don X y encontró dos
productos que vendía perdiendo plata"* vale más que cualquier funcionalidad.

---

## 🟢 Mejoras

- **Calidad de los agentes** — probar los 5 con sus preguntas de ejemplo y ajustar las
  descripciones de las herramientas donde no las llamen o las llamen de más. Rinde más que tocar
  el prompt de sistema. Ver `docs/03-agentes.md`.
- **Herramientas nuevas** — candidatas: `simulate_purchase` ("¿compro ahora o espero?"),
  `generate_whatsapp_message`, `sales_forecast`.
- **Pulido de la demo** — jerarquía visual (lo rojo tiene que saltar a la vista), markdown en el
  chat, tablas de precios como tabla real, responsive, y un estado "despertando el servidor…"
  para el arranque en frío de Render.
- **Base de datos** (Neon o Supabase) — una clase de ~60 líneas que implemente `DataSource`. Solo
  vale la pena **con datos reales adentro**; ver `docs/04-datos.md`.
- **Pitch** — escribirlo y ensayarlo cronometrado, tres veces, en voz alta. Guion en
  `docs/06-demo-pitch.md`.

## ⛔ Lo que no conviene hacer

- **Agregar agentes nuevos.** Cinco ya son más de los que se pueden mostrar en 4 minutos. Cada
  agente extra diluye el pitch y no suma puntos.
- **Construir la plataforma amplia** (ocho módulos de negocio). El track penaliza explícitamente
  las ideas genéricas. Profundidad sobre superficie.
- **Cambiar de base de datos por prolijidad.** Los agentes solo leen; nada escribe.

---

## Cronograma

| Franja | Foco del equipo |
| --- | --- |
| **09:00 – 13:00** | Deploy funcionando · conseguir datos reales · probar el chat con la API |
| **13:00 – 19:00** | Features de alto impacto: FX en vivo, simulador, alertas |
| **19:00 – 00:00** | Integrar todo a `main` · calidad de respuestas · escribir el pitch |
| **00:00 – 04:00** | **Congelamiento de features.** Solo se arregla lo roto. Slides y ensayo |
| **04:00 – 07:00** | Prueba del guion completo, todos juntos |
| **07:00 – 09:00** | Solo bugs críticos · ensayos finales · **entregar 08:30** |

**Congelamiento de código a las 00:00.** Lo que no está listo, no entra. Corte oficial del evento:
**domingo 09:00 en punto, sin extensiones.**

## Checklist de entrega (track Bolivia Agents)

- [ ] Producto desplegado con URL funcional, accesible sin cuenta ni instalación
- [ ] Demo en vivo durante el pitch (los videos solo complementan)
- [ ] Repositorio público con README claro, setup en menos de 5 pasos
- [ ] Caso de uso definido: quién lo usa, qué resuelve, por qué en Bolivia
- [ ] Slides de máximo 4 minutos
- [ ] Formulario del portal enviado antes de las 09:00
- [ ] Fuentes de datos citadas
- [ ] Ningún secreto commiteado (`git log -p | grep -i "sk-ant"`)
