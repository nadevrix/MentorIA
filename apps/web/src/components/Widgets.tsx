import { bob } from '../lib/api';
import BarList from './charts/BarList';
import LineChart from './charts/LineChart';

/**
 * Fila de widgets del panel principal.
 *
 * Paleta de series validada contra la superficie #242A2F: azul y naranja miden
 * ΔE 26,8 en el peor caso de daltonismo. El rojo y el ámbar de la marca quedan
 * para el cromo de la interfaz, no para codificar datos.
 */
const SERIES = {
  azul: '#3987e5',
  naranja: '#d95926',
};

interface Props {
  data: Record<string, any>;
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[11px] text-[var(--color-muted)]">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** "2026-07-25" → "25 jul" */
function shortDate(iso: string): string {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${meses[Number(m) - 1] ?? ''}`;
}

export default function Widgets({ data }: Props) {
  const serieFx: { fecha: string; oficial: number; paralelo: number }[] = data.series?.fx ?? [];
  const serieVentas: { fecha: string; totalBob: number }[] = data.series?.ventas ?? [];
  const gastos: Record<string, number> = data.finanzas?.gastosPorCategoria ?? {};
  const top: any[] = data.topProductos?.productos ?? [];

  const gastosRows = Object.entries(gastos)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {serieFx.length > 1 && (
        <Card title="Tipo de cambio" hint={`${serieFx.length} días`}>
          <LineChart
            labels={serieFx.map((r) => shortDate(r.fecha))}
            format={(v) => `Bs ${v.toFixed(2)}`}
            height={150}
            series={[
              {
                id: 'oficial',
                label: 'Oficial',
                color: SERIES.azul,
                values: serieFx.map((r) => r.oficial),
              },
              {
                id: 'paralelo',
                label: 'Paralelo',
                color: SERIES.naranja,
                values: serieFx.map((r) => r.paralelo),
              },
            ]}
          />
        </Card>
      )}

      {serieVentas.length > 1 && (
        <Card title="Ventas por día" hint="últimos 30 días">
          <LineChart
            labels={serieVentas.map((r) => shortDate(r.fecha))}
            format={bob}
            height={150}
            area
            zeroBased
            series={[
              {
                id: 'ventas',
                label: 'Ventas',
                color: SERIES.azul,
                values: serieVentas.map((r) => r.totalBob),
              },
            ]}
          />
        </Card>
      )}

      {gastosRows.length > 0 && (
        <Card title="Gastos por categoría" hint="últimos 30 días">
          <BarList rows={gastosRows} format={bob} color={SERIES.naranja} />
        </Card>
      )}

      {top.length > 0 && (
        <Card title="Productos que más dejan" hint="utilidad, 30 días">
          <BarList
            rows={top.map((p) => ({ label: p.nombre, value: p.utilidadEstimadaBob }))}
            format={bob}
            color={SERIES.azul}
          />
        </Card>
      )}
    </div>
  );
}
