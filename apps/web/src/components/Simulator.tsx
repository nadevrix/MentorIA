import { useEffect, useState } from 'react';
import { bob, simulate, type ScenarioResult } from '../lib/api';

interface Props {
  /** Tipo de cambio vigente, punto de partida del deslizador. */
  currentRate: number;
  onAsk: (agentId: string, question: string) => void;
}

function Delta({ label, antes, despues, format }: {
  label: string;
  antes: string;
  despues: string;
  format?: 'bad-if-lower';
}) {
  return (
    <div className="rounded-xl bg-[var(--color-raised)] p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-sm text-[var(--color-faint)] line-through">{antes}</span>
        <span
          className={`text-lg font-semibold tabular-nums ${
            format === 'bad-if-lower' ? 'text-[var(--color-bad)]' : 'text-[var(--color-fg)]'
          }`}
        >
          {despues}
        </span>
      </div>
    </div>
  );
}

/** Margen al que el negocio quiere sostener sus precios. */
const MARGENES = [20, 25, 30, 35, 40] as const;

export default function Simulator({ currentRate, onAsk }: Props) {
  const [rate, setRate] = useState(currentRate);
  const [targetMargin, setTargetMargin] = useState(35);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El deslizador se mueve rápido; esperamos a que el usuario se detenga.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      simulate(rate, targetMargin, controller.signal)
        .then((r) => {
          setResult(r);
          setError(null);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setError(e instanceof Error ? e.message : 'No se pudo simular');
        });
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [rate, targetMargin]);

  const max = Math.ceil(currentRate * 2);
  const isScenario = Math.abs(rate - currentRate) > 0.01;

  return (
    <section className="rounded-[var(--radius-card)] glass p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">¿Y si el dólar llega a…?</h2>
        <span className="text-xs text-[var(--color-muted)]">Tipo de cambio hoy: Bs {currentRate}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={currentRate}
          max={max}
          step={0.25}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          aria-label="Tipo de cambio simulado"
          className="h-1 flex-1 cursor-pointer appearance-none rounded bg-[var(--color-line)] accent-[var(--color-accent)]"
        />
        <output className="w-24 shrink-0 text-right text-2xl font-semibold tabular-nums text-[var(--color-accent)]">
          Bs {rate.toFixed(2)}
        </output>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Hoy', value: currentRate },
            { label: '+10%', value: currentRate * 1.1 },
            { label: '+25%', value: currentRate * 1.25 },
            { label: '+50%', value: currentRate * 1.5 },
          ].map((atajo) => {
            // "Hoy" vuelve exactamente al tipo vigente; los demás se redondean al paso del deslizador.
            const value = atajo.label === 'Hoy' ? currentRate : Math.round(atajo.value * 4) / 4;
            const on = Math.abs(rate - value) < 0.01;
            return (
              <button
                key={atajo.label}
                onClick={() => setRate(value)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  on
                    ? 'bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)]'
                    : 'bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {atajo.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          Margen a sostener
          <select
            value={targetMargin}
            onChange={(e) => setTargetMargin(Number(e.target.value))}
            className="rounded-full bg-[var(--color-raised)] px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {MARGENES.map((m) => (
              <option key={m} value={m}>
                {m}%
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-bad)]">{error}</p>}

      {result && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Delta
              label="Productos bajo costo"
              antes={String(result.productosBajoCosto.antes)}
              despues={String(result.productosBajoCosto.despues)}
              format="bad-if-lower"
            />
            <Delta
              label="Margen promedio"
              antes={`${result.margenPromedioPct.antes}%`}
              despues={`${result.margenPromedioPct.despues}%`}
              format="bad-if-lower"
            />
            <Delta
              label="Utilidad mensual"
              antes={bob(result.utilidadMensualBob.antes)}
              despues={bob(result.utilidadMensualBob.despues)}
              format="bad-if-lower"
            />
            <div className="rounded-xl bg-[var(--color-raised)] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Capital extra para reponer
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-bad)]">
                {bob(result.capitalAdicionalBob)}
              </div>
            </div>
          </div>

          {isScenario && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              Con el dólar a Bs {rate.toFixed(2)}, {result.productosBajoCosto.despues} de tus productos
              se venderían por debajo del costo de reposición y perderías{' '}
              <strong className="text-[var(--color-bad)]">
                {bob(Math.abs(result.utilidadMensualBob.delta))}
              </strong>{' '}
              de utilidad al mes. Para sostener el {result.margenObjetivoPct}% de margen necesitás subir
              precios un {result.ajustePromedioNecesarioPct}% en promedio.
            </p>
          )}

          {isScenario && result.productos.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase text-[var(--color-muted)]">
                  <tr>
                    <th className="pb-2">Producto</th>
                    <th className="pb-2 text-right">Precio hoy</th>
                    <th className="pb-2 text-right">Costo en escenario</th>
                    <th className="pb-2 text-right">Margen</th>
                    <th className="pb-2 text-right">Precio sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {result.productos.slice(0, 8).map((p) => (
                    <tr key={p.id} className="border-t border-[var(--color-line)]">
                      <td className="py-2 pr-2">{p.nombre}</td>
                      <td className="py-2 text-right tabular-nums">{bob(p.precioActualBob)}</td>
                      <td className="py-2 text-right tabular-nums">{bob(p.costoEscenarioBob)}</td>
                      <td
                        className={`py-2 text-right font-semibold tabular-nums ${
                          p.bajoCostoEnEscenario ? 'text-[var(--color-bad)]' : 'text-[var(--color-muted)]'
                        }`}
                      >
                        {p.margenEscenarioPct}%
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--color-good)]">
                        {bob(p.precioSugeridoBob)}{' '}
                        <span className="text-xs text-[var(--color-faint)]">
                          (+{p.ajusteNecesarioPct}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() =>
              onAsk(
                'precios',
                `¿Qué hago si el dólar llega a ${rate.toFixed(2)} Bs? Quiero sostener un margen del ${targetMargin}%.`,
              )
            }
            className="mt-4 rounded-full bg-[var(--color-accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            Preguntarle al agente qué hacer con este escenario
          </button>
        </>
      )}
    </section>
  );
}
