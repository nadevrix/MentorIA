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
import Landing from './components/Landing';
import Login, { type ModoAcceso } from './components/Login';
import MarketingPanel from './components/MarketingPanel';
import Shell, { type Tab, type TopNav } from './components/Shell';
import SponsorAlerts from './components/SponsorAlerts';
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
import { useSesion } from './lib/sesion';

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

/**
 * Identidad y salida, arriba a la derecha.
 *
 * La inicial en vez de un avatar: no tenemos foto de nadie, y una silueta
 * genérica ocupa el mismo espacio sin decir nada.
 */
function BotonSalir({ onSalir }: { onSalir: () => void }) {
  const { sesion } = useSesion();
  if (!sesion) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        title={sesion.usuario}
        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-accent)]/15 text-xs font-bold uppercase text-[var(--color-accent)]"
      >
        {sesion.usuario.trim().charAt(0)}
      </span>
      <button
        type="button"
        onClick={onSalir}
        className="rounded-full glass-soft px-3.5 py-2 text-xs font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
      >
        Salir
      </button>
    </div>
  );
}

/** Pregunta enviada desde un hallazgo o el simulador hacia el chat. */
interface Ask {
  agentId: string;
  question: string;
  /** Cambia en cada clic para forzar el remontaje del chat. */
  nonce: number;
}

/**
 * Raíz de la aplicación.
 *
 * Tres pantallas antes del panel: portada → acceso → panel. La sesión decide
 * cuál se muestra; no es autenticación (ver lib/sesion.ts), es la puerta de la
 * demo. Quien ya entró una vez cae directo en el panel al recargar.
 */
export default function App() {
  const { sesion, salir } = useSesion();
  // null = portada. Si no, en cuál de los dos modos está el formulario.
  const [acceso, setAcceso] = useState<ModoAcceso | null>(null);

  if (!sesion) {
    return acceso ? (
      <Login modo={acceso} onModo={setAcceso} onVolver={() => setAcceso(null)} />
    ) : (
      <Landing onEntrar={setAcceso} />
    );
  }

  // El panel se monta recién con sesión: así sus efectos no piden datos a la
  // API mientras alguien está mirando la portada.
  return <Panel onSalir={salir} />;
}

function Panel({ onSalir }: { onSalir: () => void }) {
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
  const hallazgosCount = insights?.insights?.length ?? 0;

  // El contador de trámites va en la pestaña principal.
  const tabs: readonly Tab[] = [
    { id: 'resumen', label: 'Resumen' },
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
        // Las pestañas se ven también desde Ajustes/Ayuda: clicar una vuelve al inicio.
        setTopNav('inicio');
        setTab(id);
      }}
      topNav={topNav}
      onTopNav={setTopNav}
      urgenciasBadge={hallazgosCount > 0 ? { count: hallazgosCount } : null}
      onUrgenciasClick={() => {
        setTopNav('inicio');
        setTab('urgencias');
      }}
      title={
        topNav === 'ajustes'
          ? 'Ajustes del Negocio'
          : topNav === 'ayuda'
            ? 'Centro de Ayuda'
            : tab === 'urgencias'
              ? 'Qué resolver hoy'
              : 'Panel principal'
      }
      subtitle={
        topNav === 'ajustes'
          ? 'Configura la identidad de tu PyME, fuentes de dólar y notificaciones.'
          : topNav === 'ayuda'
            ? 'Guía de uso rápido, preguntas frecuentes y explicación de los 5 agentes.'
            : tab === 'urgencias'
              ? `${hallazgosCount} hallazgos ordenados por urgencia e impacto en bolivianos.`
              : 'Tus agentes ya revisaron el negocio. Esto es lo que encontraron.'
      }
      rate={fx ? { valor: fx.tipoCambio, variacionPct: fx.variacion30dPct } : null}
      headerRight={<BotonSalir onSalir={onSalir} />}
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
                        ? 'glass-soft border border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)] shadow-[0_0_15px_rgba(37,99,235,0.25)]'
                        : 'glass-soft text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-slate-300'
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
                {!loading && <SponsorAlerts />}
                <Insights data={insights} loading={loading} onAsk={handleAsk} />
              </Section>
            </div>
          )}

          {/* El simulador vive en Dólar, no acá: es una herramienta de ese tema. */}
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
