interface Row {
  label: string;
  value: number;
}

interface Props {
  rows: readonly Row[];
  format: (n: number) => string;
  color?: string;
  max?: number;
}

/**
 * Barras horizontales para comparar magnitudes entre categorías.
 *
 * Preferidas sobre una dona: comparar longitudes es mucho más preciso que
 * comparar ángulos, y las etiquetas caben sin líneas guía.
 * Una sola serie ⇒ un solo hue y sin leyenda; el título nombra la medida.
 */
export default function BarList({ rows, format, color = '#3987e5', max }: Props) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-[var(--color-muted)]">{row.label}</span>
            <span className="shrink-0 font-semibold text-white">{format(row.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.value / top) * 100)}%`,
                background: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
