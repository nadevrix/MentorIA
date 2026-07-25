import LineChart from './charts/LineChart';
import Icon from './Icon';
import Simulator from './Simulator';

/**
 * Apartado del dólar.
 *
 * Reúne todo lo cambiario en un solo lugar: cuánto está hoy, cómo se movió,
 * qué cambió con la unificación de junio y qué pasaría si sigue subiendo.
 * El simulador vive acá y no en el resumen: es una herramienta de este tema.
 */

const NARANJA = '#eb6834';

interface Props {
  data: Record<string, any> | null;
  onAsk: (agentId: string, question: string) => void;
}

/** "2026-07-25" → "25 jul" */
function shortDate(iso: string): string {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${meses[Number(m) - 1] ?? ''}`;
}

export default function FxPanel({ data, onAsk }: Props) {
  if (!data?.fx) {
    return (
      <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-muted)]">
        Cargando tipo de cambio…
      </div>
    );
  }

  const fx = data.fx;
  const serie: { fecha: string; tipoCambio: number; regimen: 'fijo' | 'flexible' }[] =
    data.series?.fx ?? [];
  const flex = serie.filter((r) => r.regimen === 'flexible');
  const fijo = serie.filter((r) => r.regimen === 'fijo');
  const sube = (fx.variacion30dPct ?? 0) >= 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-12">
        {/* Cifra grande: es el número que el importador quiere ver primero. */}
        <div className="rounded-[var(--radius-card)] glass p-6 lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
              Bolivianos por dólar
            </span>
            <span className="rounded-full bg-[var(--color-good)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-good)]">
              {fx.regimen}
            </span>
          </div>

          <div className="mt-2 text-[44px] font-semibold leading-none">Bs {fx.tipoCambio}</div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span
              className={`flex items-center gap-1 font-semibold ${sube ? 'text-[var(--color-bad)]' : 'text-[var(--color-good)]'}`}
            >
              {/* Que suba es malo para el importador: por eso sube = rojo. */}
              <Icon name={sube ? 'up' : 'down'} size={14} />
              {Math.abs(fx.variacion30dPct ?? 0)}% en 30 días
            </span>
            {fx.variacionDesdeUnificacionPct != null && (
              <span className="text-[var(--color-muted)]">
                {fx.variacionDesdeUnificacionPct > 0 ? '+' : ''}
                {fx.variacionDesdeUnificacionPct}% desde la unificación
              </span>
            )}
          </div>

          <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-xs leading-relaxed text-[var(--color-muted)]">
            {fx.nota}
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-faint)]">
            Fuente: {fx.fuente} · {fx.fecha}
          </p>
        </div>

        {serie.length > 1 && (
          <div className="rounded-[var(--radius-card)] glass p-5 lg:col-span-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Cómo se movió</h3>
              <span className="text-[11px] text-[var(--color-muted)]">
                {fijo.length > 0 && `${fijo.length} días de régimen fijo · `}
                {flex.length} de flexible
              </span>
            </div>
            <div className="mt-4">
              <LineChart
                labels={serie.map((r) => shortDate(r.fecha))}
                format={(v) => `Bs ${v.toFixed(2)}`}
                height={190}
                area
                series={[
                  {
                    id: 'tc',
                    label: 'Bs por USD',
                    color: NARANJA,
                    values: serie.map((r) => r.tipoCambio),
                  },
                ]}
              />
            </div>
            {fijo.length > 0 && flex.length > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-faint)]">
                El tramo inicial corresponde al régimen anterior. Las variaciones se calculan sólo
                dentro del régimen flexible: comparar entre regímenes mostraría una “subida” que en
                realidad fue un cambio de reglas.
              </p>
            )}
          </div>
        )}
      </div>

      <Simulator currentRate={fx.tipoCambio} onAsk={onAsk} />

      {serie.length > 0 && (
        <div className="rounded-[var(--radius-card)] glass p-5">
          <h3 className="text-sm font-semibold">Últimos valores</h3>
          <div className="scroll-slim mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 text-right font-medium">Bs por USD</th>
                  <th className="pb-2 text-right font-medium">Variación</th>
                  <th className="pb-2 text-right font-medium">Régimen</th>
                </tr>
              </thead>
              <tbody>
                {[...serie]
                  .reverse()
                  .slice(0, 10)
                  .map((r, i, arr) => {
                    const prev = arr[i + 1];
                    const delta =
                      prev && prev.tipoCambio > 0
                        ? ((r.tipoCambio - prev.tipoCambio) / prev.tipoCambio) * 100
                        : null;
                    return (
                      <tr key={r.fecha} className="border-t border-[var(--color-line)]">
                        <td className="py-2.5">{shortDate(r.fecha)}</td>
                        <td className="py-2.5 text-right font-semibold">Bs {r.tipoCambio}</td>
                        <td
                          className={`py-2.5 ${
                            delta == null
                              ? 'text-[var(--color-faint)]'
                              : delta > 0
                                ? 'text-[var(--color-bad)]'
                                : delta < 0
                                  ? 'text-[var(--color-good)]'
                                  : 'text-[var(--color-faint)]'
                          }`}
                        >
                          <span className="flex items-center justify-end gap-1">
                            {delta == null ? (
                              '—'
                            ) : (
                              <>
                                {delta !== 0 && <Icon name={delta > 0 ? 'up' : 'down'} size={12} />}
                                {Math.abs(delta).toFixed(2)}%
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-[var(--color-muted)]">{r.regimen}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
