# 07 — Git, comunicación y convenciones

Varias personas, 24 horas, un repo. Estas reglas existen para que nadie pierda trabajo a las 3 a.m.

---

# Parte 1 — Git

## El modelo, en tres frases

- **Cada persona trabaja en su propia rama**, con su nombre. Construye lo que ve que hace falta.
- **Nadie pushea a `main`.**
- **Una persona integra:** revisa las ramas, elige qué sirve y lo mergea a `main`.

```
   fulano   ──┐
   mengana  ──┤
   vallejos ──┼──► (revisión) ──► main ──► Render despliega de acá
   zutano   ──┘
```

No hay carpetas asignadas ni permisos. Si ves algo que mejorar, mejoralo. La revisión al mergear
es lo que evita el desastre, no la disciplina de cada uno.

## Por qué nadie pushea a main

Es la única regla estructural, y sostiene todo lo demás. Si todos escriben en `main`:

- No hay nada que revisar: lo bueno y lo roto entran igual.
- Un error de una persona rompe el build de las otras tres al instante.
- No se puede descartar trabajo que no sirvió: hay que revertirlo, con conflictos.

Con una rama por persona, lo que no funciona simplemente **no se mergea**. Cero fricción.

## Configuración inicial (una vez)

```bash
git clone https://github.com/nadevrix/MentorIA.git
cd MentorIA
npm ci
cp .env.example .env      # pegar la GEMINI_API_KEY

git switch -c MI-NOMBRE   # tu rama, con tu nombre
```

Verificá en qué rama estás cuando tengas dudas:

```bash
git branch --show-current
```

Si eso dice `main`, **cambiate a la tuya antes de escribir código.**

## Guardar tu trabajo (cuantas veces quieras)

```bash
git add -A
git commit -m "agrega simulador de escenario cambiario"
git push origin MI-NOMBRE
```

Pushear tu rama es gratis y no afecta a nadie. **Hacelo seguido** — es tu backup si se te muere
la laptop.

## Traer lo de los demás (cada 2 o 3 horas)

`main` va cambiando mientras trabajás. Traelo seguido: conflictos chiquitos en vez de uno gigante
a las 4 a.m.

```bash
git switch main && git pull origin main
git switch MI-NOMBRE
git merge main
npm run typecheck && npm run build:web
```

## Para quien integra

```bash
git fetch origin

# Ver qué trae la rama antes de mergear
git log --oneline main..origin/RAMA-DE-FULANO
git diff --stat main...origin/RAMA-DE-FULANO

# Mergear
git switch main && git pull origin main
git merge origin/RAMA-DE-FULANO
npm run typecheck && npm run build:web    # ANTES de pushear, siempre
git push origin main
```

Si algo no sirve, no se mergea. No hace falta explicar ni revertir nada.

**Nunca pushear a `main` sin correr el build primero.** Si `main` está roto, Render falla y
todos lo arrastran en su próximo merge.

## Cuando algo sale mal

### "Tengo un conflicto y no sé qué hacer"

Git marca el archivo así:

```
<<<<<<< HEAD
tu versión
=======
la versión de main
>>>>>>> main
```

Abrí el archivo, dejá la versión correcta (o combiná las dos), **borrá las tres líneas de marcas**
(`<<<<<<<`, `=======`, `>>>>>>>`) y:

```bash
git add ARCHIVO_EN_CONFLICTO
git commit
```

Si no estás seguro de cuál versión va, preguntá en el grupo antes de resolver.

### "Quiero cancelar el merge y volver atrás"

```bash
git merge --abort
```

Te deja como estabas. Sin daño.

### "Necesito cambiar de rama y no quiero perder mis cambios"

```bash
git stash              # guarda tus cambios a un costado
git switch otra-rama
# ... lo que necesites ...
git switch tu-rama
git stash pop          # los recupera
```

### "Rompí todo y quiero volver al último commit"

```bash
git restore .          # descarta cambios NO commiteados. Ojo: no se recuperan
```

### "Se pushó algo roto a main"

Avisá en el grupo **primero**, después:

```bash
git switch main && git pull origin main
git revert HEAD        # crea un commit que deshace el anterior
git push origin main
```

`revert` es seguro y no reescribe historia. **No usar `reset --hard` sobre `main`** — rompe el
repo de todos los demás.

### Secretos

