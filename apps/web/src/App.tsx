import { useEffect, useState } from 'react';
import Chat from './components/Chat';
import Dashboard from './components/Dashboard';
import { fetchAgents, fetchDashboard, type Agent } from './lib/api';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [active, setActive] = useState<Agent | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSlowBoot, setIsSlowBoot] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlowBoot(true), 2500);

    (async () => {
      try {
        const [list, data] = await Promise.all([fetchAgents(), fetchDashboard()]);
        setAgents(list);
        setActive(list[0] ?? null);
        setDashboard(data);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : 'Error al iniciar');
      } finally {
        clearTimeout(timer);
        setIsSlowBoot(false);
        setLoading(false);
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  const handleAskAgent = (prompt: string, agentId?: string) => {
    if (agentId) {
      const targetAgent = agents.find((a) => a.id === agentId || a.id.includes(agentId));
      if (targetAgent) {
        setActive(targetAgent);
      }
    }
    setPendingPrompt(prompt);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-4 p-4 lg:h-screen lg:flex-row">
      <main className="flex-1 space-y-4 overflow-y-auto">
        <header>
          <h1 className="text-xl font-bold">
            PyME <span className="text-[var(--color-accent)]">AI</span>
          </h1>
          <p className="text-sm text-slate-400">
            Tus agentes ya revisaron el negocio. Esto es lo que encontraron.
          </p>
        </header>

        {loading && isSlowBoot && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200 animate-pulse">
            <span className="text-base">⚡</span>
            <div>
              <div className="font-semibold">Despertando el servidor backend en Render…</div>
              <div className="text-[11px] text-yellow-300/80">
                El arranque en frío del servidor gratuito puede tardar hasta 30 segundos. Por favor aguarde un instante.
              </div>
            </div>
          </div>
        )}

        {bootError && (
          <div className="rounded-lg border border-[var(--color-bad)] p-3 text-sm text-[var(--color-bad)]">
            {bootError}
          </div>
        )}

        <Dashboard data={dashboard} loading={loading} onAskAgent={handleAskAgent} />

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Agentes</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setActive(agent)}
                className={`rounded-xl border p-3 text-left transition ${
                  active?.id === agent.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-slate-500'
                }`}
              >
                <div className="text-lg">{agent.icon}</div>
                <div className="mt-1 text-sm font-semibold">{agent.name}</div>
                <div className="mt-0.5 text-xs text-slate-400">{agent.tagline}</div>
              </button>
            ))}
          </div>
        </section>
      </main>

      <aside className="flex h-[70vh] w-full flex-col rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] lg:h-auto lg:w-[420px]">
        {active ? (
          <Chat
            agent={active}
            initialPrompt={pendingPrompt}
            onClearInitialPrompt={() => setPendingPrompt(null)}
          />
        ) : (
          <div className="p-4 text-sm text-slate-400">Cargando agentes…</div>
        )}
      </aside>
    </div>
  );
}

