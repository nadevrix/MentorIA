# 07 — Git, comunicación y convenciones

Cuatro personas, 24 horas, un repo. Estas reglas existen para que nadie pierda trabajo a las 3 a.m.

---

# Parte 1 — Git para cuatro ramas

## El modelo, en tres frases

- **`main` es la verdad.** Siempre compila, siempre despliega.
- **Cada persona tiene su rama** y trabaja solo ahí.
- **Todos traen `main` seguido** y mandan lo suyo a `main` cada pocas horas.

```
              ┌── p1-agentes ──┐
              ├── p2-datos ────┤
   main ──────┼── p3-web ──────┼────► main (Netlify + Render despliegan de acá)
              └── p4-plataforma┘
```

Las ramas son de una persona cada una. **Nadie trabaja en la rama de otro.**

## Configuración inicial (una sola vez, cada uno)

```bash
git clone https://github.com/nadevrix/MentorIA.git
cd MentorIA
npm install
cp .env.example .env      # y pegar la ANTHROPIC_API_KEY

# Traer tu rama (ya existe en el remoto) y pararte en ella
git fetch origin
git switch p1-agentes     # ← poné la TUYA: p1-agentes | p2-datos | p3-web | p4-plataforma
```

Verificá en qué rama estás cuando tengas dudas:

```bash
git branch --show-current
```

Si eso dice `main`, **pará y cambiate a la tuya** antes de escribir código.

## El ciclo diario (memorizá estos tres bloques)

### 1. Antes de empezar a trabajar — traer lo de los demás

```bash
git switch main
git pull origin main
git switch p1-agentes     # tu rama
git merge main
```

Hacé esto **cada 2 o 3 horas**, no solo al arrancar. Traer cambios seguido significa conflictos
chiquitos; traerlos una vez al día significa un conflicto gigante a las 4 a.m.

### 2. Guardar tu trabajo (cuantas veces quieras)

```bash
git add -A
git commit -m "agrega herramienta de proyección de ventas"
git push origin p1-agentes
```

Pushear tu rama es gratis y no afecta a nadie. **Hacelo seguido** — es tu backup si se te muere la
laptop.

### 3. Mandar lo tuyo a main (cada 2-3 horas, cuando algo funcione)

```bash
# Primero: verificá que no rompiste nada
npm run typecheck && npm run build:web

# Traé main a tu rama y resolvé conflictos acá, en tu rama, no en main
git switch main && git pull origin main
git switch p1-agentes && git merge main

# Volvé a verificar después del merge
npm run typecheck && npm run build:web

# Recién ahora, a main
git switch main
git merge p1-agentes
git push origin main

# Y volvé a tu rama a seguir trabajando
git switch p1-agentes
```

**Nunca pushees a `main` sin correr `npm run typecheck && npm run build:web` primero.** Si `main`
está roto, Netlify falla y los otros tres arrastran tu error.

## Cuando algo sale mal

### "Tengo un conflicto y no sé qué hacer"

Git te marca el archivo así:

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

Si es un archivo que no es tuyo (mirá la tabla de fronteras abajo), **preguntale al dueño antes de
resolverlo**. Casi siempre él sabe cuál versión va.

### "Quiero cancelar el merge y volver atrás"

```bash
git merge --abort
```

Te deja como estabas. Sin daño.

### "Hice cambios y no quiero perderlos pero necesito cambiar de rama"

```bash
git stash              # guarda tus cambios a un costado
git switch otra-rama
# ... lo que necesites hacer ...
git switch tu-rama
git stash pop          # los recupera
```

### "Rompí todo y quiero volver al último commit"

```bash
git restore .          # descarta cambios NO commiteados. Ojo: no se recuperan
```

### "Pushé algo roto a main"

Avisá en el grupo **primero**, después revertí:

```bash
git switch main && git pull origin main
git revert HEAD        # crea un commit que deshace el anterior
git push origin main
```