```bash
git log -p | rg -i "sk-ant-|AIza[0-9A-Za-z_-]{20,}|postgres(ql)?://[^ ]+@"
```

Si aparece algo: **rotá la credencial afectada inmediatamente.** Generar una nueva es más rápido
que discutir si alguien llegó a copiarla.

## Mensajes de commit

En español, en imperativo, describiendo qué cambia:

```
✓ agrega herramienta de proyección de ventas
✓ corrige cálculo de margen en productos nacionales
✓ conecta datos reales de Importadora Ñuflo

✗ cambios
✗ fix
✗ wip
```

---

# Parte 2 — Comunicación

## Los dos archivos delicados

No están prohibidos, pero si cambian se rompe el trabajo de los demás al mergear:

- `packages/core/src/types.ts` — el modelo de dominio
- `packages/core/src/data/source.ts` — la interfaz `DataSource`

**Si los tocás, avisá en el grupo apenas lo pushees.** Es la diferencia entre que alguien lo
resuelva en 2 minutos o que descubra el problema tres horas después.

## Qué avisar en el grupo

**Siempre:**
- "Toqué `types.ts`, agregué el campo X"
- "Estoy haciendo el simulador cambiario" — para que no lo hagan dos personas a la vez
- "Mergeé a main, traigan los cambios"
- "Main está roto, no traigan todavía"
- "Estoy trabado hace 30 minutos con X" — **a los 30 minutos, no a las 3 horas**

**No hace falta:**
- Commits y pushes a tu propia rama

## La regla de los 30 minutos

**Si estás trabado 30 minutos en lo mismo, escribilo en el grupo.** No importa si te parece que
deberías poder resolverlo solo. En un hackathon de 24 horas, tres horas de una persona trabada
son el 12% del tiempo total del equipo.

## Sincronizaciones

Cuatro paradas de 10 minutos, todos presentes. Cada uno dice tres cosas: **qué terminé, qué sigo,
en qué estoy trabado.** Sirven sobre todo para detectar trabajo duplicado a tiempo.

| Hora | Foco |
| --- | --- |
| ~13:00 | ¿Está desplegado? ¿Hay datos reales en camino? |
| ~19:00 | Qué entra y qué se corta. Ajustar alcance con honestidad |
| ~00:00 | **Congelamiento de features.** De acá en más solo se arregla lo roto |
| ~04:00 | Prueba del guion completo del pitch, todos juntos |

## Antes de dormir (si alguien duerme)

1. Pusheá tu rama.
2. Escribí en el grupo qué quedó a medias y en qué archivo.
3. Si mergeaste a `main`, verificá que compile.

---

# Parte 3 — Código

- **Validá en los bordes.** Todo lo que entra del modelo o de HTTP pasa por Zod. Adentro se
  confía en los tipos.
- **TypeScript estricto.** Nada de `any` en `packages/core`.
- **Nombres de dominio en español, código en inglés.** `analyze_margins` devuelve `margenRealHoyPct`.
- **Sufijo de moneda obligatorio:** `Bob` o `Usd`. Un número de plata sin sufijo es un bug esperando.
- **Comentá el porqué, no el qué.** `// usa el tipo vigente: mide el costo real de reponer`
  sirve. `// suma el total` no.

## Manejo de errores

- Las herramientas **no lanzan** por falta de datos: devuelven vacío y el agente lo explica.
- Las herramientas **sí lanzan** ante datos corruptos: el runtime lo captura y se lo devuelve al
  modelo como `is_error`, que corrige solo.
- La API nunca devuelve un stack trace al cliente.
- La UI nunca queda en blanco: siempre hay estado de carga, vacío o error.

## Variables de entorno

Si agregás una:
1. Documentala en `.env.example` con un comentario.
2. Dale un valor por defecto sensato en el código.
3. Avisá para que se cargue en Render y, si empieza por `VITE_`, también en el host del frontend.

Las del frontend llevan prefijo `VITE_` y **se inyectan en tiempo de build** — cambiarlas exige
redesplegar.

## Comandos

```bash
npm run dev          # API (:8787) + Web (:5173)
npm run dev:api      # solo API, con recarga
npm run dev:web      # solo frontend
npm run typecheck    # core + api
npm run build        # todo
npm run build:web    # build del frontend estático
node data/generate.mjs   # regenerar datos semilla
```
