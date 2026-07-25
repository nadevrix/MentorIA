import { useEffect, useState } from 'react';
import Chat from './components/Chat';
import DailyBrief from './components/DailyBrief';
import Dashboard from './components/Dashboard';
import Insights from './components/Insights';
import Simulator from './components/Simulator';
import {
  fetchAgents,
  fetchDashboard,
  fetchInsights,
  type Agent,
  type InsightsResponse,
} from './lib/api';

/** Pregunta enviada desde un hallazgo o el simulador hacia el chat. */
interface Ask {
  agentId: string;
  question: string;
  /** Cambia en cada clic para forzar el remontaje del chat. */
  nonce: number;
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [active, setActive] = useState<Agent | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, data, found] = await Promise.all([
          fetchAgents(),
          fetchDashboard(),
          fetchInsights(),
        ]);
        setAgents(list);
        setActive(list[0] ?? null);
        setDashboard(data);
        setInsights(found);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : 'Error al iniciar');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Un hallazgo lleva directo al agente que lo puede resolver, con la pregunta ya hecha. */
  function handleAsk(agentId: string, question: string) {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) setActive(agent);
    setAsk({ agentId, question, nonce: Date.now() });
  }

  function handlePickAgent(agent: Agent) {
    setActive(agent);
    setAsk(null);
  }

  const paralelo: number | undefined = dashboard?.fx?.paralelo;
  const askIsForActive = ask !== null && ask.agentId === active?.id;

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-4 p-4 lg:h-screen lg:flex-row">
      <main className="flex-1 space-y-4 overflow-y-auto">
        <header>
          <h1 className="text-xl font-bold">
            Mentor <span className="text-[var(--color-accent)]">IA</span>
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

        {!loading && <DailyBrief />}

        <Insights data={insights} loading={loading} onAsk={handleAsk} />

        <Dashboard data={dashboard} loading={loading} />

        {paralelo !== undefined && <Simulator currentRate={paralelo} onAsk={handleAsk} />}

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Agentes</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handlePickAgent(agent)}
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
            // Remontar en cada pregunta entrante: estado limpio, sin closures viejos.
            key={askIsForActive ? `${active.id}:${ask.nonce}` : active.id}
            agent={active}
            initialQuestion={askIsForActive ? ask.question : undefined}
          />
        ) : (
          <div className="p-4 text-sm text-slate-400">Cargando agentes…</div>
        )}
      </aside>
    </div>
  );
}
