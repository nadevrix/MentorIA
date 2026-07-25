import { daysAgo, round, salesInPeriod, today } from './tools/helpers.js';
import type { ToolContext } from './tools/registry.js';

/**
 * Obligaciones tributarias — Bolivia, Régimen General.
 *
 * ADVERTENCIA, y es la razón por la que este módulo existe con esta forma:
 * esto NO es una declaración ni reemplaza al contador. Es una ESTIMACIÓN que
 * sirve para dos cosas: que el dueño no se olvide de un vencimiento y que sepa
 * más o menos cuánta plata tiene que tener guardada. Nada más.
 *
 * Todo el cálculo es determinista y sin modelo, igual que el resto del sistema.
 * Un número tributario inventado por un LLM sería inaceptable.
 *
 * Límites conocidos de la estimación, declarados donde el usuario los ve:
 *  - El crédito fiscal IVA sólo existe con factura válida. Nuestro modelo de
 *    gastos no registra si hubo factura, así que se asume que las compras de
 *    mercadería la tienen y el resto no. Es el supuesto menos malo, no la verdad.
 *  - El IUE se estima sobre la utilidad del periodo, no sobre la base imponible
 *    fiscal real, que tiene ajustes que no modelamos.
 *  - Las fechas siguen el calendario por último dígito del NIT. El SIN puede
 *    modificarlo por resolución; hay que confirmarlo con el contador.
 */

/** Alícuotas vigentes del Régimen General. */
export const ALICUOTAS = {
  /** IVA: 13%, aplicado "por dentro" — ya está incluido en el precio de venta. */
  iva: 0.13,
  /** IT: 3% sobre ingresos brutos. */
  it: 0.03,
  /** IUE: 25% sobre la utilidad neta imponible. */
  iue: 0.25,
} as const;

/**
 * Día de vencimiento mensual según el último dígito del NIT.
 * Calendario clásico del SIN: dígito 0 vence el 13, y así hasta el 9 el 22.
 */
const VENCIMIENTO_POR_DIGITO: Record<number, number> = {
  0: 13,
  1: 14,
  2: 15,
  3: 16,
  4: 17,
  5: 18,
  6: 19,
  7: 20,
  8: 21,
  9: 22,
};

export type TipoImpuesto = 'iva' | 'it' | 'iue';

export interface Obligacion {
  tipo: TipoImpuesto;
  nombre: string;
  /** Periodo que se declara, p. ej. "julio 2026" o "gestión 2026". */
  periodo: string;
  /** Monto estimado a pagar en Bs. Cero significa que no hay saldo, no que no haya que declarar. */
  montoBob: number;
  vencimiento: string;
  /** Negativo si ya venció. */
  diasParaVencer: number;
  estado: 'vencida' | 'proxima' | 'programada';
  /** Cómo se llegó a ese monto, en una línea. */
  formula: string;
  /** Qué asumimos para poder calcularlo. Se muestra siempre. */
  supuesto?: string;
}

export interface TaxConfig {
  /** Último dígito del NIT: define el día de vencimiento mensual. */
  digitoNit: number;
  /** Sólo el Régimen General declara IVA/IT/IUE de esta forma. */
  regimen: 'general' | 'simplificado';
}

export const DEFAULT_TAX_CONFIG: TaxConfig = { digitoNit: 0, regimen: 'general' };

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function estado(dias: number): Obligacion['estado'] {
  if (dias < 0) return 'vencida';
  if (dias <= 10) return 'proxima';
  return 'programada';
}

export interface TaxSummary {
  regimen: TaxConfig['regimen'];
  digitoNit: number;
  /** Total que conviene tener reservado, sumando lo vencido y lo próximo. */
  totalPorPagarBob: number;
  vencidasBob: number;
  obligaciones: Obligacion[];
  /** Base de cálculo, para que el contador pueda auditar de dónde salió todo. */
  base: {
    ventasMesBob: number;
    comprasConFacturaMesBob: number;
    ventasAnioBob: number;
    utilidadAnioBob: number;
  };
  advertencia: string;
}

