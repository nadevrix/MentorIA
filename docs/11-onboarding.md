# 11 — Onboarding: el prompt para empezar

Un solo prompt, igual para todos. Copialo, pegáselo a tu IA (Cursor, Claude Code, lo que uses)
como primer mensaje, y reemplazá `MI-NOMBRE` por el tuyo en los dos lugares donde aparece.

## Cómo trabajamos

Cada uno construye lo que ve que le falta al producto, en **su propia rama**. Una persona
integra: revisa las ramas, elige qué sirve y lo mergea a `main`. No hay carpetas asignadas ni
permisos: si ves algo que mejorar, mejoralo.

Las dos únicas reglas existen para que la integración sea posible:

1. **Nadie pushea a `main`.** Si todos escriben en `main`, no hay nada que revisar ni forma de
   corregir; hay que apagar incendios. Con una rama por persona, lo que no sirve simplemente no
   se mergea.
2. **Nunca subir las claves de API ni el `.env`.** Si pasa, hay que rotar la clave afectada
   (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, `DATABASE_URL`) de inmediato.

Lo demás es libre.

---

## El prompt

```
Trabajo en Mentor IA, un copiloto de IA para PyMEs bolivianas que estamos construyendo
en el Cursor Buildathon Bolivia 2026 (track Bolivia Agents). Corte de código: domingo
09:00. Repo: https://github.com/nadevrix/MentorIA

PASO 1 — Ponéme al día. Ejecutá esto y mostrame la salida:
  git clone https://github.com/nadevrix/MentorIA.git   # si todavía no lo tenés
  cd MentorIA
  git fetch origin
  git switch main && git pull origin main
  git switch MI-NOMBRE 2>/dev/null || git switch -c MI-NOMBRE   # ← tu nombre. Tu rama, solo tuya
  npm install
  cp .env.example .env                   # pegá la GEMINI_API_KEY del equipo
  npm run dev                            # API en :8787, web en :5173

PASO 2 — Leé CLAUDE.md en la raíz del repo antes de proponerme nada. Ahí está la
arquitectura, la convención de moneda, las reglas del equipo y una tabla que dice qué
documento de docs/ leer según lo que vayas a tocar. Cuando decidamos en qué trabajar,
abrí el documento que corresponda ANTES de escribir código — están escritos para vos.

QUÉ ES EL PROYECTO: en Bolivia el dólar oficial está intervenido (~6.96 Bs) pero el
paralelo se mueve al alza. Un comercio importador fija precios con el dólar de cuando
compró y repone con el de hoy: puede vender bien y estar perdiendo capital sin saberlo.
Cinco agentes de IA leen los datos del negocio y devuelven acciones concretas. El
cálculo central es el margen a costo de reposición — si vas a tocar algo de precios o
márgenes, tiene que usar el dólar paralelo, no el oficial.

QUÉ HAGO YO: lo que vea que le falta al producto. Proponeme mejoras y elijo.

DOS REGLAS, EL RESTO ES LIBRE:
1. Trabajo SOLO en mi rama. Nunca hagas commit ni push a main — otra persona revisa
   y mergea todo. Para guardar mi trabajo: git add -A && git commit -m "..." &&
   git push origin MI-NOMBRE
2. Nunca commitees ninguna API key ni el archivo .env.

Antes de cada push corré: npm run typecheck && npm run build:web

Empezá por los comandos del paso 1 y decime en qué estado quedó el repo.
```

---

## Traer los cambios de los demás (cada 2 o 3 horas)

Mientras trabajás, `main` va cambiando. Para no quedarte atrás ni acumular un conflicto gigante:

```bash
git switch main && git pull origin main
git switch MI-NOMBRE
git merge main
npm run typecheck && npm run build:web
```

Si el merge se complica, `git merge --abort` te deja como estabas y avisás en el grupo.

## Guardar tu trabajo (cuantas veces quieras)

```bash
git add -A
git commit -m "agrega simulador de escenario cambiario"
git push origin MI-NOMBRE
```

Pushear tu rama es gratis y no afecta a nadie. Hacelo seguido — es tu backup.

## Para quien integra

```bash
git fetch origin
git log --oneline main..origin/RAMA-DE-FULANO     # qué trae
git diff --stat main...origin/RAMA-DE-FULANO      # qué toca

git switch main && git pull origin main
git merge origin/RAMA-DE-FULANO
npm run typecheck && npm run build:web            # ANTES de pushear
git push origin main
```

Si algo no sirve, no se mergea y listo. Comandos de resolución de conflictos y salidas de
emergencia en `docs/07-convenciones.md`.

## Ideas de qué construir

No es una asignación, es un menú por si alguien no sabe por dónde empezar. Ordenado por lo que
más suma al puntaje (razonamiento en `docs/10-prioridades.md`):

1. **Deploy en Netlify + Render** — sin URL pública no competimos. `docs/05-deploy.md`
2. **Datos reales de un comercio** — el track descalifica demos con datos hardcodeados
3. **Dólar paralelo en vivo** con Firecrawl, con fallback si el scraping falla
4. **Simulador cambiario en la interfaz** — slider de 12 a 18 Bs, el momento "wow" del pitch
5. **Alertas automáticas** (reto Zavu, USD 500) — Telegram o email cuando un producto cae bajo
   su margen mínimo
6. **Herramientas nuevas** para los agentes — `docs/03-agentes.md` tiene ejemplos copiables
7. **Pulir la demo** — estados de carga, errores, responsive, render del chat

Lo que **no** conviene: agregar agentes nuevos. Cinco ya son más de los que se pueden mostrar
en 4 minutos.
