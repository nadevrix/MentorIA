# 00 — Visión

## El problema, en una frase

Una PyME importadora boliviana puede estar vendiendo bien y perdiendo plata al mismo tiempo, porque
su precio está fijado al dólar de cuando compró y su costo de reposición al dólar de hoy.

## Por qué pasa

| Hecho                                                        | Consecuencia                                            |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| El 29/06/2026 el BCB terminó 15 años de tipo fijo: ahora flota | El costo de importar cambia **todos los días**          |
| El Tipo de Cambio Oficial subió ~17% en menos de un mes       | El costo de reposición sube más rápido que los precios  |
| El comercio fija precios una vez y los revisa "cuando duele"  | El margen se erosiona sin que nadie lo mida             |
| Las herramientas que usa (Excel, cuaderno, WhatsApp) no saben de tipo de cambio | Nadie le avisa hasta que se queda sin capital |

El dueño no necesita más datos. Necesita que alguien le diga **qué hacer con los datos que ya tiene.**

## Usuario

**Comercio importador o distribuidor pequeño en Bolivia** (Santa Cruz, La Paz, Cochabamba):
electrónica, accesorios, repuestos, cosmética, ferretería. Entre 1 y 15 empleados. Compra en dólares,
vende en bolivianos. Ya lleva algún registro digital (Excel, un POS, o un ERP básico).

Quien usa el producto es **el dueño o el administrador**, no un analista. Está en el mostrador.
Si la respuesta no cabe en la pantalla del celular y no dice qué hacer, no sirve.

## Propuesta de valor

> Un equipo de agentes que revisa tu negocio todos los días y te dice qué hacer antes de que el
> problema te cueste plata: qué precio subir, cuánto, qué reponer, a quién cobrar.

Lo que **no** somos: un ERP, un CRM, ni un chatbot que contesta preguntas sobre la empresa.
Nos paramos **encima** de los datos que el negocio ya tiene y aportamos la capa de decisión.

## Por qué esto no existía bien

- **Los ERP internacionales** (Odoo, Bind, Alegra) valúan el inventario al costo histórico. Con un
  tipo de cambio que flota a diario, ese número deja de significar algo: lo que importa es a cuánto
  reponés hoy, y ninguno lo calcula.
- **Los dashboards de BI** muestran el pasado. No deciden ni recomiendan.
- **Los chatbots genéricos** no tienen acceso a las cifras del negocio ni herramientas para calcular.
- La transición a tipo de cambio flexible es **un evento de hace cuatro semanas**: ningún producto
  existente está calibrado para eso, y miles de comercios acaban de quedar con listas de precios
  obsoletas. Argentina y Venezuela pasaron por lo mismo. Nadie con producto global lo resuelve primero.

## Diferencial defendible

1. **El cálculo de margen a costo de reposición** — no es un dashboard más: es una métrica que
   ningún ERP disponible en el país calcula, y es exactamente la que decide si el negocio sobrevive.
2. **Datos locales** — serie real del TCO del BCB, canales reales (WhatsApp, Facebook, mayoreo), categorías
   de gasto e impuestos bolivianos (IVA/IT).
3. **Salida accionable** — cada respuesta termina en instrucciones ejecutables, no en un gráfico.

## Alcance del hackathon

**Dentro (24 h):**
- Panel determinista con los indicadores críticos.
- Los 5 agentes con sus 10 herramientas sobre datos reales de un comercio piloto.
- Simulación de escenarios cambiarios.
- Deploy público accesible sin instalar nada.

**Fuera (pero diseñado para entrar):**
- Escritura de vuelta al ERP (hoy solo lectura y recomendación).
- Conector Odoo / integración con facturación.
- Alertas proactivas por WhatsApp o Telegram (ver reto Zavu en `docs/02-equipo.md`).
- Multi-empresa con autenticación.

## Cómo se ve el éxito

Que un comerciante entre, vea "2 productos se venden bajo costo de reposición", pregunte
"¿cuánto tengo que subirlos?", reciba precios concretos y **cambie sus etiquetas esa misma tarde.**