`revert` es seguro y no reescribe historia. **No uses `reset --hard` sobre `main`** — rompe el
repo de los otros tres.

### "Nunca commitees esto"

```bash
git log -p | grep -i "sk-ant" && echo "⚠️ HAY UNA CLAVE EN EL HISTORIAL"
```

Si aparece algo: **rotá la clave en la consola de Anthropic inmediatamente**. Generar una clave
nueva es más rápido que reescribir el historial de git.

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

## Fronteras de archivos

Cada carpeta tiene un dueño. Si necesitás tocar algo que no es tuyo: **avisá en el grupo antes**.

| Carpeta | Dueño | Los demás |
| --- | --- | --- |
| `packages/core/src/{tools,agents}`, `runtime.ts` | P1 | solo lectura |
| `packages/core/src/{data,fx}`, `data/` | P2 | solo lectura |
| `apps/web/` | P3 | solo lectura |
| `apps/api/`, deploy, `docs/06` | P4 | solo lectura |
| `packages/core/src/types.ts`, `data/source.ts` | **compartido** | cambiar de a dos |

Los dos archivos compartidos son contratos: si cambian, se rompe el trabajo de los otros tres.
Cambiarlos **siempre de a dos personas**, y avisando al grupo apenas se pushea.

## Qué avisar en el grupo (y qué no)

**Avisá siempre:**
- "Voy a cambiar `types.ts` para agregar el campo X" — antes de hacerlo
- "Pushé a main, traigan los cambios" — después de mergear
- "Main está roto, no traigan todavía, lo estoy arreglando"
- "Necesito que P4 me agregue el endpoint `/api/simular`"
- "Estoy trabado hace 30 minutos con X" — **a los 30 minutos, no a las 3 horas**

**No hace falta avisar:**
- Commits y pushes a tu propia rama
- Cambios dentro de tus carpetas

## La regla de los 30 minutos

**Si estás trabado 30 minutos en lo mismo, escribilo en el grupo.** No importa si te parece que
deberías poder resolverlo. En un hackathon de 24 horas, tres horas de una persona trabada son el
12% del tiempo total del equipo.

## Sincronizaciones obligatorias

Cuatro paradas de 10 minutos, todos presentes. Cada uno dice tres cosas: **qué terminé, qué sigo,
en qué estoy trabado.**

| Hora | Foco |
| --- | --- |
| ~13:00 | ¿Está desplegado? ¿Hay datos reales en camino? |
| ~19:00 | Qué entra y qué se corta. Ajustar alcance con honestidad |
| ~00:00 | **Congelamiento de features.** De acá en más solo se arreglan cosas rotas |
| ~04:00 | Prueba del guion completo del pitch, los cuatro juntos |

## Antes de dormir (si alguien duerme)

1. Mergeá tu rama a `main`.
2. Escribí en el grupo qué quedó a medias y en qué archivo.
3. Verificá que `main` compile. Si lo rompiste, revertí **antes** de irte.

---

# Parte 3 — Código

- **Validá en los bordes.** Todo lo que entra del modelo o de HTTP pasa por Zod. Adentro se confía
  en los tipos.
- **TypeScript estricto.** Nada de `any` en `packages/core`.
- **Nombres de dominio en español, código en inglés.** `analyze_margins` devuelve `margenRealHoyPct`.
- **Sufijo de moneda obligatorio:** `Bob` o `Usd`.
- **Comentá el porqué, no el qué.** `// el paralelo, no el oficial: es el costo real de reponer`
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
3. Avisá a P4 para que la cargue en Render o Netlify.

Las del frontend llevan prefijo `VITE_` y **se inyectan en tiempo de build** — cambiarlas exige
redesplegar.

## Comandos

```bash
npm run dev          # API (:8787) + Web (:5173)
npm run dev:api      # solo API, con recarga
npm run dev:web      # solo frontend
npm run typecheck    # core + api
npm run build        # todo
npm run build:web    # lo que corre Netlify
node data/generate.mjs   # regenerar datos semilla
```
