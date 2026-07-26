import { bob, type Insight, type InsightsResponse, type Severity } from '../lib/api';

interface Props {
  data: InsightsResponse | null;
  loading: boolean;
  /** Manda la pregunta del hallazgo al agente que corresponde. */
  onAsk: (agentId: string, question: string) => void;
}

/** Jerarquía visual: nunca sólo color, cada nivel conserva su etiqueta en texto. */
const SEVERITY: Record<
  Severity,
  { label: string; badge: string; bar: string; amount: string }
> = {
  critica: {
    label: 'Crítico',
    badge: 'border border-red-200 bg-red-50 font-bold text-red-700',
    bar: 'w-1.5 bg-red-600',
    amount: 'font-bold text-red-600',
  },
  alta: {
    label: 'Alta',
    badge: 'border border-amber-200 bg-amber-50 font-bold text-amber-800',
    bar: 'w-1.5 bg-amber-500',
    amount: 'font-bold text-amber-700',
  },
  media: {
    label: 'Media',
    badge: 'border border-slate-200 bg-slate-100 font-semibold text-slate-700',
    bar: 'w-1 bg-slate-400',
    amount: 'font-bold text-slate-800',
  },
  baja: {
    label: 'Baja',
    badge: 'border border-slate-200 bg-slate-50 font-medium text-slate-600',
    bar: 'w-1 bg-slate-300',
    amount: 'font-semibold text-slate-600',
  },
};

function Row({ insight, onAsk }: { insight: Insight; onAsk: Props['onAsk'] }) {
  const s = SEVERITY[insight.severidad];
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] glass p-5 pl-6 transition-shadow duration-200 hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 ${s.bar}`} aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${s.badge}`}
          >
            {s.label}
          </span>
          <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">
            {insight.titulo}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-xl ${s.amount}`}>
            {bob(insight.impactoBob)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            en juego
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{insight.detalle}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onAsk(insight.agenteId, insight.pregunta)}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-strong)] hover:shadow"
        >
          {insight.pregunta}
        </button>
        <span className="text-[11px] font-medium text-slate-500">{insight.impactoNota}</span>
      </div>
    </article>
  );
}

export default function Insights({ data, loading, onAsk }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[148px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05]"
          />
        ))}
      </div>
    );
  }
  if (!data) return null;

  if (data.insights.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-good)]">
        Sin hallazgos urgentes. Márgenes, stock, cobros y clientes están dentro de lo esperado.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {/* El título lo pone el apartado que envuelve a este bloque. */}
      <p className="text-xs text-[var(--color-muted)]">
        {data.insights.length} hallazgos · {bob(data.totalImpactoBob)} en juego
      </p>

      {data.insights.map((insight) => (
        <Row key={insight.id} insight={insight} onAsk={onAsk} />
      ))}
    </section>
  );
}
