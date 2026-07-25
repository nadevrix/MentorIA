# 09 — Estrategia de producto y mercado

## 1. El problema

Un importador de repuestos en Santa Cruz con 6 empleados y Bs 400.000 de facturación mensual:

- Lleva ventas en un cuaderno y en un Excel que solo él entiende.
- No sabe su utilidad real hasta que el contador cierra el mes, 20 días tarde.
- Compró 200 unidades de un producto que lleva 8 meses sin rotar; ese capital está muerto
  y él no lo ve porque no tiene reporte de rotación.
- El dólar paralelo subió 12% y sigue vendiendo con la lista de precios de hace mes y medio.
  Está vendiendo bajo costo de reposición y **cree que está ganando**.
- Tiene 340 clientes; 90 no compran hace 5 meses. No lo sabe.
- Le ofrecieron Odoo: Bs 25.000 de implementación, 3 meses de puesta en marcha, un consultor.
  Dijo que no.

**El problema no es que le falte un sistema. Es que ningún sistema le dice qué hacer.**

Los ERP resuelven el *registro*. El vacío está en la *interpretación*: la PYME no puede pagar
un gerente financiero, un analista de datos ni un jefe de compras. Ese es el hueco que llena la IA.

### Por qué los ERP fracasan en este segmento

| Fricción | Consecuencia |
|---|---|
| Implementación de 4–12 semanas con consultor | 80% de abandono antes de ver valor |
| Interfaz diseñada para el operador, no para el dueño | El dueño nunca entra; delega y pierde visibilidad |
| Requiere que los datos estén completos para ser útil | Círculo vicioso: sin datos no hay valor, sin valor no cargan datos |
| Reportes que exigen saber qué preguntar | El dueño no sabe que debe mirar la rotación de inventario |
| Precio en USD, soporte en horario europeo | Barrera dura en Bolivia/Paraguay/Perú |

---

## 2. Público objetivo

### ICP primario (donde arrancamos)
**Importador / distribuidor / comercio mayorista boliviano**
- 3–25 empleados
- Facturación Bs 150k – 2M mensual
- Compra en USD o CNY, vende en BOB → **expuesto a tipo de cambio**
- 200–3.000 SKUs
- Ya usa Excel + WhatsApp; puede que tenga un sistema de facturación pero no de gestión
- El dueño toma todas las decisiones

**Por qué este ICP:** el dolor cambiario es agudo, cuantificable y recurrente (semanal).
Podemos demostrar valor en la primera sesión: *"estos 14 productos los estás vendiendo bajo
costo de reposición, estás perdiendo Bs 8.400 al mes"*. Eso vende solo.

### ICP secundario (expansión fase 2)
- Comercio minorista con 1–3 sucursales (ferretería, farmacia, boutique, minimarket)
- Empresa de servicios con facturación recurrente (agencia, consultora, taller)
- Negocio familiar en transición generacional (el hijo quiere digitalizar)

### Fuera de alcance (v1)
- Manufactura con producción por órdenes (requiere MRP)
- Restaurantes (requieren POS especializado y recetas)
- Empresas +100 empleados (compran ERP con licitación)

### Perfiles de usuario

| Perfil | Nombre | Rol | Qué necesita | Dónde lo usa |
|---|---|---|---|---|
| **El Dueño** | Marco, 47 | Decide todo | Saber si va bien, qué está mal, qué hacer | WhatsApp 80% / móvil 15% / desktop 5% |
| **La Administradora** | Rosa, 34 | Carga y controla | Registrar rápido, cobrar, no equivocarse | Desktop 90% |
| **El Vendedor** | Diego, 26 | Vende | Precios al día, stock real, sus comisiones | Móvil 100% |
| **El Contador** | Lic. Ayala, 52 | Externo, cierra mes | Exportar, cuadrar, facturar | Desktop, 3 días al mes |

El producto se diseña para **Marco**. Rosa es quien lo mantiene vivo. Si Rosa lo odia, el
producto muere en 3 semanas.

---

## 3. Propuesta de valor

> **"Tu empresa te avisa antes de que el problema te cueste plata."**

Tres promesas, en orden de fuerza:

1. **Te digo qué está mal hoy.** Alertas proactivas con impacto en bolivianos, no dashboards.
2. **Te digo qué hacer.** Cada alerta trae una acción con un botón.
3. **Te lo digo donde ya estás.** WhatsApp, en español boliviano, a las 8 de la mañana.

### Anti-propuesta (lo que NO somos)
- No somos un ERP completo. No hacemos nómina, producción ni contabilidad de partida doble
  completa en v1.
- No somos un chatbot. El chat es el 20% del producto.
- No reemplazamos al contador. Le damos datos limpios.

