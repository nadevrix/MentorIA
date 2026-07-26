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
/**
 * Jerarquía visual limpia: rojo para lo crítico, ámbar para lo alto, slate para media y baja.
 * Sin emojis informales, con contraste y tipografía financiera profesional.
 */
const SEVERITY: Record<Severity, { label: string; bg: string; bar: string; amountColor: string }> = {
  critica: {
    label: 'Crítico',
    bg: 'bg-red-50 border border-red-200 text-red-700 font-bold',
    bar: 'bg-red-600 w-1.5',
    amountColor: 'text-red-600 font-bold text-xl',
  },
  alta: {
    label: 'Alta',
    bg: 'bg-amber-50 border border-amber-200 text-amber-800 font-bold',
    bar: 'bg-amber-500 w-1.5',
    amountColor: 'text-amber-700 font-bold text-xl',
  },
  media: {
    label: 'Media',
    bg: 'bg-slate-100 border border-slate-200 text-slate-700 font-semibold',
    bar: 'bg-slate-400 w-1',
    amountColor: 'text-slate-800 font-bold text-xl',
  },
  baja: {
    label: 'Baja',
    bg: 'bg-slate-50 border border-slate-200 text-slate-600 font-medium',
    bar: 'bg-slate-300 w-1',
    amountColor: 'text-slate-600 font-semibold text-xl',
  },
};

function Row({ insight, onAsk }: { insight: Insight; onAsk: Props['onAsk'] }) {
  const s = SEVERITY[insight.severidad];
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] glass p-5 pl-6 transition-all duration-200 hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 ${s.bar}`} aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${s.bg}`}
          >
            {s.label}
          </span>
          <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{insight.titulo}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className={s.amountColor}>
            {bob(insight.impactoBob)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            en juego
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-slate-600 font-normal">{insight.detalle}</p>

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
