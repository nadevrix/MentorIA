import { useEffect, useRef, useState } from 'react';
import { streamChat, type Agent, type ChatMessage } from '../lib/api';
import Icon from './Icon';

interface Trace {
  name: string;
  status: 'corriendo' | 'listo' | 'error';
}

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
  const bottom = useRef<HTMLDivElement>(null);

  // Cambiar de agente reinicia la conversación: cada agente tiene su propio contexto.
  useEffect(() => {
    setMessages([]);
    setPartial('');
    setTraces([]);
    setError(null);
  }, [agent.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
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
          case 'tool_result':
            setTraces((t) =>
              t.map((x) =>
                x.name === event.name && x.status === 'corriendo'
                  ? { ...x, status: event.isError ? 'error' : 'listo' }
                  : x,
              ),
            );
            break;
          case 'error':
            setError(event.message);
            break;
        }
      }
      if (acc) setMessages((m) => [...m, { role: 'assistant', content: acc }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión con el agente');
    } finally {
      setPartial('');
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-line)] p-4">
        <div className="flex items-center gap-2">
          <Icon name={agent.icon} size={18} className="text-[var(--color-accent)]" />
          <h2 className="font-semibold">{agent.name}</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{agent.tagline}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
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

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-accent-strong)] px-3.5 py-2.5 text-sm text-white'
                : 'max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-sm'
            }
          >
            {m.content}
          </div>
        ))}

        {traces.length > 0 && (
          <div className="space-y-1 text-xs text-[var(--color-muted)]">
            {traces.map((t, i) => (
              <div key={`${t.name}-${i}`} className="flex items-center gap-2">
                {t.status === 'corriendo' ? (
                  <Icon name="loading" size={13} spin />
                ) : t.status === 'error' ? (
                  <Icon name="warning" size={13} className="text-[var(--color-bad)]" />
                ) : (
                  <Icon name="check" size={13} className="text-[var(--color-good)]" />
                )}
                <code className="font-mono">{t.name}</code>
              </div>
            ))}
          </div>
        )}

        {partial && (
          <div className="max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-sm">
            {partial}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[var(--color-bad)] px-3 py-2 text-sm text-[var(--color-bad)]">
            {error}
          </div>
        )}

        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex gap-2 border-t border-[var(--color-line)] p-3"
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
