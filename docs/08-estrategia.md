# 08 — Estrategia: dónde invertir las horas

Este documento existe porque el instinto natural en un hackathon es "agregar más cosas", y en este
caso eso es lo que menos rinde. Acá está el razonamiento completo.

## Cómo puntúa realmente el jurado

| Criterio | Peso |
| --- | --- |
| Claridad del problema y caso de uso | 20% |
| Nivel de ejecución técnica | 25% |
| Uso significativo de IA y agentes | 20% |
| Calidad de la demo y UX | 15% |
| Potencial real y originalidad | 20% |

**"El proyecto más avanzado gana" es medio cierto y medio falso.** La ejecución técnica es 25%,
no 100%. Un producto en producción con un problema difuso pierde contra un MVP afiladísimo con un
caso de uso nítido.

Pero hay algo real detrás de esa intuición: "¿escala más allá del demo?" está en ejecución técnica
y "¿tiene vida más allá del hackathon?" en potencial. Eso es **45% que premia que se sienta real**.
Por eso parece que lo más avanzado gana: lo avanzado se nota en varios criterios a la vez.

## Qué lee un jurado como "producción"

En 6 minutos nadie puede evaluar tu infraestructura. Lo que sí puede evaluar:

| **No** lee como producción | **Sí** lee como producción |
| --- | --- |
| Una base de datos que reemplaza un JSON de solo lectura | Datos de un comercio real, con nombre |
| Un pipeline de CI | El jurado lo abre en su celular y funciona |
| Autenticación multiusuario | Un usuario real que ya lo usó y puede decirlo |
| Cobertura de tests | Manejo de errores visible cuando algo falla |

Cambiar JSON por Postgres no mueve un punto de la rúbrica si los datos que hay adentro son
inventados. **Un dueño de tienda diciendo "esto me sirve" mueve tres criterios.**

## La escalera, en orden de retorno

1. **URL pública que funciona sin explicación.** Sin esto no compiten. Es la tarea #1 de P4 y va
   primero que cualquier feature.
2. **Datos de un comercio real.** Es el salto más grande de toda la lista: cruza de "demo" a
   "producto", y el track descalifica explícitamente demos que solo corren con datos hardcodeados.
3. **Que alguien externo lo use antes del pitch.** Aunque sea un comerciante conocido por WhatsApp.
   Poder decir *"lo probó Don X y encontró dos productos que vendía perdiendo plata"* vale más que
   cualquier funcionalidad.
4. **Que no se rompa en vivo.** Errores manejados, estados de carga, Render despierto.
5. **Recién ahí: base de datos real, alertas proactivas, features nuevas.**

Si terminan 1–4 antes de la medianoche, lo que más suma es **Neon con datos reales adentro + el reto
Zavu** (alerta automática por Telegram/email cuando un producto cruza el umbral de margen). Esa
combinación produce el efecto "esto ya está funcionando", que es exactamente lo que buscan.

## Lo que NO hay que hacer

**No agregar agentes.** Cinco ya son más de los que se pueden mostrar en 4 minutos. Cada agente
nuevo diluye el pitch y no agrega puntos.

**No construir la plataforma amplia.** La idea original del equipo era una plataforma con todos los
módulos del negocio (finanzas, ventas, inventario, marketing, contabilidad, compras, reportes). El
track penaliza explícitamente las ideas genéricas y sin diferenciación local, y una plataforma de
ocho módulos en 24 horas es exactamente eso: mucha superficie, poca profundidad, nada que un jurado
no haya visto tres veces esa mañana.

**Qué se hizo en cambio:** cinco agentes, todos anclados a la misma tesis del dólar. El de
Inventario decide reponer según la tendencia del paralelo; el Financiero valúa el costo de ventas a
reposición. No son módulos sueltos: son la misma idea vista desde cinco ángulos.

**No cambiar de base de datos por prolijidad.** Los agentes solo leen; nada escribe. Un JSON
validado con Zod es suficiente hasta que haya datos reales grandes, multiusuario o escritura.

## El pitch: qué vender

**Vendan el agente cambiario.** El diferencial es la métrica de margen a costo de reposición: es
concreta, medible, específica de un mercado, y ningún ERP disponible en Bolivia la calcula.

Los otros cuatro agentes **no son el pitch** — son la prueba de que esto escala más allá de un
truco. Mencionarlos en 20 segundos, no demostrarlos.

Guion completo en `docs/06-demo-pitch.md`.

## Base de datos: Neon vs Supabase

Si en algún momento se agrega una (paso 5 de la escalera):

| | Neon | Supabase |
| --- | --- | --- |
| Es | Postgres serverless | Postgres + auth + API REST + storage |
| Ventaja | Más simple, arranca rápido, branching de DB | Trae autenticación gratis |
| Cold start | Sí, ~500 ms en free tier | Menor |

Con solo tablas, Neon es más liviano. Si en algún momento quieren login de varios comercios,
Supabase ahorra escribir auth.

En ambos casos es **una clase de ~60 líneas** que implementa `DataSource`, sin tocar ningún agente
ni ninguna herramienta. Esa es la razón de que exista la interfaz. Ver `docs/04-datos.md`.

## Riesgos que sí pueden costarles el hackathon

Ninguno es técnico:

1. **Llegar a las 09:00 sin URL pública.** Descalifica.
2. **Demo con datos inventados.** El track lo dice explícitamente.
3. **Render dormido en el escenario.** 40 segundos de arranque en frío sobre 4 minutos de pitch.
   Abrir `<API>/health` cinco minutos antes.
4. **Pitch sin ensayar.** Tres veces, cronometrado, en voz alta.
5. **`main` roto a las 08:00** porque alguien pusheó sin correr el build.
