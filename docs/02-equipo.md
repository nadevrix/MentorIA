# 02 — Estado y backlog

**Cómo trabajamos:** cada persona construye lo que ve que le falta al producto, en su propia rama.
Una persona integra: revisa las ramas, elige qué sirve y lo mergea a `main`. No hay carpetas
asignadas. Flujo de git en `docs/07-convenciones.md`; el prompt para arrancar en
`docs/11-onboarding.md`.

Este documento es la foto del proyecto: **qué ya funciona, qué falta y qué hay que corregir.**
Ordenado por lo que más suma al puntaje. Razonamiento de las prioridades en `docs/10-prioridades.md`.

Antes de agarrar algo grande, avisá en el grupo para que no lo hagan dos personas a la vez.

---

## ✅ Lo que ya funciona

| Pieza | Estado |
| --- | --- |
| Motor de agentes | Gemini (`gemini-3.1-flash-lite`) detrás de una capa de proveedor. Probado de punta a punta por HTTP |
| 5 agentes, 11 herramientas | Director, Precios, Inventario, Finanzas, Clientes y Marketing |
| Panel determinista | Corre sin modelo: carga instantánea y cero tokens |
| Motor de hallazgos | Detectores con severidad e impacto en Bs |
| Resumen del día | Redacta los hallazgos en tres frases |
| Simulador cambiario | Recalcula el catálogo contra un tipo de cambio simulado |
| Régimen cambiario nuevo | Modelo de tipo único con marca de régimen, alineado a la unificación del 29/06/2026 |
| Impuestos y formalización | Formularios del SIN y trámites para abrir empresa |
| Marketing | Candidatos con margen sano + generación de contenido |
| Chat | Tablas markdown, trazas de herramientas en vivo, indicador de arranque en frío |
| Tipo de cambio en vivo | `FirecrawlFxProvider` implementado, con fallback |
| Postgres | `PostgresDataSource` + `db/schema.sql` + `db/migrate.mjs` escritos |

---

## 🔴 Crítico — sin esto no competimos

### 1. Deploy en Netlify + Render

Un producto perfecto sin URL pública no compite. La configuración está escrita (`netlify.toml`,
`render.yaml`) y el paso a paso en `docs/05-deploy.md`. Por qué esos dos servicios y no uno solo:
`docs/12-infraestructura.md`.

*Listo cuando:* las dos URLs responden y están en la tabla del README.

### 2. Cuota del modelo

El free tier de Gemini permite **~5 requests por minuto y 20 por día**. Cada pregunta al agente
consume 3 o 4, así que son unas **5 preguntas diarias** — y el guion del pitch tiene dos preguntas
seguidas.

Tres salidas, en orden:
1. **Activar facturación en Google.** Centavos para todo el evento. Es la solución real.
2. `LLM_PROVIDER=anthropic` en Render, si hay clave de Claude.
3. Ensayar con una sola pregunta y esperar un minuto entre demos. Frágil.

### 3. Datos reales de un comercio

El track descalifica demos que solo corren con datos hardcodeados. Un export de Excel de ventas e
inventario de una tienda conocida alcanza: convertirlo al formato de `data/seed/`, o cargarlo a
Neon con `db/migrate.mjs`.

*Listo cuando:* el panel muestra números de un negocio de verdad.

---

## 🟡 Alto impacto

### 4. Conectar Postgres de verdad

El código está, pero la app corre con los JSON: `DATA_SOURCE` está vacío. Falta cargar el esquema
en Neon y poner `DATA_SOURCE=postgres` + `DATABASE_URL` en Render. Sólo vale la pena **con datos
reales adentro** — una base con datos generados no mueve un punto de la rúbrica.

### 5. Tipo de cambio en vivo

Hoy corre en `static` (dato real del BCB, pero fijo en el archivo). Alguien del equipo está
conectando las APIs del blue. Cumplir la interfaz `FxProvider` y **mantener el fallback**: un
scraping caído nunca debe romper la demo.

### 6. Alertas automáticas (reto Zavu, USD 500)

Un cron que corre `analyze_margins` y dispara una alerta por Telegram o email cuando un producto
cae bajo su margen mínimo. Encaja natural con el producto y es un premio adicional.

### 7. Que alguien externo lo use antes del pitch

Aunque sea un comerciante conocido por WhatsApp. Poder decir *"lo probó Don X y encontró tres
productos que vendía perdiendo plata"* vale más que cualquier funcionalidad nueva.

---

## 🔧 Lo que hay que corregir

### Hay dos simuladores cambiarios

`FxSimulator.tsx` (282 líneas) y `Simulator.tsx` + `FxPanel.tsx` resuelven lo mismo: ambos
quedaron en el repo tras integrar dos ramas que lo construyeron en paralelo. **Hay que elegir uno
y borrar el otro** — dos componentes equivalentes divergen y confunden.

### El scraping del tipo de cambio es frágil

`FirecrawlFxProvider` extrae la cotización con una expresión regular sobre el markdown de la
página. Si la fuente cambia el maquetado, el fallback protege la demo pero el dato deja de ser en
vivo. **Verificarlo el día del pitch** y anotar la fecha en `docs/04-datos.md`.

### El alcance creció más de lo que el pitch aguanta

Hay siete pestañas. En 4 minutos no se muestran siete cosas. Hay que decidir **qué se demuestra y
qué sólo se menciona** — la recomendación está en `docs/10-prioridades.md`: vender el agente
cambiario, mencionar el resto en veinte segundos.

### No hay tests

Decisión consciente en 24 horas. Si el jurado pregunta por calidad, la respuesta honesta es que se
valida con Zod en los bordes y se probó a mano.

### Región de Render

`render.yaml` fija Ohio para quedar junto a Neon. Si el servicio ya se creó en Oregon, no vale la
pena moverlo mientras los datos sean los JSON semilla.

---

## ⛔ Lo que no conviene hacer

- **Agregar agentes nuevos.** Cinco ya son más de los que se pueden mostrar en 4 minutos.
- **Agregar pestañas nuevas.** Mismo motivo, y ya hay siete.
- **Mover la base de datos a otro proveedor.** Neon funciona; mover cuesta una hora y no aporta nada.
- **Sacar la regla de secuencia del prompt del agente de precios.** Sin ella, los modelos rápidos
  se quedan en el diagnóstico y nunca dan los precios sugeridos.

---

## Checklist de entrega (track Bolivia Agents)

- [ ] Producto desplegado con URL funcional, accesible sin cuenta ni instalación
- [ ] Demo en vivo durante el pitch (los videos solo complementan)
- [ ] Repositorio público con README claro, setup en menos de 5 pasos
- [ ] Caso de uso definido: quién lo usa, qué resuelve, por qué en Bolivia
- [ ] Slides de máximo 4 minutos
- [ ] Formulario del portal enviado antes de las 09:00
- [ ] Fuentes de datos citadas (`docs/04-datos.md`)
- [ ] Ningún secreto commiteado (`git log -p | grep -iE "sk-ant|AIza|npg_"`)
