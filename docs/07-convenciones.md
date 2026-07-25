# 07 — Convenciones

Reglas mínimas para que cuatro personas trabajen 24 horas sin pisarse.

## Git

- `main` siempre despliega. Nunca pushear algo que no compile.
- Una rama por persona: `p1-agentes`, `p2-datos`, `p3-web`, `p4-plataforma`.
- Mergeá a `main` seguido — al menos cada 3 horas. Ramas largas = conflictos a las 4 a.m.
- Antes de mergear: `npm run typecheck && npm run build:web`.
- Mensajes de commit en imperativo y en español: `agrega herramienta de proyección de ventas`.

**Nunca commitear secretos.** `.env` está en `.gitignore`. Verificación rápida:

```bash
git log -p | grep -i "sk-ant" && echo "⚠️ HAY UNA CLAVE EN EL HISTORIAL"
```

Si pasa: rotá la clave en la consola de Anthropic inmediatamente. Reescribir el historial es más lento
que generar una clave nueva.

## Fronteras de archivos

| Carpeta | Dueño | Los demás |
| ------- | ----- | --------- |
| `packages/core/src/{tools,agents}`, `runtime.ts` | P1 | solo lectura |
| `packages/core/src/{data,fx}`, `data/` | P2 | solo lectura |
| `apps/web/` | P3 | solo lectura |
| `apps/api/`, deploy, `docs/06` | P4 | solo lectura |
| `packages/core/src/types.ts`, `data/source.ts` | **compartido** | cambiar de a dos, avisando |

## Código

- **TypeScript estricto.** Nada de `any` en `packages/core`. En el frontend se tolera para el JSON
  del panel.
- **Validá en los bordes.** Todo lo que entra desde el modelo o desde HTTP pasa por Zod. Adentro se
  confía en los tipos.
- **Nombres de dominio en español, código en inglés.** `analyze_margins` devuelve `margenRealHoyPct`.
  Los campos los lee el modelo y terminan en la respuesta al usuario.
- **Sufijo de moneda obligatorio:** `Bob` o `Usd`. Un número de plata sin sufijo es un bug esperando.
- **Comentá el porqué, no el qué.** `// el paralelo, no el oficial: es el costo real de reponer` sirve.
  `// suma el total` no.

## Manejo de errores

- Las herramientas **no lanzan** por falta de datos: devuelven vacío. El agente lo explica.
- Las herramientas **sí lanzan** ante datos corruptos: el runtime lo captura y se lo devuelve al modelo
  como `is_error`, que corrige solo.
- La API nunca devuelve un stack trace al cliente: `console.error` del lado del servidor, mensaje
  legible del lado del usuario.
- La UI nunca queda en blanco: siempre hay estado de carga, vacío o error.

## Variables de entorno

Todas van en `.env.example` con un comentario. Si agregás una:

1. Documentala en `.env.example`.
2. Dale un valor por defecto sensato en el código.
3. Si es de producción, avisá a P4 para que la cargue en Render o Netlify.

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

## Antes de dormir (si alguien duerme)

- Mergeá tu rama a `main`.
- Dejá escrito en el grupo qué quedó a medias y dónde.
- Verificá que `main` compile. Si rompiste algo, revertí antes de irte.
