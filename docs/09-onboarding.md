# 09 — Onboarding: prompt para cada integrante

Copiá el bloque de tu persona y pegáselo a tu IA (Cursor, Claude Code, lo que uses) **como primer
mensaje** al abrir el repo. Le da el contexto, tu rol y las reglas de git de una sola vez.

> El repo ya tiene un `CLAUDE.md` en la raíz que Claude Code lee automáticamente. Este prompt lo
> complementa con lo que es específico de vos: tu rama, tus carpetas y tus tareas.

---

## Setup previo (una vez, antes de pegar el prompt)

```bash
git clone https://github.com/nadevrix/MentorIA.git
cd MentorIA
npm install
cp .env.example .env      # pegar la ANTHROPIC_API_KEY que compartió el equipo
git fetch origin
git switch TU-RAMA        # p1-agentes | p2-datos | p3-web | p4-plataforma
npm run dev               # API en :8787, web en :5173
```

---

## 🧭 Persona 1 — Núcleo de agentes

```
Trabajo en MentorIA (PyME AI), un copiloto de IA para PyMEs bolivianas que estamos
construyendo en el Cursor Buildathon Bolivia 2026, track Bolivia Agents. Quedan menos
de 24 horas y el corte de código es el domingo a las 09:00.

Antes de proponerme nada, leé estos archivos del repo:
- CLAUDE.md (reglas del proyecto)
- docs/01-arquitectura.md, docs/03-agentes.md, docs/08-estrategia.md
- docs/07-convenciones.md (git y comunicación)

MI ROL: Persona 1, núcleo de agentes. Soy dueño de:
  packages/core/src/tools/, packages/core/src/agents/, packages/core/src/runtime.ts
Trabajo en la rama p1-agentes. NO edito apps/web/, apps/api/ ni data/ — esas son de
otras personas. Si creés que hay que tocar algo ahí, avisame y lo pido en el grupo.

MIS TAREAS, en orden:
1. Probar los 5 agentes con sus preguntas de ejemplo y anotar dónde fallan.
2. Ajustar las descripciones de las herramientas donde el agente no las llame, o las
   llame de más. Es más efectivo que tocar el prompt de sistema.
3. Agregar las herramientas que falten para el guion de la demo. Candidatas:
   simulate_purchase, generate_whatsapp_message, sales_forecast.
4. Que un error de herramienta nunca deje al usuario sin respuesta.
5. Medir latencia por agente y decidir el nivel de effort en runtime.ts.

ESTOY LISTO CUANDO: las preguntas de ejemplo responden con cifras correctas y una
acción concreta, en menos de 25 segundos cada una.

CÓMO QUIERO QUE TRABAJES:
- Antes de escribir código, decime qué vas a cambiar y en qué archivo.
- Si un cambio toca packages/core/src/types.ts, avisame ANTES: es un contrato
  compartido y hay que coordinarlo con otra persona.
- Después de cada cambio corré: npm run typecheck
- No agregues agentes nuevos. Cinco ya son más de los que podemos mostrar en 4 minutos.
- Español boliviano en todo lo que vea el usuario final.

Empezá leyendo los archivos y decime qué encontrás antes de tocar nada.
```

---

## 🗄️ Persona 2 — Datos e integraciones

