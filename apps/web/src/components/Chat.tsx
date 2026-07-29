import { useEffect, useRef, useState } from 'react';
import { streamChat, type Agent, type ChatMessage } from '../lib/api';
import FormattedMessage from './FormattedMessage';
import Icon from './Icon';

interface Trace {
  name: string;
  status: 'corriendo' | 'listo' | 'error';
}

/**
 * Qué está haciendo el agente, en castellano.
 *
 * El nombre técnico de la herramienta no le dice nada al dueño de un comercio:
 * `accounts_payable` es ruido, "Revisando lo que tenés por pagar" es
 * información. La traza cruda sigue existiendo en el stream y en el servidor,
 * que es donde sirve para depurar.
 *
 * Dos formas por herramienta porque se usan en dos lugares distintos: `curso`
 * mientras corre, `dato` en la lista de lo consultado al pie de la respuesta.
 */
const HERRAMIENTA: Record<string, { curso: string; dato: string }> = {
  get_fx_rate: { curso: 'Consultando el tipo de cambio', dato: 'El tipo de cambio del día' },
  analyze_margins: {
    curso: 'Recalculando tus márgenes al dólar de hoy',
    dato: 'Tus márgenes al dólar de hoy',
  },
  suggest_price: { curso: 'Calculando precios recomendados', dato: 'Los precios recomendados' },
  simulate_scenario: { curso: 'Simulando el escenario', dato: 'El escenario simulado' },
  sales_summary: { curso: 'Revisando tus ventas', dato: 'Tus ventas del periodo' },
  top_products: { curso: 'Ordenando tus productos', dato: 'El ranking de tus productos' },
  inventory_alerts: { curso: 'Revisando tu inventario', dato: 'Tu inventario' },
  marketing_candidates: {
    curso: 'Buscando qué conviene promocionar',
    dato: 'Qué conviene promocionar',
  },
  customer_insights: { curso: 'Revisando tus clientes', dato: 'Tus clientes' },
  financial_summary: { curso: 'Armando el estado financiero', dato: 'Tu estado financiero' },
  accounts_payable: { curso: 'Revisando lo que tenés por pagar', dato: 'Lo que tenés por pagar' },
  generate_whatsapp_message: {
    curso: 'Redactando el mensaje',
    dato: 'El mensaje para tu cliente',
  },
};

/** Si aparece una herramienta nueva, se dice algo cierto en vez de su nombre. */
const etiqueta = (name: string) =>
  HERRAMIENTA[name] ?? { curso: 'Consultando tus datos', dato: 'Tus datos del negocio' };

interface Props {
  agent: Agent;
  /**
   * Pregunta que se manda sola al montar. App remonta el componente (via `key`)
   * cada vez que el usuario toca un hallazgo, así que el estado siempre arranca limpio.
   */
  initialQuestion?: string;
}

