import { useEffect, useRef, useState } from 'react';
import { streamBrief } from '../lib/api';

/**
 * Las tres frases con las que abre la app.
 *
 * Si falla — típicamente porque no hay ANTHROPIC_API_KEY — el componente
 * desaparece en silencio: los hallazgos deterministas de abajo ya cuentan la
 * historia completa, y una demo no se cae por no tener llave.
 */
export default function DailyBrief() {
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  // Sin AbortController a propósito: en StrictMode el cleanup del primer montaje
  // abortaría el único pedido en vuelo, y el guard `started` haría que el segundo
  // montaje no lo reintente — el resumen quedaría colgado para siempre. Es un
  // pedido corto y de una sola vez; dejarlo terminar es más simple y más correcto.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      let acc = '';
      try {
        for await (const event of streamBrief()) {
          if (event.type === 'text') {
            acc += event.text;
            setText(acc);
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
        if (acc) setDone(true);
        else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  if (failed) return null;

  return (
    <section className="rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-raised)] to-[var(--color-surface)] p-5 ring-1 ring-[var(--color-accent)]/25">
      <div className="flex items-center gap-2">
        <span className="text-base">🧭</span>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
          Tu día en una frase
        </h2>
      </div>

      <p className="mt-2.5 min-h-[3rem] text-[15px] leading-relaxed text-white">
        {text || <span className="text-slate-500">El Director está revisando el negocio…</span>}
        {text && !done && <span className="ml-0.5 animate-pulse text-[var(--color-accent)]">▌</span>}
      </p>

      {done && (
        <p className="mt-2 text-[11px] text-slate-500">
          Redactado por el Director sobre los hallazgos de abajo. Las cifras vienen del motor
          determinista, no del modelo.
        </p>
      )}
    </section>
  );
}
