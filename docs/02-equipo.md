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
| 5 agentes, 12 herramientas | Director, Precios, Inventario, Finanzas y Clientes/Marketing |
| Panel determinista | Corre sin modelo: carga instantánea y cero tokens |
| Motor de hallazgos | 9 detectores con severidad e impacto en Bs |
| Resumen del día | Redacta los hallazgos en tres frases |
| Simulador cambiario | Recalcula el catálogo contra un tipo de cambio simulado |
| Régimen cambiario nuevo | Modelo de tipo único con marca de régimen, alineado a la unificación del 29/06/2026 |
| Impuestos y formalización | Formularios del SIN y trámites para abrir empresa |
| Marketing | Candidatos con margen sano + generación de contenido |
| Chat | Tablas markdown, trazas de herramientas y texto por SSE |
| Tipo de cambio en vivo | `FirecrawlFxProvider` implementado, con fallback |
| Postgres | `PostgresDataSource` + `db/schema.sql` + `db/migrate.mjs` escritos |

---

## 🔴 Crítico — sin esto no competimos

### 1. Deploy completo en Render

Un producto perfecto sin URL pública no compite. `render.yaml` crea la API Starter y el frontend
estático. `netlify.toml` queda preparado para mover el frontend cuando se habiliten esos créditos.
El paso a paso está en `docs/05-deploy.md` y la decisión en `docs/12-infraestructura.md`.

*Listo cuando:* las dos URLs responden y están en la tabla del README.

### 2. Cuota del modelo

Las cuotas de Gemini cambian por modelo, proyecto y estado de facturación. Una pregunta al agente
puede consumir varias llamadas — una por vuelta del loop, hasta un máximo de ocho. Hay que revisar
la cuota vigente del proyecto y probar las dos preguntas del guion seguidas.

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

El código está, pero el despliegue inicial usa `DATA_SOURCE=seed`. Falta cargar el esquema en Neon y
poner `DATA_SOURCE=postgres` + `DATABASE_URL` en Render. Sólo vale la pena **con datos reales
autorizados adentro**: una base con los mismos datos generados no mejora la demostración.

### 5. Tipo de cambio en vivo

El deploy usa `static`, una captura versionada con fecha y fuente. `FirecrawlFxProvider` ya puede
consultar la fuente en vivo. Antes de activarlo hay que validar que el selector siga extrayendo el
valor correcto y **mantener el fallback**: un scraping caído nunca debe romper la demo.

### 6. Alertas automáticas (reto Zavu, USD 500)

Un cron que corre `analyze_margins` y dispara una alerta por Telegram o email cuando un producto
cae bajo su margen mínimo. Encaja natural con el producto y es un premio adicional.

### 7. Que alguien externo lo use antes del pitch

Aunque sea un comerciante conocido por WhatsApp. Poder decir *"lo probó Don X y encontró tres
productos que vendía perdiendo plata"* vale más que cualquier funcionalidad nueva.

---

## 🔧 Lo que hay que corregir

### La demo pública no es multiusuario

No hay autenticación ni aislamiento por empresa. El overlay CSV vive en memoria y es compartido por
la única instancia. El rate limit protege parcialmente las llamadas de IA, pero antes de usar datos
sensibles hacen falta auth, tenancy y persistencia.

### El scraping del tipo de cambio es frágil

`FirecrawlFxProvider` extrae la cotización con una expresión regular sobre el markdown de la
página. Si la fuente cambia el maquetado, el fallback protege la demo pero el dato deja de ser en
vivo. **Verificarlo el día del pitch** y anotar la fecha en `docs/04-datos.md`.

### El alcance creció más de lo que el pitch aguanta

Hay seis pestañas. En 4 minutos no se muestran seis cosas. Hay que decidir **qué se demuestra y
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
- **Agregar pestañas nuevas.** Mismo motivo, y ya hay seis.
- **Mover la base de datos por uniformidad.** El adaptador PostgreSQL ya es portable; cambiar de
  proveedor sin datos reales no aporta nada.
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
- [ ] Ningún secreto commiteado (`git log -p | rg -i "sk-ant-|AIza|postgres(ql)?://"`)
