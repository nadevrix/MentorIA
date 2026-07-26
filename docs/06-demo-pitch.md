# 06 — Demo y pitch

**Formato:** 4 minutos de pitch + 2 de preguntas. Demo en vivo obligatoria; el video solo complementa.

## Cómo puntúa el jurado

| Criterio | Peso | Dónde lo ganamos |
| -------- | ---- | ---------------- |
| Claridad del problema | 20% | El caso del dólar contado con un producto concreto en 30 segundos. **La unificación del 29/06 es noticia fresca: el jurado boliviano la vive** |
| Ejecución técnica | 25% | Loop de agentes real, arquitectura con interfaces, deploy funcionando |
| Uso de IA y agentes | 20% | Mostrar las herramientas ejecutándose en vivo, no un chat genérico |
| Demo y UX | 15% | Que corra en vivo sin fricción y se entienda sin explicación |
| Potencial y originalidad | 20% | Métrica que ningún ERP calcula + mercado boliviano y LatAm |

## Guion (3:50)

### 0:00 – 0:40 · El problema, con un caso

> "El 29 de junio, hace menos de un mes, el BCB terminó con 15 años de dólar fijo: hoy el tipo de
> cambio flota y se mueve todos los días. Ya subió 17% desde entonces.
>
> Don Beto importa accesorios en Santa Cruz. Puso precio a sus cables cuando compraba dólares a 7,60.
> Hoy repone a 11,37. **Cada cable que vende le hace perder 9%**, y su Excel no se lo dice — porque
> su Excel no sabe que el dólar cambió esta mañana.
>
> Ese es el problema: en Bolivia el precio se fija con el dólar de ayer y se repone con el de hoy.
> Y desde hace un mes, 'ayer' es literalmente ayer."

*(Verificar los números contra el panel el día del pitch: el tipo de cambio se actualiza solo.)*

### 0:40 – 1:00 · Qué construimos

> "Mentor IA: cinco agentes que leen las ventas, el inventario y el tipo de cambio del negocio, y
> devuelven qué hacer. No es un dashboard: es un equipo que decide."

Abrir la URL pública, ya cargada. Señalar la tarjeta roja: **"3 productos se venden bajo costo de reposición."**

### 1:00 – 2:20 · Demo en vivo (el núcleo)

**Pregunta 1 — al Agente de Precios:**
> *"¿Qué precios tengo que subir?"*

Mientras responde, **señalar la traza de herramientas** en pantalla:
> "Ahí lo ven: el agente decidió consultar el tipo de cambio primero, después recalcular los márgenes,
> y recién ahí calcular los precios. Nadie le dijo el orden — lo decidió él."

Leer la salida: producto, precio actual, precio sugerido, ajuste porcentual.

**Pregunta 2 — el escenario:**
> *"¿Y si el dólar llega a 13?"*

> "Esto es lo que un importador no puede hacer con ninguna herramienta que tenga hoy: proyectar su
> catálogo entero contra un tipo de cambio que todavía no pasó."

### 2:20 – 3:00 · Por qué es defendible

> "El cálculo central es el margen a costo de reposición. Los ERP internacionales asumen un solo tipo
> de cambio y que es el oficial — en Bolivia esa suposición está rota, y ahí es exactamente donde se
> pierde el margen. La arquitectura es de interfaces: `DataSource` y `FxProvider`. Conectar el Excel
> de un comercio, Supabase u Odoo es implementar una clase. Los agentes no cambian."

### 3:00 – 3:30 · Mercado y siguiente paso

> "Bolivia tiene decenas de miles de comercios importadores con este problema hoy. Argentina y
> Venezuela tienen el mismo mercado con distinto nombre. El siguiente paso es la alerta proactiva:
> que el agente avise por WhatsApp cuando un producto cruza el umbral, sin que nadie entre a la app."

*(Si el reto Zavu quedó implementado, mostrarlo acá en lugar de contarlo.)*

Las pestañas Impuestos, Trámites, Mis datos y Marketing demuestran amplitud, pero no se navegan
durante el guion principal. Se mencionan en una frase o se reservan para preguntas.

### 3:30 – 3:50 · Cierre

> "Mentor IA: agentes que protegen el margen de las PyMEs bolivianas cuando se mueve el dólar.
> Está desplegado, la URL está en el repo, pueden probarlo desde su celular ahora mismo."

## Preparación (30 min antes)

- [ ] Abrir `<API>/health` y confirmar que el deploy correcto está saludable
- [ ] Confirmar que `llm` en `/health` trae `provider` y `model`
- [ ] Confirmar que `baseSource` corresponde al dataset que se presentará
- [ ] Probar **dos preguntas seguidas**; si aparece 429, distinguir el límite local de la cuota del proveedor
- [ ] Cargar la URL pública en el navegador y hacer una consulta completa de prueba
- [ ] Correr `node data/generate.mjs` si el dataset debe verse fresco, y **anotar los números nuevos**
- [ ] Cerrar Slack, notificaciones y demás pestañas
- [ ] Zoom del navegador al 125% — el proyector está lejos
- [ ] Modo oscuro, tema por defecto (ya está)
- [ ] Capturas del plan B abiertas en pestañas al lado

## Plan B

| Falla | Respuesta |
| ----- | --------- |
| Sin WiFi | Correr en local contra `localhost` y decirlo: "esto corre en Render, acá va local por la red" |
| Modelo caído o con 429 | Cambiar `LLM_PROVIDER` al otro proveedor. Si tampoco, mostrar el panel (es determinista, funciona sin modelo) + capturas de una conversación real |
| API de Render no responde | Pasar al panel local o a las capturas y revisar `/health` después; Starter no debería tener cold start |
| Un agente responde mal en vivo | No repetir la misma pregunta. Pasar a la siguiente del guion y seguir |

**Nunca digas "no sé por qué falla".** Decí qué debería estar pasando y seguí. Si la demo falla,
mostrar capturas o código impacta la puntuación pero no descalifica.

## Preguntas probables del jurado

**"¿Esto es un agente o un chatbot con prompt largo?"**
> Mostrar la traza: el modelo elige qué herramientas llamar y en qué orden según la pregunta.
> Cada herramienta ejecuta lógica de negocio sobre los datos, no texto.

**"¿Funciona con datos reales o solo con los suyos?"**
> Enseñar la interfaz `DataSource` y decir con qué comercio se probó. *(De ahí que conseguir datos
> reales sea la prioridad #2 del backlog.)*

**"¿De dónde sacan el tipo de cambio?"**
> Mostrar el campo `source` de la cotización. En modo estático se usa el histórico versionado; con
> Firecrawl se consulta `boliviabolivar.com` y se vuelve al histórico si el scraping falla. No
> presentar el scraping como una conexión directa al BCB.

**"¿Por qué no lo hace Odoo?"**
> Porque modela un solo tipo de cambio y asume que es el oficial. Nosotros no reemplazamos al ERP:
> nos paramos encima.

**"¿Cuánto cuesta correr esto por cliente?"**
> El panel es determinista y no consume tokens. Chat y resumen sí. Tener a mano el uso de una
> consulta típica (sale en el evento `done`) y separar costo del modelo de costo de hosting.
