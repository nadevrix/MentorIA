import { useEffect, useState } from 'react';
import Chat from './components/Chat';
import DailyBrief from './components/DailyBrief';
import Dashboard from './components/Dashboard';
import Insights from './components/Insights';
import Shell, { type Tab } from './components/Shell';
import Simulator from './components/Simulator';
import Widgets from './components/Widgets';
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

const TABS: readonly Tab[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'dolar', label: 'Dólar', disabled: true },
  { id: 'datos', label: 'Mis datos', disabled: true },
  { id: 'marketing', label: 'Marketing', disabled: true },
];

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [active, setActive] = useState<Agent | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [tab, setTab] = useState('resumen');

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

  const fx = dashboard?.fx;
  const askIsForActive = ask !== null && ask.agentId === active?.id;

  return (
    <Shell
      tabs={TABS}
      activeTab={tab}
      onTab={setTab}
      title="Panel principal"
      subtitle="Tus agentes ya revisaron el negocio. Esto es lo que encontraron."
      rate={fx ? { paralelo: fx.paralelo, oficial: fx.oficial } : null}
      aside={
        <>
          <div className="shrink-0 border-b border-[var(--color-line)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Agentes
            </p>
            <div className="scroll-slim mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {agents.map((agent) => {
                const on = active?.id === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => handlePickAgent(agent)}
                    title={agent.tagline}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs transition ${
                      on
                        ? 'bg-[var(--color-accent-strong)] font-semibold text-white'
                        : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{agent.icon}</span>
                    {agent.name.replace(/^Agente (Cambiario y )?de |^Agente /, '')}
                  </button>
                );
              })}
            </div>
          </div>

          {active ? (
            <Chat
              // Remontar en cada pregunta entrante: estado limpio, sin closures viejos.
              key={askIsForActive ? `${active.id}:${ask.nonce}` : active.id}
              agent={active}
              initialQuestion={askIsForActive ? ask.question : undefined}
            />
          ) : (
            <div className="p-4 text-sm text-[var(--color-muted)]">Cargando agentes…</div>
          )}
        </>
      }
    >
      {bootError && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-bad)] p-4 text-sm text-[var(--color-bad)]">
          {bootError}
        </div>
      )}

      {tab === 'resumen' && (
        <>
          {!loading && <DailyBrief />}
          <Insights data={insights} loading={loading} onAsk={handleAsk} />
          <Dashboard data={dashboard} loading={loading} />
          {dashboard && <Widgets data={dashboard} />}
          {fx?.paralelo !== undefined && <Simulator currentRate={fx.paralelo} onAsk={handleAsk} />}
        </>
      )}
    </Shell>
  );
}
