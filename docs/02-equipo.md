# 02 — División del equipo (4 personas, 24 horas)

La división está hecha por **frontera de archivos**, no por tema. Cada persona es dueña de carpetas
que nadie más edita: así se puede trabajar en paralelo sin conflictos de merge a las 3 de la mañana.

| # | Rol                          | Es dueño de                                       | Depende de       |
| - | ---------------------------- | ------------------------------------------------- | ---------------- |
| 1 | Núcleo de agentes            | `packages/core/src/{tools,agents,runtime.ts}`      | contratos de P2  |
| 2 | Datos e integraciones        | `packages/core/src/{data,fx}`, `data/`             | nadie            |
| 3 | Producto y frontend          | `apps/web/`                                        | contrato de API  |
| 4 | Plataforma, demo y pitch     | `apps/api/`, deploy, `docs/06`, slides             | que 1–3 compilen |

**Regla de oro:** si necesitás cambiar un archivo que no es tuyo, avisá en el grupo antes. Los
contratos compartidos (`packages/core/src/types.ts`, `data/source.ts`) se cambian **de a dos**.

---

## Persona 1 — Núcleo de agentes

> Sos el dueño de que el agente *decida bien*. Si el jurado pregunta "¿esto es un agente o un
> chatbot?", tu trabajo es la respuesta.

**Archivos:** `packages/core/src/tools/`, `packages/core/src/agents/`, `packages/core/src/runtime.ts`

**Tareas en orden:**
1. Probá los 5 agentes con las preguntas de ejemplo y anotá dónde fallan. *(1 h)*
2. Ajustá las descripciones de las herramientas donde el agente no las llame o las llame de más.
   Es más efectivo que tocar el prompt de sistema. *(2 h)*
3. Agregá lo que falte para el guion de la demo. Candidatos:
   - `simulate_purchase(monto, tipoCambio)` — "¿me conviene comprar ahora o esperar?"
   - `generate_whatsapp_message(clienteId)` — texto listo para copiar y pegar
   - `sales_forecast(dias)` — proyección simple con la tendencia de 90 días
4. Afiná el manejo de errores del loop: que un fallo de herramienta nunca deje al usuario sin respuesta.
5. Medí latencia por agente y decidí `effort` (`medium` vs `high`) en `runtime.ts`.

**Listo cuando:** las 15 preguntas de ejemplo del catálogo de agentes responden con cifras correctas
y una acción concreta, en menos de 25 segundos cada una.

**No toques:** `apps/web/`, `apps/api/`, `data/`.

---

## Persona 2 — Datos e integraciones

> Sos el dueño de que los datos sean **reales**. El track descalifica demos que solo funcionan con
> datos hardcodeados; vos sos quien evita eso.

**Archivos:** `packages/core/src/data/`, `packages/core/src/fx/`, `data/`

**Tareas en orden:**
1. **Prioridad máxima: conseguir datos reales de un comercio.** Un export de Excel de ventas e
   inventario de una tienda conocida alcanza. Escribí un `ExcelDataSource` o un script de conversión
   a `data/seed/`. Esto vale más puntos que cualquier feature. *(4 h)*
2. **Dólar paralelo en vivo** con Firecrawl (sponsor). Implementá `FirecrawlFxProvider` cumpliendo la
   interfaz `FxProvider`, con caché en memoria de ~15 min y **fallback a `SeedFxProvider` si falla**.
   Nunca dejes que un scraping caído rompa la demo. *(3 h)*
3. Documentá en `docs/04-datos.md` la fuente exacta del tipo de cambio y de dónde salió el dataset:
   el track pide citar las fuentes.
4. Si sobra tiempo: `SupabaseDataSource` (Postgres free tier) para persistencia real y multiusuario.
5. Si sobra más tiempo: leer un catálogo desde la API REST de Odoo, aunque sea de solo lectura —
   demuestra que la plataforma se enchufa al ERP que ya usa el comercio.

**Listo cuando:** `DATA_SOURCE=<real>` y `FX_SOURCE=firecrawl` funcionan de punta a punta, y el panel
muestra números de un negocio de verdad.

**No toques:** `tools/`, `agents/`, `runtime.ts`. Si necesitás un campo nuevo en el modelo,
coordinalo con P1 y cambien `types.ts` juntos.

---

## Persona 3 — Producto y frontend

> Sos el dueño de que se entienda sin explicación. La demo vale 15% del puntaje y se juega acá.

**Archivos:** `apps/web/`

