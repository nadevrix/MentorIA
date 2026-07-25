import { useEffect, useState } from 'react';
import { fetchHealth, type Health } from '../lib/api';
import { RUBROS, usePerfil, type Regimen, type TipoSociedad } from '../lib/perfil';
import Icon from './Icon';

/**
 * Ajustes.
 *
 * Dos cosas, y nada más: el perfil del negocio (lo que cambia los números que
 * ve el comercio) y el estado real del servidor (lo que hace falta para saber
 * por qué algo no anda).
 *
 * El perfil es el mismo que editan Impuestos y Trámites: se toca en cualquier
 * lado y queda igual en los tres.
 */

const TIPOS: { id: TipoSociedad; label: string; nota: string }[] = [
  { id: 'unipersonal', label: 'Unipersonal', nota: 'Un solo dueño, sin escritura de constitución' },
  { id: 'srl', label: 'S.R.L.', nota: 'Socios con responsabilidad limitada' },
  { id: 'sa', label: 'S.A.', nota: 'Sociedad anónima, por acciones' },
];

function Fila({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-t border-[var(--color-line)] py-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 max-w-md">
        <div className="text-sm font-semibold">{titulo}</div>
        {detalle && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{detalle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
        activa
          ? 'bg-[var(--color-accent-strong)] text-white'
          : 'glass-soft text-[var(--color-muted)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Un dato del servidor: verde si está, ámbar si falta pero se puede seguir. */
function Estado({ label, valor, ok }: { label: string; valor: string; ok: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span
        className={`flex items-center gap-1.5 text-xs font-semibold ${
          ok ? 'text-[var(--color-good)]' : 'text-[var(--color-gold)]'
        }`}
      >
        <Icon name={ok ? 'check' : 'warning'} size={12} />
        {valor}
      </span>
    </div>
  );
}

export default function Ajustes() {
  const [perfil, guardar] = usePerfil();
  const [health, setHealth] = useState<Health | null>(null);
  const [sinServidor, setSinServidor] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setSinServidor(true));
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] glass p-5">
        <h2 className="text-[15px] font-semibold">Tu negocio</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Esto decide qué impuestos te tocan, en qué día vencen y qué trámites necesitás. Se guarda
          en este navegador, no en el servidor.
        </p>

        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <Fila titulo="Nombre" detalle="Aparece en el encabezado del panel.">
            <input
              value={perfil.negocio}
              onChange={(e) => guardar({ negocio: e.target.value })}
              placeholder="Mi comercio"
              maxLength={60}
              className="w-56 rounded-full glass-soft px-4 py-2 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </Fila>

          <Fila
            titulo="Último dígito del NIT"
            detalle="Define el día de vencimiento mensual. No pedimos ni guardamos el NIT completo: con el último dígito alcanza para las fechas."
          >
            <select
              value={perfil.digitoNit}
              onChange={(e) => guardar({ digitoNit: Number(e.target.value) })}
              className="rounded-full glass-soft px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Fila>

          <Fila
            titulo="Régimen tributario"
            detalle="En General se declaran IVA, IT e IUE. En Simplificado se paga una cuota bimestral fija por categoría."
          >
            {(['general', 'simplificado'] as Regimen[]).map((r) => (
              <Pastilla key={r} activa={perfil.regimen === r} onClick={() => guardar({ regimen: r })}>
                {r === 'general' ? 'General' : 'Simplificado'}
              </Pastilla>
            ))}
          </Fila>

          <Fila
            titulo="Tipo de sociedad"
            detalle={TIPOS.find((t) => t.id === perfil.tipoSociedad)?.nota}
          >
            {TIPOS.map((t) => (
              <Pastilla
                key={t.id}
                activa={perfil.tipoSociedad === t.id}
                onClick={() => guardar({ tipoSociedad: t.id })}
              >
                {t.label}
              </Pastilla>
            ))}
          </Fila>

          <Fila
            titulo="Empleados"
            detalle="Con personal en planilla se suman el ROE, la caja de salud y la Gestora Pública."
          >
            <Pastilla
              activa={perfil.conEmpleados}
              onClick={() => guardar({ conEmpleados: !perfil.conEmpleados })}
            >
              {perfil.conEmpleados ? 'Tengo empleados' : 'Trabajo sin empleados'}
            </Pastilla>
          </Fila>

          <Fila
            titulo="Rubro"
            detalle="Agrega los permisos que sólo aplican a ciertas actividades. Podés marcar más de uno."
          >
            {RUBROS.map((r) => {
              const on = perfil.rubros.includes(r.id);
              return (
                <Pastilla
                  key={r.id}
                  activa={on}
                  onClick={() =>
                    guardar({
                      rubros: on
                        ? perfil.rubros.filter((x) => x !== r.id)
                        : [...perfil.rubros, r.id],
                    })
                  }
                >
                  {r.label}
                </Pastilla>
              );
            })}
          </Fila>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] glass p-5">
        <h2 className="text-[15px] font-semibold">Estado del sistema</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          De dónde salen los datos ahora mismo. Si algo no responde, acá se ve.
        </p>

        <div className="mt-4 border-t border-[var(--color-line)] pt-2">
          {sinServidor && (
            <p className="py-2 text-sm text-[var(--color-bad)]">
              El servidor no responde. Levantalo con <code>npm run dev</code> y volvé a entrar.
            </p>
          )}

          {health && (
            <>
              <Estado
                label="Datos del negocio"
                valor={health.baseSource === 'seed' ? 'datos de ejemplo' : health.baseSource}
                ok={health.baseSource !== 'seed'}
              />
              <Estado label="Tipo de cambio" valor={health.fxSource} ok />
              <Estado
                label="Modelo (chat y resumen)"
                valor={health.hasApiKey ? 'configurado' : 'falta ANTHROPIC_API_KEY'}
                ok={health.hasApiKey}
              />
              <Estado
                label="Generación de imágenes"
                valor={health.imageProvider ?? 'sin proveedor: sólo prompts'}
                ok={Boolean(health.imageProvider)}
              />
              <Estado label="Agentes activos" valor={String(health.agents)} ok={health.agents > 0} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
