export interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: readonly Slice[];
  /** Cifra grande en el centro. */
  centerValue: string;
  centerLabel: string;
  size?: number;
}

/**
 * Dona de partes de un todo.
 *
 * Sólo se usa con pocas categorías y con etiquetas directas al costado: comparar
 * ángulos es impreciso, así que el número siempre acompaña al color. Los tres
 * estados de margen son estado, no identidad, así que van con la paleta de
 * estado — y nunca sin etiqueta, porque el color solo no comunica.
 */
export default function Donut({ slices, centerValue, centerLabel, size = 132 }: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {slices.map((s) => {
            const len = (s.value / total) * c;
            // 2px de separación entre segmentos: sin el hueco los tramos se funden.
            const dash = `${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-white text-[20px] font-semibold"
          dominantBaseline="middle"
        >
          {centerValue}
        </text>
        <text
          x="50%"
          y="63%"
          textAnchor="middle"
          className="fill-[var(--color-faint)] text-[9px] uppercase"
          dominantBaseline="middle"
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-[var(--color-muted)]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-white">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
