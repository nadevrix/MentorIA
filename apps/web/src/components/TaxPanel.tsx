import { useEffect, useMemo, useState } from 'react';
import {
  bob,
  fetchFormularios,
  fetchTaxes,
  type CatalogoSin,
  type Obligacion,
  type TaxSummary,
} from '../lib/api';
import Icon from './Icon';

/**
 * Apartado de impuestos.
 *
 * Sirve para dos cosas y para ninguna más: que el dueño no se pierda un
 * vencimiento, y que sepa cuánta plata reservar. No es una declaración.
 *
 * Por eso la advertencia va arriba y visible, no al pie en letra chica: acá se
 * muestran montos que alguien podría pagar, y equivocarse tiene consecuencias
 * reales. Cada obligación muestra además su fórmula y el supuesto que usó, para
 * que el contador pueda auditar de dónde salió el número.
 */

const ESTADO: Record<
  Obligacion['estado'],
  { label: string; texto: string; fondo: string; barra: string }
> = {
  vencida: {
    label: 'Vencida',
    texto: 'text-[var(--color-bad)]',
    fondo: 'bg-[var(--color-bad)]/12',
    barra: 'bg-[var(--color-bad)]',
  },
  proxima: {
    label: 'Vence pronto',
    texto: 'text-[var(--color-gold)]',
    fondo: 'bg-[var(--color-gold)]/12',
    barra: 'bg-[var(--color-gold)]',
  },
  programada: {
    label: 'Programada',
    texto: 'text-[var(--color-muted)]',
    fondo: 'bg-black/[0.06]',
    barra: 'bg-[var(--color-line)]',
  },
};

function plazo(o: Obligacion): string {
  const d = o.diasParaVencer;
  if (d < 0) return `venció hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`;
  if (d === 0) return 'vence hoy';
  return `vence en ${d} ${d === 1 ? 'día' : 'días'}`;
}