```
Trabajo en MentorIA (PyME AI), un copiloto de IA para PyMEs bolivianas que estamos
construyendo en el Cursor Buildathon Bolivia 2026, track Bolivia Agents. Quedan menos
de 24 horas y el corte de código es el domingo a las 09:00.

Antes de proponerme nada, leé estos archivos del repo:
- CLAUDE.md (reglas del proyecto)
- docs/04-datos.md (modelo de datos y convención de moneda)
- docs/01-arquitectura.md, docs/08-estrategia.md
- docs/07-convenciones.md (git y comunicación)

MI ROL: Persona 2, datos e integraciones. Soy dueño de:
  packages/core/src/data/, packages/core/src/fx/, data/
Trabajo en la rama p2-datos. NO edito tools/, agents/, runtime.ts, apps/web/ ni
apps/api/ — son de otras personas.

MI TAREA #1, LA MÁS IMPORTANTE DEL EQUIPO: conseguir datos REALES de un comercio.
El track descalifica demos que solo funcionan con datos hardcodeados. Un export de
Excel de ventas e inventario de una tienda conocida alcanza. Hay que convertirlo al
formato de data/seed/ o escribir un ExcelDataSource.

MIS OTRAS TAREAS:
2. Dólar paralelo en vivo con Firecrawl (sponsor). Implementar FirecrawlFxProvider
   cumpliendo la interfaz FxProvider, con caché en memoria de ~15 min y FALLBACK a
   SeedFxProvider si falla. Un scraping caído nunca debe romper la demo.
3. Documentar en docs/04-datos.md la fuente exacta del tipo de cambio y de dónde
   salió el dataset. El track exige citar fuentes.
4. Si sobra tiempo: NeonDataSource o SupabaseDataSource (Postgres) implementando la
   misma interfaz DataSource.

ESTOY LISTO CUANDO: el panel muestra números de un negocio de verdad.

CÓMO QUIERO QUE TRABAJES:
- Todo lo nuevo va detrás de la interfaz DataSource o FxProvider. Si tu propuesta
  obliga a cambiar una herramienta o un prompt, está mal diseñada.
- Respetá la convención de moneda: sufijo Bob para bolivianos, Usd para dólares.
- Si a los datos reales les falta un campo (típicamente purchaseFxRate, el dólar al
  que se compró), NO lo inventes: hacelo opcional y que se informe en el campo nota.
- Si un cambio toca packages/core/src/types.ts o data/source.ts, avisame ANTES: son
  contratos compartidos.
- Después de cada cambio corré: npm run typecheck

Empezá leyendo los archivos y proponeme cómo estructurar la carga de un Excel real.
```

---

## 🎨 Persona 3 — Producto y frontend

```
Trabajo en MentorIA (PyME AI), un copiloto de IA para PyMEs bolivianas que estamos
construyendo en el Cursor Buildathon Bolivia 2026, track Bolivia Agents. Quedan menos
de 24 horas y el corte de código es el domingo a las 09:00.

Antes de proponerme nada, leé estos archivos del repo:
- CLAUDE.md (reglas del proyecto)
- docs/06-demo-pitch.md (el guion que la interfaz tiene que soportar)
- docs/08-estrategia.md, docs/07-convenciones.md

MI ROL: Persona 3, producto y frontend. Soy dueño de apps/web/ y de nada más.
Trabajo en la rama p3-web. NO edito packages/core/ ni apps/api/. Si necesito un
endpoint nuevo, se lo pido a la Persona 4.

EL CONTEXTO QUE IMPORTA: la calidad de la demo es 15% del puntaje y se juega en mi
parte. Un jurado tiene que entender el problema en 10 segundos, sin que nadie le
explique nada.

MIS TAREAS, en orden:
1. Pulir el panel. Jerarquía visual clara: lo que está en rojo tiene que saltar a la
   vista. Un producto que se vende bajo costo de reposición es LA noticia.
2. Vista de simulación cambiaria: un slider de tipo de cambio (12 → 18 Bs) que
   recalcula la tabla de precios sugeridos en vivo. Es el momento "wow" del pitch.
3. Mejorar el render del chat: markdown básico (listas, negritas) y las tablas de
   precios como tabla real.
4. Responsive de verdad: el jurado puede abrirlo en el celular.
5. Estados vacíos y de error decentes. Si la API está fría (Render free tier tarda
   ~40s en despertar), mostrar "despertando el servidor…" en vez de una pantalla rota.

ESTOY LISTO CUANDO: alguien que nunca vio el producto entra, entiende el problema y
consigue una recomendación de precio sin que le expliquen nada.

CÓMO QUIERO QUE TRABAJES:
- Stack: React 19 + Vite + Tailwind v4. Los tokens de color están en src/index.css.
- El contrato con la API está en src/lib/api.ts. El chat consume SSE con fetch +
  ReadableStream, no EventSource (el endpoint es POST).
- Antes de escribir código, decime qué vas a cambiar y en qué archivo.
- Después de cada cambio corré: npm run build:web
- Español boliviano en toda la interfaz. Montos en bolivianos con formato es-BO.

Empezá leyendo los archivos y decime cómo encararías la vista de simulación.
```

