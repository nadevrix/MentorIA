import { useState } from 'react';
import { dispatchZavuAlert, type ZavuAlertResult } from '../lib/api';

const CHANNEL_LABEL = {
  telegram: 'Telegram',
  email: 'Email',
} as const;

/**
 * Demostración del flujo sponsor: el backend elige el hallazgo más urgente y
 * Zavu lo entrega a todos los destinos configurados. No se aceptan receptores
 * desde el navegador, así la ruta no puede convertirse en un relay abierto.
 */
export default function SponsorAlerts() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ZavuAlertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      setResult(await dispatchZavuAlert());
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la alerta.');
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="rounded-[var(--radius-card)] border border-violet-200 bg-violet-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              Zavu
            </span>
            <h3 className="text-sm font-semibold text-slate-900">Alerta multicanal automática</h3>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600">
            A las 08:00 detecta el hallazgo más urgente y lo envía por los canales configurados.
            Este botón permite demostrar el mismo flujo ahora.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Enviar alerta con Zavu'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-[var(--color-bad)]">{error}</p>}

      {result && (
        <div className="mt-3 border-t border-violet-200 pt-3">
          <p
            className={`text-xs font-semibold ${
              result.ok ? 'text-[var(--color-good)]' : 'text-[var(--color-gold)]'
            }`}
          >
            {result.message}
          </p>
          {result.insight && (
            <p className="mt-1 text-xs text-slate-600">
              Hallazgo enviado: <strong>{result.insight.titulo}</strong>
            </p>
          )}
          {result.deliveries.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {result.deliveries.map((delivery) => (
                <li
                  key={`${delivery.channel}:${delivery.recipient}`}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    delivery.ok
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                  title={delivery.error}
                >
                  {CHANNEL_LABEL[delivery.channel]} · {delivery.recipient} ·{' '}
                  {delivery.ok ? delivery.status ?? 'en cola' : delivery.error ?? 'falló'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