export default function Chat({ agent, initialQuestion }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * Qué consultó cada respuesta, por índice del mensaje.
   *
   * Va aparte de `messages` porque ese arreglo se manda tal cual al servidor:
   * meterle campos de interfaz lo ensuciaría.
   */
  const [consultado, setConsultado] = useState<Record<number, string[]>>({});
  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Cambiar de agente reinicia la conversación: cada agente tiene su propio contexto.
  useEffect(() => {
    setMessages([]);
    setPartial('');
    setTraces([]);
    setConsultado({});
    setDetalleAbierto(null);
    setError(null);
  }, [agent.id]);

  // Hacer auto-scroll ÚNICAMENTE en el contenedor interno del chat, sin desplazar la página principal.
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, partial, traces]);

  // Se dispara una sola vez por montaje; el guard evita un doble envío en StrictMode.
  const autoSent = useRef(false);
  useEffect(() => {
    if (!initialQuestion || autoSent.current) return;
    autoSent.current = true;
    void send(initialQuestion);

  }, [initialQuestion]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setDraft('');
    setStreaming(true);
    setPartial('');
    setTraces([]);
    setError(null);

    let acc = '';
    // Sólo lo que devolvió dato. Una herramienta que falló no respalda nada, y
    // el pie dice "verificado": tiene que ser cierto.
    const verificado: string[] = [];
    try {
      for await (const event of streamChat(agent.id, next)) {
        switch (event.type) {
          case 'text':
            acc += event.text;
            setPartial(acc);
            break;
          case 'tool_use':
            setTraces((t) => [...t, { name: event.name, status: 'corriendo' }]);
            break;
          case 'tool_result': {
            if (!event.isError) {
              const { dato } = etiqueta(event.name);
              // La misma herramienta puede correr dos veces con argumentos
              // distintos; al lector le alcanza con saber que se consultó.
              if (!verificado.includes(dato)) verificado.push(dato);
            }
            setTraces((t) =>
              t.map((x) =>
                x.name === event.name && x.status === 'corriendo'
                  ? { ...x, status: event.isError ? 'error' : 'listo' }
                  : x,
              ),
            );
            break;
          }
          case 'error':
            setError(event.message);
            break;
        }
      }
      if (acc) {
        setMessages((m) => [...m, { role: 'assistant', content: acc }]);
        // El índice es predecible: `next` ya está en el estado y nada más se
        // agrega mientras dura el stream.
        if (verificado.length > 0) {
          setConsultado((c) => ({ ...c, [next.length]: verificado }));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión con el agente');
    } finally {
      setPartial('');
      setStreaming(false);
      // La traza es un indicador de progreso, no parte de la respuesta: cuando
      // la respuesta llega, deja de tener sentido y se va.
      setTraces([]);
    }
  }

  // Lo último que arrancó y todavía no terminó. Se muestra una sola línea: cinco
  // renglones apilados en una columna angosta parecen un registro de sistema.
  const enCurso = [...traces].reverse().find((t) => t.status === 'corriendo');
  // Mientras ya está redactando, el texto que aparece habla por sí solo.
  const mostrarActividad = streaming && (enCurso != null || !partial);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--color-line)] p-4">
        <div className="flex items-center gap-2">
          <Icon name={agent.icon} size={18} className="text-[var(--color-accent)]" />
          <h2 className="font-semibold">{agent.name}</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{agent.tagline}</p>
      </header>

      <div ref={chatContainerRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-muted)]">Probá con una de estas:</p>
            {agent.examples.map((example) => (
              <button
                key={example}
                onClick={() => void send(example)}
                className="block w-full rounded-xl glass-soft px-3.5 py-2.5 text-left text-sm text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          const fuentes = m.role === 'assistant' ? consultado[i] : undefined;
          const abierto = detalleAbierto === i;
          return (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-accent-strong)] px-3.5 py-2.5 text-sm text-white'
                  : 'max-w-[95%] rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-sm'
              }
            >
              {m.role === 'user' ? m.content : <FormattedMessage content={m.content} />}

              {/*
                El pie de verificación.

                Es la respuesta anticipada a "¿y esto no se lo inventó?": las
                cifras salen de consultas deterministas sobre los datos del
                comercio, no del modelo. Va plegado porque es una garantía, no
                parte de la respuesta: quien confía sigue leyendo, quien duda lo
                abre.
              */}
              {fuentes && fuentes.length > 0 && (
                <div className="mt-2.5 border-t border-[var(--color-line)] pt-2">
                  <button
                    type="button"
                    onClick={() => setDetalleAbierto(abierto ? null : i)}
                    aria-expanded={abierto}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
                  >
                    <Icon name="check" size={12} className="text-[var(--color-good)]" />
                    <span>
                      Verificado con {fuentes.length}{' '}
                      {fuentes.length === 1 ? 'consulta' : 'consultas'} a tus datos
                    </span>
                    <Icon name={abierto ? 'up' : 'down'} size={11} />
                  </button>

                  {abierto && (
                    <ul className="mt-2 space-y-1 text-[11px] text-[var(--color-muted)]">
                      {fuentes.map((fuente) => (
                        <li key={fuente} className="flex items-start gap-1.5">
                          <span aria-hidden className="mt-[3px] text-[var(--color-faint)]">
                            •
                          </span>
                          <span>{fuente}</span>
                        </li>
                      ))}
                      {/* --color-faint da 2,75:1 sobre el vidrio: no alcanza para texto. */}
                      <li className="pt-1 italic">Cada cifra sale de estas consultas, no del modelo.</li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {mostrarActividad && (
          <div
            className="flex items-center gap-2 text-xs text-[var(--color-muted)]"
            role="status"
            aria-live="polite"
          >
            <Icon name="loading" size={13} spin />
            <span>{enCurso ? `${etiqueta(enCurso.name).curso}…` : 'Pensando…'}</span>
          </div>
        )}

        {partial && (
          <div className="max-w-[95%] rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-sm">
            <FormattedMessage content={partial} />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[var(--color-bad)] px-3 py-2 text-sm text-[var(--color-bad)]">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="shrink-0 flex gap-2 border-t border-[var(--color-line)] p-3 bg-white/40 backdrop-blur-md"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={streaming ? 'El agente está trabajando…' : 'Preguntá algo sobre tu negocio'}
          disabled={streaming}
          className="flex-1 rounded-full glass-soft px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="rounded-full bg-[var(--color-accent-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