export async function buildTaxes(
  ctx: ToolContext,
  config: Partial<TaxConfig> = {},
): Promise<TaxSummary> {
  const cfg = { ...DEFAULT_TAX_CONFIG, ...config };
  const [sales, expenses] = await Promise.all([ctx.data.sales(), ctx.data.expenses()]);

  const ahora = today();
  const anio = ahora.getUTCFullYear();
  const mes = ahora.getUTCMonth();

  // Mes calendario anterior: es el periodo que se declara este mes.
  const mesDecl = mes === 0 ? 11 : mes - 1;
  const anioDecl = mes === 0 ? anio - 1 : anio;
  const desde = `${anioDecl}-${String(mesDecl + 1).padStart(2, '0')}-01`;
  const hasta = `${anioDecl}-${String(mesDecl + 1).padStart(2, '0')}-31`;

  const enMes = (fecha: string) => fecha >= desde && fecha <= hasta;

  const ventasMes = round(
    sales.filter((s) => enMes(s.date)).reduce((acc, s) => acc + s.totalBob, 0),
  );
  // Supuesto declarado: sólo la compra de mercadería genera crédito fiscal.
  const comprasConFactura = round(
    expenses
      .filter((e) => enMes(e.date) && e.category === 'mercaderia')
      .reduce((acc, e) => acc + e.amountBob, 0),
  );

  const dia = VENCIMIENTO_POR_DIGITO[cfg.digitoNit] ?? 13;
  // Se declara en el mes siguiente al periodo.
  const vencMensual = new Date(Date.UTC(anioDecl, mesDecl + 1, dia));
  const diasMensual = -daysAgo(iso(vencMensual));
  const periodo = `${MESES[mesDecl]} ${anioDecl}`;

  const obligaciones: Obligacion[] = [];

  if (cfg.regimen === 'general') {
    const debito = round(ventasMes * ALICUOTAS.iva);
    const credito = round(comprasConFactura * ALICUOTAS.iva);
    const ivaAPagar = round(Math.max(0, debito - credito));

    obligaciones.push({
      tipo: 'iva',
      nombre: 'IVA — Form. 200',
      periodo,
      montoBob: ivaAPagar,
      vencimiento: iso(vencMensual),
      diasParaVencer: diasMensual,
      estado: estado(diasMensual),
      formula: `Débito Bs ${debito.toLocaleString('es-BO')} (13% de ventas) − crédito Bs ${credito.toLocaleString('es-BO')} (13% de compras con factura)`,
      supuesto:
        credito > 0
          ? 'El crédito fiscal se estimó sobre las compras de mercadería, asumiendo que todas tienen factura válida.'
          : 'No se registraron compras con factura en el periodo, así que no hay crédito fiscal que descontar.',
    });

    const it = round(ventasMes * ALICUOTAS.it);
    obligaciones.push({
      tipo: 'it',
      nombre: 'IT — Form. 400',
      periodo,
      montoBob: it,
      vencimiento: iso(vencMensual),
      diasParaVencer: diasMensual,
      estado: estado(diasMensual),
      formula: `3% de Bs ${ventasMes.toLocaleString('es-BO')} de ingresos brutos`,
      supuesto:
        'El IT puede compensarse con el IUE efectivamente pagado de la gestión anterior. Esa compensación no está considerada acá.',
    });
  }

  // IUE: anual, sobre la utilidad de la gestión. Cierre 31/12 para comercio y
  // servicios; vence 120 días después.
  const ventasAnio = round(
    salesInPeriod(sales, 'todo')
      .filter((s) => s.date.startsWith(String(anio)))
      .reduce((acc, s) => acc + s.totalBob, 0),
  );
  const gastosAnio = round(
    expenses
      .filter((e) => e.date.startsWith(String(anio)))
      .reduce((acc, e) => acc + e.amountBob, 0),
  );
  const utilidadAnio = round(ventasAnio - gastosAnio);

  if (cfg.regimen === 'general') {
    const vencIue = new Date(Date.UTC(anio + 1, 3, 30)); // 30 de abril
    const diasIue = -daysAgo(iso(vencIue));
    obligaciones.push({
      tipo: 'iue',
      nombre: 'IUE — Form. 500',
      periodo: `gestión ${anio}`,
      montoBob: round(Math.max(0, utilidadAnio) * ALICUOTAS.iue),
      vencimiento: iso(vencIue),
      diasParaVencer: diasIue,
      estado: estado(diasIue),
      formula: `25% de Bs ${utilidadAnio.toLocaleString('es-BO')} de utilidad acumulada del año`,
      supuesto:
        'Estimación sobre la utilidad contable del periodo, no sobre la base imponible fiscal: el IUE tiene ajustes (gastos no deducibles, depreciaciones) que este cálculo no hace.',
    });
  }

  obligaciones.sort((a, b) => a.diasParaVencer - b.diasParaVencer);

  const vencidas = round(
    obligaciones.filter((o) => o.estado === 'vencida').reduce((s, o) => s + o.montoBob, 0),
  );
  const porPagar = round(
    obligaciones
      .filter((o) => o.estado !== 'programada')
      .reduce((s, o) => s + o.montoBob, 0),
  );

  return {
    regimen: cfg.regimen,
    digitoNit: cfg.digitoNit,
    totalPorPagarBob: porPagar,
    vencidasBob: vencidas,
    obligaciones,
    base: {
      ventasMesBob: ventasMes,
      comprasConFacturaMesBob: comprasConFactura,
      ventasAnioBob: ventasAnio,
      utilidadAnioBob: utilidadAnio,
    },
    advertencia:
      'Estimación para no perder vencimientos y saber cuánto reservar. No es una declaración ' +
      'ni reemplaza a tu contador: la base imponible real tiene ajustes que este cálculo no hace.',
  };
}
