import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../lib/api';
import Icon from './Icon';

/**
 * Apartado de formalización.
 *
 * Lo que una PyME boliviana necesita para operar en regla, y qué le falta.
 * El perfil (tipo de sociedad, si tiene empleados, rubro) filtra lo que no
 * corresponde: pedirle el registro de empleador a alguien que trabaja solo
 * sería ruido, no ayuda.
 *
 * Es una lista para no olvidarse un trámite, no asesoría legal. La advertencia
 * va arriba, igual que en impuestos.
 */

type Estado = 'pendiente' | 'hecho' | 'no_aplica';

interface Item {
  id: string;
  titulo: string;
  entidad: string;
  obligatorio: boolean;
  descripcion: string;
  renovacion?: string;
  fuente: string | null;
  estado: Estado;
}

interface Resumen {
  nota: string;
  persistente: boolean;
  faltantes: { id: string; titulo: string; entidad: string; fase: string }[];
  totalObligatorios: number;
  hechos: number;
  fases: { id: string; nombre: string; descripcion: string; items: Item[] }[];
}

const SIGUIENTE: Record<Estado, Estado> = {
  pendiente: 'hecho',
  hecho: 'no_aplica',
  no_aplica: 'pendiente',
};

const SELLO: Record<Estado, { label: string; texto: string; fondo: string }> = {
  hecho: { label: 'Hecho', texto: 'text-[var(--color-good)]', fondo: 'bg-[var(--color-good)]/12' },
  pendiente: { label: 'Pendiente', texto: 'text-[var(--color-gold)]', fondo: 'bg-[var(--color-gold)]/12' },
  no_aplica: { label: 'No aplica', texto: 'text-[var(--color-faint)]', fondo: 'bg-black/[0.06]' },
};

const TIPOS = [
  { id: 'unipersonal', label: 'Unipersonal' },
  { id: 'srl', label: 'S.R.L.' },
  { id: 'sa', label: 'S.A.' },
];

const RUBROS = [
  { id: 'importador', label: 'Importa' },
  { id: 'alimentos', label: 'Alimentos' },
  { id: 'industria', label: 'Industria' },
];

interface Props {
  onAsk: (agentId: string, question: string) => void;
  /** Sube el conteo al contenedor para que la pestaña muestre el pendiente. */
  onPendientes: (n: number) => void;
}

export default function FormalizacionPanel({ onAsk, onPendientes }: Props) {
  const [tipo, setTipo] = useState('srl');
  const [empleados, setEmpleados] = useState(false);
  const [rubros, setRubros] = useState<string[]>([]);
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        tipo,
        empleados: String(empleados),
        rubros: rubros.join(','),
      });
      const res = await fetch(`${API_URL}/api/formalizacion?${qs}`);
      if (!res.ok) throw new Error('No se pudo cargar la lista de trámites');
      const json: Resumen = await res.json();
      setData(json);
      onPendientes(json.faltantes.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }, [tipo, empleados, rubros, onPendientes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternar(item: Item) {
    const estado = SIGUIENTE[item.estado];
    // Optimista: marcar un trámite tiene que sentirse inmediato.
    setData((d) =>
      d
        ? {
            ...d,
            fases: d.fases.map((f) => ({
              ...f,
              items: f.items.map((i) => (i.id === item.id ? { ...i, estado } : i)),
            })),
          }
        : d,
    );
    await fetch(`${API_URL}/api/formalizacion/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    void cargar();
  }

  const pct = data && data.totalObligatorios > 0
    ? Math.round((data.hechos / data.totalObligatorios) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] glass p-5">
        <div className="flex items-start gap-2.5">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-[var(--color-gold)]" />
          <div>
            <h2 className="text-[15px] font-semibold">Formalización de la empresa</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              {data?.nota ??
                'Lista para no olvidarse un trámite. No es asesoría legal: confirmá cada requisito con la entidad.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--color-line)] pt-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-muted)]">Tipo</span>
            {TIPOS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={`rounded-full px-3 py-1.5 font-semibold transition ${
                  tipo === t.id
                    ? 'bg-[var(--color-accent-strong)] text-white'
                    : 'glass-soft text-[var(--color-muted)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setEmpleados((v) => !v)}
            className={`rounded-full px-3 py-1.5 font-semibold transition ${
              empleados
                ? 'bg-[var(--color-accent-strong)] text-white'
                : 'glass-soft text-[var(--color-muted)]'
            }`}
          >
            Tengo empleados
          </button>

          <div className="flex items-center gap-2">
            {RUBROS.map((r) => {
              const on = rubros.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() =>
                    setRubros((v) => (on ? v.filter((x) => x !== r.id) : [...v, r.id]))
                  }
                  className={`rounded-full px-3 py-1.5 font-semibold transition ${
                    on
                      ? 'bg-[var(--color-accent-strong)] text-white'
                      : 'glass-soft text-[var(--color-muted)]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {data && !data.persistente && (
          <p className="mt-3 text-[11px] text-[var(--color-faint)]">
            Sin base de datos configurada: el avance se guarda en memoria y se pierde al reiniciar
            el servidor.
          </p>
        )}
      </section>

      {error && (
        <div className="rounded-[var(--radius-card)] glass p-5 text-sm text-[var(--color-bad)]">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="rounded-[var(--radius-card)] glass p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold">
                {data.hechos} de {data.totalObligatorios} obligatorios
              </h3>
              <span className="text-xs text-[var(--color-muted)]">
                {data.faltantes.length === 0
                  ? 'Todo en regla según esta lista'
                  : `Te faltan ${data.faltantes.length}`}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.07]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: pct === 100 ? 'var(--color-good)' : 'var(--color-gold)',
                }}
              />
            </div>

            {data.faltantes.length > 0 && (
              <button
                onClick={() =>
                  onAsk(
                    'director',
                    `Me faltan estos trámites: ${data.faltantes.map((f) => f.titulo).join(', ')}. ¿Por cuál empiezo y por qué?`,
                  )
                }
                className="mt-4 rounded-full bg-[var(--color-accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                ¿Por cuál trámite empiezo?
              </button>
            )}
          </div>

          {data.fases.map((f) => (
            <section key={f.id} className="rounded-[var(--radius-card)] glass p-5">
              <h3 className="text-[15px] font-semibold">{f.nombre}</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{f.descripcion}</p>

              <ul className="mt-4 space-y-2.5">
                {f.items.map((i) => {
                  const s = SELLO[i.estado];
                  return (
                    <li
                      key={i.id}
                      className={`rounded-xl p-3.5 transition ${
                        i.estado === 'no_aplica' ? 'opacity-55' : ''
                      } bg-black/[0.03]`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{i.titulo}</span>
                            {i.obligatorio && i.estado !== 'no_aplica' && (
                              <span className="rounded-full bg-[var(--color-bad)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-bad)]">
                                obligatorio
                              </span>
                            )}
                            {i.renovacion && (
                              <span className="text-[10px] uppercase tracking-wide text-[var(--color-faint)]">
                                renueva {i.renovacion}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                            {i.descripcion}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--color-faint)]">
                            {i.entidad}
                            {i.fuente && (
                              <>
                                {' · '}
                                <a
                                  href={i.fuente}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  sitio oficial
                                </a>
                              </>
                            )}
                          </p>
                        </div>

                        <button
                          onClick={() => void alternar(i)}
                          title="Cambiar estado"
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${s.fondo} ${s.texto}`}
                        >
                          {s.label}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
