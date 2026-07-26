import { useEffect, useState } from 'react';
import {
  bob,
  fetchMarketing,
  type MarketingCandidate,
  type MarketingResponse,
} from '../lib/api';
import Icon from './Icon';
import TallerImagen from './TallerImagen';

/**
 * Apartado de marketing.
 *
 * Dos mitades que se complementan:
 *  - Qué promocionar, calculado sin modelo. Un producto sin margen no aparece:
 *    venderlo más rápido sólo acelera la pérdida.
 *  - El taller de imagen: el agente escribe el prompt, y acá se convierte en
 *    imagen si hay proveedor. Si no lo hay, el prompt se copia y listo — ya es
 *    la mitad del valor.
 */

const RAZON: Record<
  MarketingCandidate['razon'],
  { label: string; texto: string; fondo: string; angulo: string }
> = {
  liquidar: {
    label: 'Liquidar',
    texto: 'text-[var(--color-bad)]',
    fondo: 'bg-[var(--color-bad)]/12',
    angulo: 'Capital dormido: urgencia y descuento acotado',
  },
  empujar: {
    label: 'Empujar',
    texto: 'text-[var(--color-gold)]',
    fondo: 'bg-[var(--color-gold)]/12',
    angulo: 'Buen margen y hay stock: mostrar el beneficio',
  },
  estrella: {
    label: 'Estrella',
    texto: 'text-[var(--color-good)]',
    fondo: 'bg-[var(--color-good)]/12',
    angulo: 'Ya se vende: prueba social y volumen',
  },
};

interface Props {
  onAsk: (agentId: string, question: string) => void;
}

function Candidate({ c, onAsk }: { c: MarketingCandidate; onAsk: Props['onAsk'] }) {
  const r = RAZON[c.razon];
  return (
    <article className="rounded-[var(--radius-card)] glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${r.fondo} ${r.texto}`}
          >
            {r.label}
          </span>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">{c.nombre}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{r.angulo}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold">{bob(c.precioBob)}</div>
          <div className="text-[11px] text-[var(--color-faint)]">margen {c.margenRealPct}%</div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--color-line)] pt-3 text-xs">
        <div>
          <dt className="text-[var(--color-faint)]">Stock</dt>
          <dd className="font-semibold">{c.stock}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-faint)]">Vendidas 30d</dt>
          <dd className="font-semibold">{c.unidades30d}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-faint)]">Descuento máximo</dt>
          {/* El techo antes de vender bajo costo de reposición. */}
          <dd className="font-semibold">{c.descuentoMaximoPct}%</dd>
        </div>
      </dl>

      {c.capitalInmovilizadoBob > 0 && (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          {bob(c.capitalInmovilizadoBob)} inmovilizados
          {c.diasSinVender != null && ` · ${c.diasSinVender} días sin vender`}
        </p>
      )}

      <button
        onClick={() =>
          onAsk(
            'clientes',
            `Armame un post con imagen para promocionar ${c.nombre}. El descuento no puede pasar del ${c.descuentoMaximoPct}%.`,
          )
        }
        className="mt-4 rounded-full bg-[var(--color-accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
      >
        Generar contenido para este producto
      </button>
    </article>
  );
}


export default function MarketingPanel({ onAsk }: Props) {
  const [data, setData] = useState<MarketingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketing()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, []);

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Qué promocionar</h2>
          {data && (
            <span className="text-xs text-[var(--color-muted)]">
              {data.candidatos.length} de {data.promocionables} promocionables ·{' '}
              {data.descartados} descartados por margen
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-bad)]">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[220px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05]"
              />
            ))}
          </div>
        )}

        {data && data.candidatos.length === 0 && (
          <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-muted)]">
            Ningún producto tiene margen suficiente para promocionar hoy. Primero hay que ajustar
            precios: promocionar algo que pierde plata sólo acelera la pérdida.
          </div>
        )}

        {data && data.candidatos.length > 0 && (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.candidatos.map((c) => (
                <Candidate key={c.id} c={c} onAsk={onAsk} />
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-faint)]">{data.notaDescartados}</p>
          </>
        )}
      </section>

      <TallerImagen />
    </div>
  );
}
