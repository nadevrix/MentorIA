import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../lib/api';

/**
 * Apartado de datos propios.
 *
 * Con Postgres los CSV se guardan en la base. Con seed (solo local) viven en
 * memoria del servidor. Cada fila muestra el origen: propio, vacío o ejemplo.
 */

type Entidad = 'products' | 'sales' | 'customers' | 'expenses';
type Origen = 'propio' | 'ejemplo' | 'vacio';

interface Estado {
  entidad: Entidad;
  origen: Origen;
  filas: number;
  cargadoEn: string | null;
  persistente?: boolean;
}

interface Reporte {
  entidad: Entidad;
  importadas: number;
  leidas: number;
  rechazadas: { fila: number; motivo: string }[];
  columnas: string[];
}

const META: Record<Entidad, { titulo: string; ayuda: string; columnas: string }> = {
  products: {
    titulo: 'Productos',
    ayuda: 'Sin esto, el análisis cambiario no habla de tu negocio. Es el más importante.',
    columnas: 'nombre, precio, costo USD, tipo de cambio de compra, stock, importado',
  },
  sales: {
    titulo: 'Ventas',
    ayuda: 'Habilita tendencias, rotación real y detección de caídas.',
    columnas: 'fecha, producto (SKU), cantidad, total, canal',
  },
  customers: {
    titulo: 'Clientes',
    ayuda: 'Habilita el CRM y las campañas de reactivación.',
    columnas: 'nombre, teléfono, última compra, total gastado, compras',
  },
  expenses: {
    titulo: 'Gastos y cuentas por pagar',
    ayuda: 'Habilita utilidad neta real y alertas de vencimiento.',
    columnas: 'fecha, categoría, monto, vencimiento, pagado',
  },
};

function etiquetaOrigen(origen: Origen): { texto: string; clase: string } {
  if (origen === 'propio') {
    return {
      texto: 'tus datos',
      clase: 'bg-[var(--color-good)]/12 text-[var(--color-good)]',
    };
  }
  if (origen === 'vacio') {
    return {
      texto: 'vacío',
      clase: 'bg-black/[0.06] text-[var(--color-muted)]',
    };
  }
  return {
    texto: 'ejemplo',
    clase: 'bg-[var(--color-gold)]/12 text-[var(--color-gold)]',
  };
}

function Fila({
  estado,
  onImport,
  onReset,
  reporte,
  cargando,
}: {
  estado: Estado;
  onImport: (e: Entidad, file: File) => void;
  onReset: (e: Entidad) => void;
  reporte?: Reporte;
  cargando: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const m = META[estado.entidad];
  const propio = estado.origen === 'propio';
  const badge = etiquetaOrigen(estado.origen);

  return (
    <article className="rounded-[var(--radius-card)] glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">{m.titulo}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.clase}`}
            >
              {badge.texto}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{m.ayuda}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold">{estado.filas}</div>
          <div className="text-[11px] text-[var(--color-faint)]">filas</div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-faint)]">
        Columnas que reconoce: {m.columnas}. Acepta nombres en español con o sin tildes, y
        separadores coma o punto y coma.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(estado.entidad, f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={cargando}
          className="rounded-full bg-[var(--color-accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {cargando ? 'Importando…' : propio ? 'Reemplazar CSV' : 'Subir CSV'}
        </button>
        {propio && (
          <button
            onClick={() => onReset(estado.entidad)}
            className="rounded-full glass-soft px-4 py-2 text-xs font-semibold transition"
          >
            {estado.persistente ? 'Vaciar' : 'Volver al ejemplo'}
          </button>
        )}
      </div>

      {reporte && (
        <div className="mt-4 rounded-xl bg-black/[0.04] p-3 text-xs">
          <p className="font-semibold">
            {reporte.importadas} de {reporte.leidas} filas importadas
          </p>
          {reporte.rechazadas.length > 0 && (
            <>
              <p className="mt-1 text-[var(--color-muted)]">
                Rechazadas ({reporte.rechazadas.length}):
              </p>
              <ul className="mt-1 space-y-0.5 text-[var(--color-muted)]">
                {reporte.rechazadas.slice(0, 5).map((r) => (
                  <li key={r.fila}>
                    fila {r.fila} — {r.motivo}
                  </li>
                ))}
              </ul>
            </>
          )}
          {reporte.importadas === 0 && reporte.columnas.length > 0 && (
            <p className="mt-2 text-[var(--color-muted)]">
              Columnas que vi en tu archivo: {reporte.columnas.join(', ')}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function DataPanel({ onChanged }: { onChanged: () => void }) {
  const [estados, setEstados] = useState<Estado[] | null>(null);
  const [reportes, setReportes] = useState<Partial<Record<Entidad, Reporte>>>({});
  const [cargando, setCargando] = useState<Entidad | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch(`${API_URL}/api/data`);
      if (!res.ok) throw new Error('No se pudo leer el estado de los datos');
      const json = (await res.json()) as { entidades: Estado[] };
      setEstados(json.entidades);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function importar(entidad: Entidad, file: File) {
    setCargando(entidad);
    setError(null);
    try {
      const csv = await file.text();
      const res = await fetch(`${API_URL}/api/data/${entidad}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csv,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al importar');
      setReportes((r) => ({ ...r, [entidad]: json as Reporte }));
      await refresh();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setCargando(null);
    }
  }

  async function resetear(entidad: Entidad) {
    await fetch(`${API_URL}/api/data/${entidad}`, { method: 'DELETE' });
    setReportes((r) => ({ ...r, [entidad]: undefined }));
    await refresh();
    onChanged();
  }

  const propios = estados?.filter((e) => e.origen === 'propio').length ?? 0;
  const persistente = estados?.some((e) => e.persistente) ?? false;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] glass p-5">
        <h2 className="text-[15px] font-semibold">Traé los datos de tu negocio</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
          Subí lo que tengas, entidad por entidad. Lo que no subas queda vacío: el panel arranca
          en cero hasta que cargues tus CSV. Empezá por productos.
        </p>
        {propios > 0 && (
          <p className="mt-3 rounded-xl bg-[var(--color-good)]/10 p-3 text-xs text-[var(--color-muted)]">
            {propios} de 4 entidades usan tus datos. Los cálculos del panel ya los están
            considerando.
          </p>
        )}
        <p className="mt-3 text-[11px] text-[var(--color-faint)]">
          {persistente
            ? 'Los datos se guardan en PostgreSQL: sobreviven reinicios y redespliegues.'
            : 'Modo local con datos de ejemplo: los CSV viven en memoria del servidor y se pierden al reiniciarlo.'}
        </p>
      </section>

      {error && (
        <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-bad)]">
          {error}
        </div>
      )}

      {!estados && !error && (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05]"
            />
          ))}
        </div>
      )}

      {estados && (
        <div className="grid gap-3 lg:grid-cols-2">
          {estados.map((e) => (
            <Fila
              key={e.entidad}
              estado={e}
              reporte={reportes[e.entidad]}
              cargando={cargando === e.entidad}
              onImport={(ent, f) => void importar(ent, f)}
              onReset={(ent) => void resetear(ent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
