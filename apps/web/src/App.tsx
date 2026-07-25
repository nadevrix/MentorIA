import { useEffect, useState } from 'react';
import Chat from './components/Chat';
import Dashboard from './components/Dashboard';
import { fetchAgents, fetchDashboard, type Agent } from './lib/api';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [active, setActive] = useState<Agent | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, data] = await Promise.all([fetchAgents(), fetchDashboard()]);
        setAgents(list);
        setActive(list[0] ?? null);
        setDashboard(data);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : 'Error al iniciar');
      } finally {
        setLoading(false);
      }
    })();
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