---

## 4. El diferenciador real: el Agente Cambiario

### Contexto de mercado (Bolivia, 2025–2026)
Existe una brecha persistente entre el tipo de cambio oficial (~6,96 BOB/USD, fijo) y el
mercado paralelo. Un importador:

- Compra mercadería en USD al tipo paralelo (el que realmente consigue).
- Vende en BOB con una lista de precios que actualiza "cuando se acuerda".
- Su contabilidad registra al tipo oficial → **su margen contable es ficción**.
- Cuando repone stock, descubre que el precio de venta ya no cubre el costo de reposición.

Esto es **descapitalización silenciosa**: la empresa factura, parece rentable, y se está
quedando sin capital de trabajo.

### Qué hace el agente

```
┌─ ENTRADAS ────────────────────────────────────────────────┐
│ • Tipo de cambio oficial (fuente: BCB)                     │
│ • Tipo de cambio paralelo (fuente: manual + scraping +     │
│   promedio declarado por usuarios — dato colaborativo)     │
│ • Costo de compra de cada producto, en USD, con su TC      │
│ • Precio de venta vigente en BOB                           │
│ • Fecha de última reposición y frecuencia de compra        │
└────────────────────────────────────────────────────────────┘
                          ↓
┌─ CÁLCULOS DETERMINISTAS ──────────────────────────────────┐
│ costo_reposicion_bob = costo_usd × tc_paralelo_hoy         │
│ margen_real_% = (precio_venta − costo_reposicion) / precio │
│ margen_contable_% = (precio_venta − costo_historico)/precio│
│ erosion_pp = margen_contable_% − margen_real_%             │
│ precio_sugerido = costo_reposicion / (1 − margen_objetivo) │
│ impacto_mensual_bob = Σ(unidades_vendidas_mes × Δmargen)   │
└────────────────────────────────────────────────────────────┘
                          ↓
┌─ SALIDAS ─────────────────────────────────────────────────┐
│ 1. Semáforo por producto: 🟢 sano / 🟡 erosionado /        │
│    🔴 bajo costo de reposición                             │
│ 2. Lista de precios sugerida, exportable, aplicable en     │
│    1 clic (masivo o por producto)                          │
│ 3. Simulador: "¿y si el dólar llega a 12?" → impacto en    │
│    margen, en capital de trabajo, en precio necesario      │
│ 4. Alerta push cuando el TC se mueve > umbral (def. 3%)    │
└────────────────────────────────────────────────────────────┘
```

### Por qué es defendible
- **No es un feature, es un producto entero** con su propio modelo de datos (costo en divisa,
  histórico de TC, política de márgenes por categoría).
- Requiere entender el mercado local. Odoo tiene multi-moneda; no tiene *"tu precio está
  desactualizado respecto al paralelo y estás perdiendo Bs 8.400/mes"*.
- El dato del TC paralelo mejora con cada cliente (efecto de red débil pero real).
- Aplicable a Argentina, Venezuela, Nigeria, Egipto, Turquía → el mismo motor se exporta.

---

## 5. Análisis competitivo

| | **PyME AI** | **Odoo** | **Zoho One** | **HubSpot** | **Excel + WhatsApp** |
|---|---|---|---|---|---|
| Time-to-value | 15 min | 4–12 semanas | 2–4 semanas | 1–2 semanas | 0 (ya lo usan) |
| Precio/mes PYME | USD 29–99 | USD 25/usr + implementación | USD 37/usr | USD 800+ | 0 |
| IA proactiva | **Núcleo del producto** | Copilot genérico | Zia (limitado) | Breeze (marketing) | No |
| Agentes especializados | **9** | No | No | No | No |
| Módulo cambiario LatAm | **Sí** | No | No | No | Manual |
| WhatsApp nativo | **Interfaz principal** | Add-on pago | Integración | Integración | Es el canal |
| Requiere consultor | No | Sí | Frecuentemente | Sí | No |
| Amplitud funcional | Media | **Muy alta** | **Muy alta** | Alta (CRM) | Nula |
| Facturación SIAT Bolivia | Roadmap v1.5 | Vía partner local | No | No | Sistema aparte |

### Lectura estratégica
- **No compitas por amplitud.** Odoo tiene 80 módulos. Perderás esa carrera siempre.
- **Compite por tiempo-al-primer-insight.** Nuestro objetivo: valor demostrable en 15 minutos
  desde el registro, con un Excel importado.
- **Odoo es el techo, no el enemigo.** El cliente que crece a 60 empleados se irá a Odoo.
  Está bien. Diseña la exportación limpia (retención honesta > lock-in).
