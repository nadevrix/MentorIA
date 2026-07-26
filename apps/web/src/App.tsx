import { useEffect, useState } from 'react';
import Ajustes from './components/Ajustes';
import Ayuda from './components/Ayuda';
import Chat from './components/Chat';
import DailyBrief from './components/DailyBrief';
import Dashboard from './components/Dashboard';
import DataPanel from './components/DataPanel';
import FormalizacionPanel from './components/FormalizacionPanel';
import FxPanel from './components/FxPanel';
import Icon from './components/Icon';
import Insights from './components/Insights';
import MarketingPanel from './components/MarketingPanel';
import Shell, { type Tab, type TopNav } from './components/Shell';
import TaxPanel from './components/TaxPanel';
import Widgets from './components/Widgets';
import {
  fetchAgents,
  fetchDashboard,
  fetchInsights,
  fetchPendientesFormalizacion,
  type Agent,
  type InsightsResponse,
} from './lib/api';

/** Apartado del panel: un título que orienta y el bloque de contenido. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint && <span className="text-xs text-[var(--color-muted)]">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

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
  const [tab, setTab] = useState('resumen');
  const [topNav, setTopNav] = useState<TopNav>('inicio');
  const [tramitesPendientes, setTramitesPendientes] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [list, data, found] = await Promise.all([
          fetchAgents(),
          fetchDashboard(),
          fetchInsights(),
          // Falla en silencio: que no haya base para el avance de trámites no
          // puede impedir que arranque el panel.
          fetchPendientesFormalizacion()
            .then(setTramitesPendientes)
            .catch(() => {}),
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
  const hallazgosCount = insights?.insights.length ?? 0;

  // Los pendientes y hallazgos se ven desde la navegación, antes de abrir cada apartado.
  const tabs: readonly Tab[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'urgencias', label: 'Urgencias', badge: hallazgosCount, emphasis: 'danger' },
    { id: 'dolar', label: 'Dólar' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'tramites', label: 'Trámites', badge: tramitesPendientes },
    { id: 'datos', label: 'Mis datos' },
    { id: 'marketing', label: 'Marketing' },
  ];

  return (
    <Shell
      tabs={tabs}
      activeTab={tab}
      onTab={(id) => {
        setTopNav('inicio');
        setTab(id);
      }}
      topNav={topNav}
      onTopNav={setTopNav}
      urgencias={hallazgosCount}
      onUrgencias={() => {
        setTopNav('inicio');
        setTab('urgencias');
      }}
      title={
        topNav === 'ajustes'
          ? 'Ajustes del negocio'
          : topNav === 'ayuda'
            ? 'Centro de ayuda'
            : tab === 'urgencias'
              ? 'Qué resolver hoy'
              : 'Panel principal'
      }
      subtitle={
        topNav === 'ajustes'
          ? 'Configura el perfil de tu PyME y revisa el estado de sus fuentes de datos.'
          : topNav === 'ayuda'
            ? 'Guía rápida de los apartados, agentes y cálculos de Mentor IA.'
            : tab === 'urgencias'
              ? `${hallazgosCount} hallazgo${hallazgosCount === 1 ? '' : 's'} ordenado${hallazgosCount === 1 ? '' : 's'} por urgencia e impacto.`
              : 'El pulso de tu negocio y sus indicadores principales.'
      }
      rate={fx ? { valor: fx.tipoCambio, variacionPct: fx.variacion30dPct } : null}
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
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs transition ${
                      on
                        ? 'glass-soft glass-selected font-semibold'
                        : 'glass-soft text-[var(--color-muted)] hover:border-slate-300 hover:text-[var(--color-fg)]'
                    }`}
                  >
                    <Icon name={agent.icon} size={14} />
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

      {topNav === 'ajustes' && <Ajustes />}

      {topNav === 'ayuda' && (
        <Ayuda
          agents={agents}
          onTab={(id) => {
            setTopNav('inicio');
            setTab(id);
          }}
          onAsk={handleAsk}
        />
      )}

      {topNav === 'inicio' && (
        <>
          {tab === 'resumen' && (
            <div className="space-y-8">
              <Section title="Tablero" hint="Tu negocio de un vistazo">
                {dashboard ? (
                  <Widgets data={dashboard} />
                ) : (
                  // Clases estáticas a propósito: Tailwind no genera `col-span-${n}` dinámico.
                  <div className="grid gap-3 lg:grid-cols-12">
                    <div className="h-[220px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05] lg:col-span-3" />
                    <div className="h-[220px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05] lg:col-span-3" />
                    <div className="h-[220px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05] lg:col-span-6" />
                    <div className="h-[240px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05] lg:col-span-7" />
                    <div className="h-[240px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05] lg:col-span-5" />
                  </div>
                )}
              </Section>

              <Section title="Indicadores" hint="Recalculados al costo de reposición de hoy">
                <Dashboard data={dashboard} loading={loading} />
              </Section>
            </div>
          )}

          {tab === 'urgencias' && (
            <div className="space-y-6">
              <Section title="Qué resolver hoy" hint="Ordenado por urgencia e impacto en bolivianos">
                {!loading && <DailyBrief />}
                <Insights data={insights} loading={loading} onAsk={handleAsk} />
              </Section>
            </div>
          )}

          {/* El simulador vigente vive en Dólar y usa el régimen cambiario unificado. */}
          {tab === 'dolar' && <FxPanel data={dashboard} onAsk={handleAsk} />}

          {tab === 'impuestos' && <TaxPanel onAsk={handleAsk} />}

          {tab === 'tramites' && (
            <FormalizacionPanel onAsk={handleAsk} onPendientes={setTramitesPendientes} />
          )}

          {tab === 'datos' && (
            <DataPanel
              // Importar cambia los números de todo el panel: hay que recalcularlos.
              onChanged={() => {
                void Promise.all([fetchDashboard(), fetchInsights()]).then(([d, i]) => {
                  setDashboard(d);
                  setInsights(i);
                });
              }}
            />
          )}

          {tab === 'marketing' && <MarketingPanel onAsk={handleAsk} />}
        </>
      )}
    </Shell>
  );
}