---

## 🚀 Persona 4 — Plataforma, demo y pitch

```
Trabajo en MentorIA (PyME AI), un copiloto de IA para PyMEs bolivianas que estamos
construyendo en el Cursor Buildathon Bolivia 2026, track Bolivia Agents. Quedan menos
de 24 horas y el corte de código es el domingo a las 09:00.

Antes de proponerme nada, leé estos archivos del repo:
- CLAUDE.md (reglas del proyecto)
- docs/05-deploy.md (Netlify + Render paso a paso)
- docs/06-demo-pitch.md (guion del pitch)
- docs/08-estrategia.md, docs/07-convenciones.md

MI ROL: Persona 4, plataforma, demo y pitch. Soy dueño de apps/api/, la configuración
de deploy, docs/06-demo-pitch.md y las slides. Trabajo en la rama p4-plataforma.
NO edito packages/core/src/{tools,agents} ni apps/web/src/components/.

MI TAREA #1, ANTES QUE CUALQUIER OTRA COSA: desplegar. Netlify (frontend) + Render
(API) funcionando, con las URLs en el README, HOY, aunque el producto esté a medias.
Un producto perfecto sin URL pública no compite. La config ya está escrita
(netlify.toml, render.yaml).

MIS OTRAS TAREAS:
2. Los endpoints que pidan las Personas 1 y 3, más manejo de errores del servidor.
3. Reto Zavu (premio adicional de USD 500): alerta automática por Telegram o email
   cuando un producto cae bajo su margen mínimo. Es un cron que corre analyze_margins
   y dispara Zavu si hay productos en riesgo.
4. Escribir y ENSAYAR el pitch de 4 minutos. Cronometrado, tres veces, en voz alta.
5. Plan B: capturas y un GIF de la demo funcionando, por si falla el WiFi del venue.
6. Enviar el formulario de entrega antes de las 09:00 del domingo. Marcar el desafío
   Zavu y la mención de impacto social (PyMEs es un ámbito explícito).

ESTOY LISTO CUANDO: hay URL pública, el pitch dura 3:50 cronometrado, y existe un
plan B en imágenes.

CÓMO QUIERO QUE TRABAJES:
- El backend es Hono con SSE. El endpoint /api/chat streamea los eventos del loop
  del agente; no lo conviertas en request/response.
- /api/dashboard NO usa el modelo, a propósito: corre las herramientas de forma
  determinista para que el panel siga funcionando si la API de Claude falla en vivo.
  No lo cambies.
- Nunca commitees la ANTHROPIC_API_KEY. Va en variables de entorno de Render.
- Después de cada cambio corré: npm run typecheck && npm run build:web

Empezá por el deploy. Guiame paso a paso con docs/05-deploy.md y no pasemos a otra
cosa hasta que las dos URLs respondan.
```

---

## Para todos: el prompt de recordatorio de git

Si tu IA te propone hacer commit o merge, pegale esto para que no haga un desastre:

```
Antes de tocar git, respetá esto:
- Trabajo SOLO en mi rama. Nunca hagas commit directo a main.
- Antes de mergear a main: npm run typecheck && npm run build:web tienen que pasar.
- Traigo main a mi rama (git merge main), resuelvo conflictos EN MI RAMA, y recién
  ahí mando lo mío a main.
- Nunca uses reset --hard sobre main ni reescribas historia compartida.
- Si hay conflicto en un archivo que no es de mi propiedad, pará y avisame.
El flujo completo con comandos está en docs/07-convenciones.md.
```
