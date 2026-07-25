import { useEffect, useRef, useState } from 'react';

/**
 * Gráfico de líneas con capa de hover.
 *
 * Un solo eje siempre: si dos medidas no comparten escala, van en dos gráficos.
 *
 * Colores: no usamos el rojo y el ámbar de la marca para codificar series.
 * Ese par mide ΔE 4,8 en deuteranopia — un daltónico no distingue las líneas.
 * Los hues están validados contra el vidrio compuesto, incluida su zona más
 * clara: por eso el tinte del vidrio tiene un techo de brillo (ver index.css).
 */

export interface Series {
  id: string;
  label: string;
  color: string;
  values: readonly number[];
}

interface Props {
  series: readonly Series[];
  /** Etiquetas del eje x, una por punto. */
  labels: readonly string[];
  height?: number;
  /** Relleno degradado bajo la línea. Sólo tiene sentido con una serie. */
  area?: boolean;
  format: (n: number) => string;
  /** Fuerza el mínimo del eje a cero. Para dinero, sí; para tipo de cambio, no. */
  zeroBased?: boolean;
}

const PAD = { top: 10, right: 8, bottom: 20, left: 8 };

export default function LineChart({
  series,
  labels,
  height = 150,
  area = false,
  format,
  zeroBased = false,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Medimos en píxeles reales para que el grosor de línea no se deforme al escalar.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const all = series.flatMap((s) => [...s.values]);
  const rawMin = all.length ? Math.min(...all) : 0;
  const rawMax = all.length ? Math.max(...all) : 1;
  const min = zeroBased ? 0 : rawMin - (rawMax - rawMin) * 0.15;
  const max = rawMax + (rawMax - rawMin) * 0.15 || 1;

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH;

  const path = (values: readonly number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - PAD.left) / (innerW || 1)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const multi = series.length > 1;

  return (
    <div>
      {multi && (
        <div className="mb-2 flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div
        ref={box}
        className="relative"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(' y ')}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.id} id={`fill-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {/* Grilla recesiva: orienta sin competir con los datos. */}
            {[0, 0.5, 1].map((t) => (
              <line
                key={t}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={PAD.top + innerH * t}
                y2={PAD.top + innerH * t}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            ))}

            {area &&
              series.map((s) => (
                <path
                  key={`a-${s.id}`}
                  d={`${path(s.values)} L${x(n - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`}
                  fill={`url(#fill-${s.id})`}
                />
              ))}

            {series.map((s) => (
              <path
                key={s.id}
                d={path(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {hover !== null && (
              <>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1}
                />
                {series.map((s) => {
                  const v = s.values[hover];
                  if (v === undefined) return null;
                  return (
                    <circle
                      key={`p-${s.id}`}
                      cx={x(hover)}
                      cy={y(v)}
                      r={4.5}
                      fill={s.color}
                      /* Anillo del color de la superficie: separa el punto de la línea. */
                      stroke="rgba(0,0,0,0.45)"
                      strokeWidth={2}
                    />
                  );
                })}
              </>
            )}
          </svg>
        )}

        {hover !== null && labels[hover] && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg glass px-2.5 py-1.5 text-[11px]"
            style={{
              left: Math.min(Math.max(x(hover) - 60, 0), Math.max(0, width - 120)),
              minWidth: 110,
            }}
          >
            <div className="text-[var(--color-faint)]">{labels[hover]}</div>
            {series.map((s) => {
              const v = s.values[hover];
              if (v === undefined) return null;
              return (
                <div key={`t-${s.id}`} className="mt-0.5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  {/* El valor va en tinta de texto, no en el color de la serie. */}
                  <span className="font-semibold text-white">{format(v)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between px-1 text-[10px] text-[var(--color-faint)]">
        <span>{labels[0]}</span>
        <span>{labels[n - 1]}</span>
      </div>
    </div>
  );
}
