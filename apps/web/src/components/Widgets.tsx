import type { ReactNode } from 'react';
import { bob } from '../lib/api';
import BarList from './charts/BarList';
import Icon from './Icon';
import Donut from './charts/Donut';
import LineChart from './charts/LineChart';

/**
 * Grilla de widgets del panel principal, con la composición de la referencia:
 * fila 1 → tarjeta compacta + dona + gráfico ancho; fila 2 → ancho + medio.
 *
 * Paleta de series medida contra la superficie real del vidrio (#ECF1F7, el
 * peor caso: vidrio apoyado sobre la luz azul del fondo). Azul y naranja miden
 * ΔE 25,3 en el peor caso de daltonismo y ambos pasan el piso de 3:1. El
 * naranja anterior (#EB6834) daba 2,82:1 ahí: se veía bien sobre el lienzo
 * pelado y se caía justo donde el fondo tiene color. El rojo y el ámbar de la
 * marca quedan para el cromo de la interfaz, no para codificar datos.
 */
const SERIES = { azul: '#2a78d6', naranja: '#e35d28' };

/** Paleta de estado, reservada: nunca se reutiliza como color de serie. */
const ESTADO = { bueno: '#0b970b', atencion: '#c2740a', critico: '#d03b3b' };

interface Props {
  data: Record<string, any>;
}

function Card({
  title,
  hint,
  className = '',
  children,
}: {
  title?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-[var(--radius-card)] glass p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <span className="text-[11px] text-[var(--color-muted)]">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/** "2026-07-25" → "25 jul" */
function shortDate(iso: string): string {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${meses[Number(m) - 1] ?? ''}`;
}

function FlowRow({
  label,
  amount,
  direction,
}: {
  label: string;
  amount: number;
  direction: 'in' | 'out';
}) {
  const out = direction === 'out';
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${
          out ? 'bg-[var(--color-bad)]/15 text-[var(--color-bad)]' : 'bg-[var(--color-good)]/15 text-[var(--color-good)]'
        }`}
      >
        <Icon name={out ? 'up' : 'down'} size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[17px] font-semibold leading-tight">{bob(amount)}</div>
        <div className="text-[11px] text-[var(--color-muted)]">{label}</div>
      </div>
    </div>
  );
}

export default function Widgets({ data }: Props) {
  const serieFx: { fecha: string; tipoCambio: number; regimen: 'fijo' | 'flexible' }[] =
    data.series?.fx ?? [];
  const serieVentas: { fecha: string; totalBob: number }[] = data.series?.ventas ?? [];
  const gastos: Record<string, number> = data.finanzas?.gastosPorCategoria ?? {};
  const top: any[] = data.topProductos?.productos ?? [];
  const fin = data.finanzas ?? {};
  const m = data.margenes ?? {};

  const gastosRows = Object.entries(gastos)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const total = m.totalProductos ?? 0;
  const criticos = m.totalPerdiendoDinero ?? 0;
  // "En riesgo" ya incluye a los que pierden dinero: restamos para no contarlos dos veces.
  const erosionados = Math.max(0, (m.totalEnRiesgo ?? 0) - criticos);
  const sanos = Math.max(0, total - criticos - erosionados);

  const margenPct = fin.margenNetoPct ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* Fila 1 — compacta / dona / gráfico ancho */}
      <Card className="lg:col-span-3" >
        <div className="space-y-4">
          <FlowRow label="Ingresos 30 días" amount={fin.ingresosBob ?? 0} direction="in" />
          <FlowRow
            label="Costos y gastos"
            amount={(fin.costoMercaderiaVendidaBob ?? 0) + (fin.gastosOperativosBob ?? 0)}
            direction="out"
          />
        </div>

        <div className="mt-4 rounded-xl bg-[var(--color-raised)] p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-[var(--color-muted)]">Utilidad neta</span>
            <span className="text-[11px] font-semibold text-[var(--color-muted)]">{margenPct}%</span>
          </div>
          <div className="mt-1 text-[17px] font-semibold">{bob(fin.utilidadNetaBob ?? 0)}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(2, Math.abs(margenPct)))}%`,
                background: margenPct >= 0 ? ESTADO.bueno : ESTADO.critico,
              }}
            />
          </div>
        </div>
      </Card>

      {total > 0 && (
        <Card title="Salud del margen" className="lg:col-span-3">
          <Donut
            centerValue={String(total)}
            centerLabel="productos"
            slices={[
              { label: 'Margen sano', value: sanos, color: ESTADO.bueno },
              { label: 'Erosionado', value: erosionados, color: ESTADO.atencion },
              { label: 'Bajo costo', value: criticos, color: ESTADO.critico },
            ]}
          />
        </Card>
      )}

      {serieFx.length > 1 && (
        <Card
          title="Tipo de cambio"
          hint={
            // Sólo se compara dentro del mismo régimen: mezclarlos daría una
            // "subida" que en realidad es el cambio de reglas del 29/06/2026.
            (() => {
              const flex = serieFx.filter((r) => r.regimen === 'flexible');
              if (flex.length < 2) return `${serieFx.length} días`;
              const a = flex[0]!.tipoCambio;
              const b = flex.at(-1)!.tipoCambio;
              const pct = (((b - a) / a) * 100).toFixed(1);
              return `${Number(pct) > 0 ? '+' : ''}${pct}% desde la unificación`;
            })()
          }
          className="lg:col-span-6"
        >
          <LineChart
            labels={serieFx.map((r) => shortDate(r.fecha))}
            format={(v) => `Bs ${v.toFixed(2)}`}
            height={160}
            area
            series={[
              {
                id: 'tc',
                label: 'Bs por USD',
                color: SERIES.naranja,
                values: serieFx.map((r) => r.tipoCambio),
              },
            ]}
          />
        </Card>
      )}

      {/* Fila 2 — gráfico ancho / lista */}
      {serieVentas.length > 1 && (
        <Card title="Ventas por día" hint="últimos 30 días" className="lg:col-span-7">
          <LineChart
            labels={serieVentas.map((r) => shortDate(r.fecha))}
            format={bob}
            height={170}
            area
            zeroBased
            series={[
              { id: 'ventas', label: 'Ventas', color: SERIES.azul, values: serieVentas.map((r) => r.totalBob) },
            ]}
          />
        </Card>
      )}

      {(gastosRows.length > 0 || top.length > 0) && (
        <Card title="Gastos por categoría" hint="30 días" className="lg:col-span-5">
          <BarList rows={gastosRows} format={bob} color={SERIES.naranja} />
          {top.length > 0 && (
            <>
              <h4 className="mb-3 mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Productos que más dejan
              </h4>
              <BarList
                rows={top.slice(0, 4).map((p) => ({ label: p.nombre, value: p.utilidadEstimadaBob }))}
                format={bob}
                color={SERIES.azul}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