function Fila({ o }: { o: Obligacion }) {
  const e = ESTADO[o.estado];
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] glass p-5 pl-6">
      <span className={`absolute inset-y-0 left-0 w-1 ${e.barra}`} aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${e.fondo} ${e.texto}`}
          >
            {e.label}
          </span>
          <h3 className="mt-2 text-[15px] font-semibold">{o.nombre}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Periodo {o.periodo} · {plazo(o)} · {o.vencimiento}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold">{bob(o.montoBob)}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-faint)]">
            estimado
          </div>
        </div>
      </div>

      <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-muted)]">
        {o.formula}
      </p>
      {o.supuesto && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-faint)]">
          {/* El supuesto siempre visible: es donde la estimación se puede romper. */}
          {o.supuesto}
        </p>
      )}
    </article>
  );
}

/**
 * Catálogo de formularios del SIN.
 *
 * Los tres que le tocan al comercio (200, 400, 500) se marcan, para que no
 * tenga que leer 57 formularios buscando los suyos.
 */
function Catalogo({ propios }: { propios: Set<string> }) {
  const [cat, setCat] = useState<CatalogoSin | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetchFormularios()
      .then(setCat)
      .catch(() => setCat(null));
  }, []);

  const filtrado = useMemo(() => {
    if (!cat) return [];
    const t = q.trim().toLowerCase();
    if (!t) return cat.impuestos;
    return cat.impuestos
      .map((i) => ({
        ...i,
        formularios: i.formularios.filter(
          (f) =>
            f.numero.includes(t) ||
            f.nombre.toLowerCase().includes(t) ||
            i.impuesto.toLowerCase().includes(t),
        ),
      }))
      .filter((i) => i.formularios.length > 0);
  }, [cat, q]);

  if (!cat || cat.impuestos.length === 0) return null;

  const total = cat.impuestos.reduce((n, i) => n + i.formularios.length, 0);

  return (
    <section className="rounded-[var(--radius-card)] glass p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold">Formularios del SIN</h3>
        <span className="text-xs text-[var(--color-muted)]">
          {total} formularios · {cat.impuestos.length} impuestos
        </span>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por número, nombre o impuesto…"
        className="mt-3 w-full rounded-full glass-soft px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      <div className="mt-4 space-y-5">
        {filtrado.map((i) => (
          <div key={i.impuesto}>
            <div className="flex items-baseline gap-2">
              <h4 className="text-sm font-semibold">{i.impuesto}</h4>
              {i.grava && (
                <span className="min-w-0 truncate text-[11px] text-[var(--color-muted)]">
                  {i.grava}
                </span>
              )}
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {i.formularios.map((f, idx) => {
                const mio = propios.has(f.numero);
                return (
                  <li key={`${f.numero}-${idx}`}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-baseline justify-between gap-2 rounded-xl px-3 py-2 text-xs transition ${
                        mio
                          ? 'bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/30'
                          : 'glass-soft'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">{f.numero}</span>
                        {f.version && (
                          <span className="ml-1 text-[var(--color-faint)]">{f.version}</span>
                        )}
                        {mio && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase text-[var(--color-accent)]">
                            te toca
                          </span>
                        )}
                        <span className="ml-1.5 text-[var(--color-muted)]">{f.nombre}</span>
                      </span>
                      {f.periodicidad && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-faint)]">
                          {f.periodicidad}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-[11px] leading-relaxed text-[var(--color-faint)]">
        {cat.nota} Fuente:{' '}
        <a href={cat.fuente} target="_blank" rel="noopener noreferrer" className="underline">
          impuestos.gob.bo
        </a>
        {cat.obtenidoEn && ` · actualizado ${cat.obtenidoEn.slice(0, 10)}`}
      </p>
    </section>
  );
}

export default function TaxPanel({ onAsk }: { onAsk: (a: string, q: string) => void }) {
  const [digito, setDigito] = useState(0);
  const [regimen, setRegimen] = useState<'general' | 'simplificado'>('general');
  const [data, setData] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchTaxes(digito, regimen)
      .then((d) => vivo && setData(d))
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : 'Error al calcular'));
    return () => {
      vivo = false;
    };
  }, [digito, regimen]);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] glass p-5">
        <div className="flex items-start gap-2.5">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-[var(--color-gold)]" />
          <div>
            <h2 className="text-[15px] font-semibold">Impuestos — estimación</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              {data?.advertencia ??
                'Estimación para no perder vencimientos y saber cuánto reservar. No es una declaración ni reemplaza a tu contador.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-[var(--color-line)] pt-4">
          <label className="text-xs">
            <span className="block text-[var(--color-muted)]">Último dígito de tu NIT</span>
            <select
              value={digito}
              onChange={(e) => setDigito(Number(e.target.value))}
              className="mt-1.5 rounded-full glass-soft px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="block text-[var(--color-muted)]">Régimen</span>
            <select
              value={regimen}
              onChange={(e) => setRegimen(e.target.value as 'general' | 'simplificado')}
              className="mt-1.5 rounded-full glass-soft px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="general">General</option>
              <option value="simplificado">Simplificado</option>
            </select>
          </label>

          <p className="max-w-sm text-[11px] leading-relaxed text-[var(--color-faint)]">
            El día de vencimiento mensual depende del último dígito del NIT. No guardamos tu NIT:
            sólo usamos ese dígito para calcular las fechas.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-bad)]">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-[var(--radius-card)] glass p-5">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Conviene tener reservado
              </div>
              <div className="mt-2 text-[28px] font-semibold leading-none">
                {bob(data.totalPorPagarBob)}
              </div>
              <div className="mt-1.5 text-xs text-[var(--color-muted)]">
                Vencido y por vencer en los próximos 10 días
              </div>
            </div>

            <div className="rounded-[var(--radius-card)] glass p-5">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Ya vencido
              </div>
              <div
                className={`mt-2 text-[28px] font-semibold leading-none ${
                  data.vencidasBob > 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-good)]'
                }`}
              >
                {bob(data.vencidasBob)}
              </div>
              <div className="mt-1.5 text-xs text-[var(--color-muted)]">
                {data.vencidasBob > 0 ? 'Suma multas e intereses cada día' : 'Nada vencido'}
              </div>
            </div>

            <div className="rounded-[var(--radius-card)] glass p-5">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Base del cálculo
              </div>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--color-muted)]">Ventas del periodo</dt>
                  <dd className="font-semibold">{bob(data.base.ventasMesBob)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--color-muted)]">Compras con factura</dt>
                  <dd className="font-semibold">{bob(data.base.comprasConFacturaMesBob)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--color-muted)]">Utilidad del año</dt>
                  <dd className="font-semibold">{bob(data.base.utilidadAnioBob)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-[15px] font-semibold">Obligaciones</h3>
            {data.obligaciones.length === 0 ? (
              <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-muted)]">
                En Régimen Simplificado no se declaran IVA, IT ni IUE de esta forma: se paga una
                cuota bimestral fija por categoría. Confirmá tu categoría con tu contador.
              </div>
            ) : (
              data.obligaciones.map((o) => <Fila key={`${o.tipo}-${o.periodo}`} o={o} />)
            )}
          </section>

          <button
            onClick={() =>
              onAsk('finanzas', '¿Me alcanza la caja para pagar los impuestos que vencen?')
            }
            className="rounded-full bg-[var(--color-accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            ¿Me alcanza la caja para pagarlos?
          </button>

          {/* Marca los formularios que corresponden a las obligaciones calculadas. */}
          <Catalogo propios={new Set(data.obligaciones.map((o) => o.nombre.match(/\d{3,4}/)?.[0] ?? ''))} />
        </>
      )}
    </div>
  );
}
