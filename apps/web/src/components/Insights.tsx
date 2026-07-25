import { bob, type Insight, type InsightsResponse, type Severity } from '../lib/api';

interface Props {
  data: InsightsResponse | null;
  loading: boolean;
  /** Manda la pregunta del hallazgo al agente que corresponde. */
  onAsk: (agentId: string, question: string) => void;
}

const SEVERITY: Record<Severity, { label: string; dot: string; border: string }> = {
  critica: { label: 'Crítico', dot: 'bg-[var(--color-bad)]', border: 'border-l-[var(--color-bad)]' },
  alta: { label: 'Alta', dot: 'bg-[var(--color-accent)]', border: 'border-l-[var(--color-accent)]' },
  media: { label: 'Media', dot: 'bg-slate-400', border: 'border-l-slate-500' },
  baja: { label: 'Baja', dot: 'bg-slate-600', border: 'border-l-slate-700' },
};

function Row({ insight, onAsk }: { insight: Insight; onAsk: Props['onAsk'] }) {
  const s = SEVERITY[insight.severidad];
  return (
    <article className={`rounded-xl border border-l-4 border-[var(--color-line)] ${s.border} bg-[var(--color-surface)] p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
          <h3 className="text-sm font-semibold">{insight.titulo}</h3>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums text-[var(--color-accent)]">
            {bob(insight.impactoBob)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">en juego</div>
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-300">{insight.detalle}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onAsk(insight.agenteId, insight.pregunta)}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
        >
          {insight.pregunta}
        </button>
        <span className="text-[11px] text-slate-500" title={insight.impactoNota}>
          {insight.impactoNota}
        </span>
      </div>
    </article>
  );
}

export default function Insights({ data, loading, onAsk }: Props) {
  if (loading) {
    return <div className="p-4 text-sm text-slate-400">Revisando el negocio…</div>;
  }
  if (!data) return null;

  if (data.insights.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-good)]">
        Sin hallazgos urgentes. Márgenes, stock, cobros y clientes están dentro de lo esperado.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Qué resolver hoy
        </h2>
        <p className="text-xs text-slate-500">
          {data.insights.length} hallazgos · {bob(data.totalImpactoBob)} en juego · por urgencia e impacto
        </p>
      </div>

      {data.insights.map((insight) => (
        <Row key={insight.id} insight={insight} onAsk={onAsk} />
      ))}
    </section>
  );
}
