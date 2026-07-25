import { bob, type Insight, type InsightsResponse, type Severity } from '../lib/api';

interface Props {
  data: InsightsResponse | null;
  loading: boolean;
  /** Manda la pregunta del hallazgo al agente que corresponde. */
  onAsk: (agentId: string, question: string) => void;
}

/**
 * Rojo para lo crítico, ámbar para lo que se está deteriorando, gris para el
 * resto. Nunca sólo color: cada nivel lleva también su etiqueta en texto.
 */
const SEVERITY: Record<Severity, { label: string; text: string; bg: string; bar: string }> = {
  critica: {
    label: 'Crítico',
    text: 'text-[var(--color-bad)]',
    bg: 'bg-[var(--color-bad)]/15',
    bar: 'bg-[var(--color-bad)]',
  },
  alta: {
    label: 'Alta',
    text: 'text-[var(--color-gold)]',
    bg: 'bg-[var(--color-gold)]/15',
    bar: 'bg-[var(--color-gold)]',
  },
  media: {
    label: 'Media',
    text: 'text-[var(--color-muted)]',
    bg: 'bg-white/5',
    bar: 'bg-[var(--color-faint)]',
  },
  baja: {
    label: 'Baja',
    text: 'text-[var(--color-faint)]',
    bg: 'bg-white/5',
    bar: 'bg-[var(--color-line)]',
  },
};

function Row({ insight, onAsk }: { insight: Insight; onAsk: Props['onAsk'] }) {
  const s = SEVERITY[insight.severidad];
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5 pl-6">
      <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.bg} ${s.text}`}
          >
            {s.label}
          </span>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">{insight.titulo}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold text-[var(--color-gold)]">
            {bob(insight.impactoBob)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-faint)]">
            en juego
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-muted)]">{insight.detalle}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onAsk(insight.agenteId, insight.pregunta)}
          className="rounded-full bg-[var(--color-accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
        >
          {insight.pregunta}
        </button>
        <span className="text-[11px] text-[var(--color-faint)]">{insight.impactoNota}</span>
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
            className="h-[148px] animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
    );
  }
  if (!data) return null;

  if (data.insights.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-good)]">
        Sin hallazgos urgentes. Márgenes, stock, cobros y clientes están dentro de lo esperado.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Qué resolver hoy</h2>
        <p className="text-xs text-[var(--color-muted)]">
          {data.insights.length} hallazgos · {bob(data.totalImpactoBob)} en juego · por urgencia e
          impacto
        </p>
      </div>

      {data.insights.map((insight) => (
        <Row key={insight.id} insight={insight} onAsk={onAsk} />
      ))}
    </section>
  );
}
