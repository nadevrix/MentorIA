# 09 — Estrategia de producto

## Tesis

Una PyME importadora puede facturar y aun así descapitalizarse si vende con precios calculados sobre
el costo histórico y repone con el tipo de cambio vigente. El registro contable explica qué pasó;
Mentor IA intenta responder qué debe hacer hoy.

La cuña del producto es el **margen a costo de reposición**:

```text
costoReposicionBob = costUsd × tipoCambioVigente
margenRealPct = (precioBob − costoReposicionBob) / precioBob × 100
```

Para productos nacionales se conserva el tipo de cambio de compra, porque su costo en bolivianos no
se revaloriza automáticamente con el dólar.

## Usuario inicial

El ICP de la primera versión es un importador, distribuidor o comercio mayorista boliviano que:

- compra parte de su catálogo en moneda extranjera;
- vende en bolivianos;
- maneja entre decenas y pocos miles de SKUs;
- registra información en Excel, POS o un sistema básico;
- revisa precios de forma manual;
- concentra decisiones en el dueño o administrador.

El producto no está diseñado todavía para:

- manufactura con MRP;
- contabilidad completa;
- nómina;
- varias empresas aisladas dentro de la misma instancia;
- operaciones con requisitos de alta disponibilidad.

## Propuesta de valor

> Tus datos te avisan qué problema resolver antes de que te cueste capital.

La promesa se divide en tres pasos:

1. **Detectar:** hallar margen erosionado, stock crítico, capital inmovilizado, vencimientos y clientes
   en riesgo.
2. **Cuantificar:** expresar el impacto en bolivianos con cálculos deterministas.
3. **Actuar:** llevar el hallazgo al agente correcto con una pregunta preparada y una recomendación.

El chat no es el producto completo. El panel y los hallazgos deben conservar valor aunque el proveedor
LLM no esté disponible.

## Producto implementado

### Núcleo

- Cinco agentes: Director, Precios, Inventario, Finanzas y Clientes/Marketing.
- Doce herramientas acotadas por dominio.
- Selección de Gemini o Anthropic mediante `LlmProvider`.
- Tool use con hasta ocho iteraciones y ejecución paralela dentro de cada turno.
- Streaming SSE de texto, uso de herramientas y resultados.

### Cálculo y datos

- Panel determinista.
- Motor de nueve detectores.
- Simulador sobre el catálogo completo.
- Datos JSON o PostgreSQL.
- Importación CSV temporal por entidad.
- Fuente estática de tipo de cambio y opción Firecrawl con fallback.

### Superficie de producto

- Resumen del día.
- Panel de dólar y escenarios.
- Impuestos estimados y formularios de referencia.
- Seguimiento de formalización.
- Selección de productos para marketing.
- Generación opcional de imágenes.

## Diferenciación

### Frente a un ERP

Mentor IA no intenta reemplazar registro, facturación o contabilidad. Consume datos existentes y
agrega una capa de decisión especializada en costo de reposición.

### Frente a un dashboard

Un dashboard muestra métricas. Mentor IA prioriza hallazgos por urgencia e impacto, y los conecta con
una acción.

### Frente a un chatbot

Los números no salen del modelo. El agente decide qué herramientas consultar; las herramientas
validan datos y ejecutan los cálculos.

## Evidencia y afirmaciones

El repositorio incluye un dataset de referencia. No debe presentarse como datos de un cliente.

Para afirmar validación real hacen falta:

1. autorización del comercio;
2. datos anonimizados;
3. fecha y fuente de la cotización;
4. comparación de al menos una recomendación con la decisión del dueño;
5. testimonio o resultado documentado.

Las cifras de tamaño de mercado, conversión, churn y costos que no tengan una fuente deben tratarse
como hipótesis, no como hechos.

## Modelo comercial: hipótesis

Todavía no hay evidencia para fijar planes definitivos. La hipótesis inicial es cobrar por negocio,
no por asiento, con límites de uso para controlar el costo LLM.

Antes de publicar precios se debe medir:

- número de conversaciones por negocio;
- vueltas del loop por conversación;
- costo por proveedor y modelo;
- frecuencia con que un hallazgo termina en una acción;
- tiempo de onboarding y limpieza de datos;
- disposición de pago del primer segmento.

Una prueba asistida con datos reales aporta más información que una tabla de cuatro planes
especulativos.

## Go-to-market inicial

### Entrada

Ofrecer una auditoría de margen sobre un CSV de productos:

1. recibir costo en USD, tipo de compra, precio y stock;
2. calcular costo de reposición y margen real;
3. devolver productos bajo costo o con margen erosionado;
4. validar la recomendación con el dueño;
5. invitarlo a usar el panel completo.

### Canales a validar

- cámaras y asociaciones de importadores;
- contadores que atienden varias PyMEs;
- proveedores de software de facturación;
- grupos sectoriales de WhatsApp;
- comercios conocidos del equipo.

### Expansión

Después de validar la cuña cambiaria:

- persistencia y autenticación multiempresa;
- conectores de lectura a Odoo/POS;
- alertas programadas;
- seguimiento de acciones;
- integraciones locales por país.

## Métricas

La métrica principal propuesta es **Insight Action Rate**: porcentaje de hallazgos que terminan en
una acción confirmada.

Métricas de apoyo:

| Métrica | Definición |
| --- | --- |
| Time to First Insight | Desde carga de datos hasta primer hallazgo útil |
| Activation | Negocios que cargan datos suficientes y ven un hallazgo |
| Insight Action Rate | Hallazgos sobre los que el usuario actuó |
| Cost per Resolved Insight | Costo LLM dividido por acciones confirmadas |
| Weekly Active Businesses | Negocios con actividad útil semanal |
| Data Freshness | Antigüedad de ventas, inventario y cotización |

## Riesgos

- **Datos incompletos:** sin `costUsd` o `purchaseFxRate` no puede sostenerse la comparación.
- **Fuente cambiaria frágil:** Firecrawl depende del contenido de un tercero; el fallback debe permanecer.
- **Recomendación financiera:** impuestos y trámites son estimaciones, no asesoría legal o contable.
- **Costo LLM:** una pregunta puede provocar varias llamadas.
- **Privacidad:** la demo actual no tiene autenticación ni aislamiento por negocio.
- **Confianza:** cualquier cifra no trazable destruye el valor del producto.

## Orden de inversión

1. URL pública estable.
2. Datos autorizados de un comercio.
3. Prueba con un usuario externo.
4. Demo reproducible.
5. Autenticación y persistencia.
6. Alertas y conectores.
7. Nuevas funciones sólo si mejoran una métrica validada.
