import { useEffect, useRef, useState } from 'react';
import { streamChat, type Agent, type ChatMessage } from '../lib/api';
import FormattedMessage from './FormattedMessage';

interface Trace {
  name: string;
  status: 'corriendo' | 'listo' | 'error';
}

interface Props {
  agent: Agent;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

export default function Chat({ agent, initialPrompt, onClearInitialPrompt }: Props) {
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
    if (initialPrompt && !streaming) {
      void send(initialPrompt);
      onClearInitialPrompt?.();
    }
  }, [initialPrompt, agent.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partial, traces]);

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
          <span className="text-xl">{agent.icon}</span>
          <h2 className="font-semibold">{agent.name}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">{agent.tagline}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Probá con una de estas:</p>
            {agent.examples.map((example) => (
              <button
                key={example}
                onClick={() => void send(example)}
                className="block w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm hover:border-[var(--color-accent)]"
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
                ? 'ml-auto max-w-[85%] rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm text-black font-medium'
                : 'max-w-[95%] rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm'
            }
          >
            {m.role === 'user' ? m.content : <FormattedMessage content={m.content} />}
          </div>
        ))}

        {traces.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-xs">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Traza de Ejecución de Herramientas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {traces.map((t, i) => (
                <span
                  key={`${t.name}-${i}`}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] border ${
                    t.status === 'corriendo'
                      ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 animate-pulse'
                      : t.status === 'error'
                        ? 'border-[var(--color-bad)]/40 bg-[var(--color-bad)]/10 text-[var(--color-bad)]'
                        : 'border-[var(--color-good)]/40 bg-[var(--color-good)]/10 text-[var(--color-good)]'
                  }`}
                >
                  <span>
                    {t.status === 'corriendo' ? '⏳' : t.status === 'error' ? '⚠️' : '✓'}
                  </span>
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {partial && (
          <div className="max-w-[95%] rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm">
            <FormattedMessage content={partial} />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[var(--color-bad)] px-3 py-2 text-sm text-[var(--color-bad)]">
            {error}
          </div>
        )}
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
          className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