**Tareas en orden:**
1. Pulí el panel: jerarquía visual clara — lo que está en rojo tiene que saltar a la vista. *(2 h)*
2. **Vista de simulación cambiaria**: un slider de tipo de cambio (12 → 18 Bs) que recalcula la tabla
   de precios sugeridos en vivo. Es el momento "wow" del pitch. Consumí `suggest_price` vía un
   endpoint nuevo que le pedís a P4, o hacé el cálculo en el cliente con los datos del panel. *(3 h)*
3. Mejorá el render del chat: markdown básico (listas y negritas), tablas de precios como tabla real.
4. Responsive de verdad: el jurado puede abrirlo en el celular.
5. Estado vacío y de error decentes: si la API está fría, mostrar "despertando el servidor…" en lugar
   de una pantalla rota.

**Listo cuando:** alguien que nunca vio el producto entra, entiende el problema en 10 segundos y
consigue una recomendación de precio sin que le expliques nada.

**No toques:** `packages/core/`, `apps/api/`. Si necesitás un endpoint, pedíselo a P4.

---

## Persona 4 — Plataforma, demo y pitch

> Sos el dueño de que exista algo que mostrar. Empezá por el deploy: un producto perfecto sin URL
> pública no compite.

**Archivos:** `apps/api/`, configuración de deploy, `docs/06-demo-pitch.md`, slides

**Tareas en orden:**
1. **Desplegá HOY, con el esqueleto vacío.** Netlify + Render funcionando y URLs en el README antes
   de que nadie termine su feature. Desplegar a las 7 a.m. del domingo es cómo se pierden hackathons. *(2 h)*
2. Endpoints que pidan P1 y P3, más el manejo de errores y los límites del servidor.
3. **Reto Zavu (USD 500, opcional pero al alcance):** alerta automática por Telegram o email cuando un
   producto cae bajo su margen mínimo. Es un cron que corre `analyze_margins` y dispara Zavu si hay
   productos en riesgo. Encaja perfecto con el producto y es un premio adicional. *(3 h)*
4. Escribí y **ensayá** el pitch de 4 minutos. Cronometrado, tres veces, en voz alta.
5. Plan B: capturas de pantalla y un GIF de la demo funcionando, por si el WiFi del venue falla.
6. Formulario de entrega antes de las 09:00 del domingo. Marcá "Zavu" y "Mejor impacto social"
   (PyMEs es un ámbito explícito de la mención) si aplican.

**Listo cuando:** hay URL pública, el pitch dura 3:50 cronometrado, y existe un plan B en imágenes.

**No toques:** `packages/core/src/{tools,agents}`, `apps/web/src/components/`.

---

## Cronograma sugerido

| Franja                | P1                      | P2                        | P3                     | P4                        |
| --------------------- | ----------------------- | ------------------------- | ---------------------- | ------------------------- |
| **09:00 – 13:00**     | Probar y afinar agentes | Conseguir datos reales    | Pulir panel            | **Deploy end-to-end**     |
| **13:00 – 19:00**     | Herramientas nuevas     | Firecrawl + FX en vivo    | Vista de simulación    | Endpoints + reto Zavu     |
| **19:00 – 00:00**     | Calidad de respuestas   | Integrar datos reales     | Chat y responsive      | Escribir pitch            |
| **00:00 – 04:00**     | **Congelar features**   | **Congelar features**     | Últimos detalles       | Slides + ensayo 1         |
| **04:00 – 07:00**     | Probar el guion completo, los 4 juntos                                                     |
| **07:00 – 09:00**     | Solo bugs críticos · Ensayos 2 y 3 · **Entregar 08:30**                                    |

**Congelamiento de código: 04:00.** Después de esa hora solo se arreglan cosas rotas. Lo que no está
listo, no entra. Corte oficial de código: **domingo 09:00 en punto, sin extensiones.**

## Checklist de entrega (del track Bolivia Agents)

- [ ] Producto desplegado con URL funcional accesible sin cuenta ni instalación
- [ ] Demo en vivo durante el pitch (los videos solo complementan)
- [ ] Repositorio público con README claro, setup en menos de 5 pasos
- [ ] Caso de uso definido: quién lo usa, qué resuelve, por qué en Bolivia
- [ ] Slides de máximo 4 minutos
- [ ] Formulario del portal enviado antes de las 09:00
- [ ] Fuentes de datos citadas
- [ ] Ningún secreto commiteado (revisar con `git log -p | grep -i "sk-ant"`)