- **El enemigo real es Excel.** El 70% de nuestros deals se pierden contra "así estoy bien".
  El discurso de venta debe ser: *"no te pido que dejes tu Excel — súbelo y te digo qué no
  estás viendo"*.

---

## 6. Modelo de negocio

### Planes

| | **Emprende** | **Crece** ⭐ | **Dirige** | **Empresa** |
|---|---|---|---|---|
| Precio/mes | USD 19 | USD 59 | USD 149 | Desde 400 |
| Usuarios | 2 | 8 | 25 | Ilimitado |
| Agentes | Financiero, Ventas, Inventario | + CRM, Compras, Cambiario, Reportes | Los 9 | Los 9 + custom |
| Consultas al asistente/mes | 100 | 800 | 4.000 | Ilimitado |
| Automatizaciones | 3 | 20 | Ilimitadas | Ilimitadas |
| WhatsApp | Alertas | Alertas + carga | Completo, multi-número | Completo |
| Integraciones | CSV/Excel | + 3 conectores | Todas | Todas + API |
| Sucursales | 1 | 3 | 10 | Ilimitadas |
| Soporte | Email | Chat, 24h | WhatsApp prioritario | Dedicado + SLA |

**Add-ons:** Agente Cambiario suelto USD 25/mes (gancho de entrada para importadores),
facturación electrónica SIAT USD 20/mes, conector ERP legacy USD 50/mes.

### Notas de pricing
- Precio **en USD, cobro en BOB** al tipo del día (nuestro propio problema cambiario; comerlo
  como costo y usarlo como prueba social: *"nosotros también lo sufrimos"*).
- Medios de pago obligatorios en Bolivia: **QR Simple, transferencia bancaria, tarjeta**.
  Un checkout solo-Stripe pierde el 60% del mercado.
- Cobro **anual con 2 meses gratis** — mejora el cash flow y baja el churn en un segmento
  con decisión emocional mensual.
- Freemium **no**: atrae usuarios que nunca cargan datos y disparan costo de LLM sin conversión.
  En su lugar: **prueba de 21 días con onboarding asistido** (el humano en el loop es el
  mayor predictor de activación en este segmento).

### Unit economics objetivo (plan Crece, USD 59)

| Concepto | USD/mes |
|---|---|
| Ingreso | 59,00 |
| Costo LLM (≈800 consultas + 60 ciclos de agentes) | 6,50 |
| Infra (compute, DB, storage prorrateado) | 3,00 |
| WhatsApp BSP (≈300 conversaciones) | 4,50 |
| Soporte prorrateado | 7,00 |
| **Margen bruto** | **38,00 (64%)** |

Palancas para llegar a 78%: caché de contexto de negocio, modelo pequeño para clasificación
y ruteo, modelo grande solo para síntesis, y resultados de agentes cacheados por ventana de datos.

---

## 7. Go-to-market

### Fase 1 — Cuña cambiaria (meses 1–4)
- Producto: Agente Cambiario + Inventario, standalone, USD 25/mes.
- Canal: cámaras de importadores (CADEX, CAINCO), grupos de WhatsApp de rubro,
  gremios de comerciantes.
- Táctica de entrada: **auditoría gratuita de precios**. Piden el Excel de productos con
  costos en USD → devolvemos en 24h un PDF con los productos vendidos bajo costo de reposición
  y el impacto mensual en Bs. Conversión esperada alta: el informe demuestra el valor antes
  de pedir la tarjeta.

### Fase 2 — Expansión a suite (meses 5–10)
- Upsell a Crece: los agentes Financiero, Ventas y CRM sobre datos que ya cargaron.
- Canal: contadores como partners (comisión recurrente 20%). El contador boliviano atiende
  30–80 PYMES y es el asesor de confianza. **Es el canal de distribución más eficiente del
  mercado.**

### Fase 3 — Regional (meses 11–24)
- Perú, Paraguay, Argentina. El motor cambiario reaparece en Argentina con fuerza.
- Localización: facturación electrónica por país (SUNAT, AFIP), reglas fiscales, glosario.

### Métricas del negocio

| Métrica | Definición | Meta año 1 |
|---|---|---|
| TTFI (Time To First Insight) | Registro → primer insight accionable visto | < 15 min |
| Activación | % de cuentas con ≥50 transacciones en 14 días | > 45% |
| Insight Action Rate | % de insights con acción ejecutada | > 25% |
| WAU/MAU | Uso semanal sobre mensual | > 55% |
| Churn mensual (pagos) | | < 4% |
| NDR | Net Dollar Retention | > 105% |
| CAC payback | | < 6 meses |

**La métrica norte:** *Insight Action Rate*. Si la gente no actúa sobre lo que el agente dice,
no somos un director empresarial — somos un reporte caro.
