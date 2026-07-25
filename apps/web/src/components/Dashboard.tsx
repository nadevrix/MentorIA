import { bob } from '../lib/api';
import Icon from './Icon';

interface Props {
  data: Record<string, any> | null;
  loading: boolean;
}

type Tone = 'neutral' | 'good' | 'bad' | 'gold';

const TONE: Record<Tone, string> = {
  neutral: 'text-[var(--color-fg)]',
  good: 'text-[var(--color-good)]',
  bad: 'text-[var(--color-bad)]',
  gold: 'text-[var(--color-gold)]',
};

function Metric({
  label,
  value,
  detail,
  delta,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  /** Variación porcentual; dibuja flecha y color por sí sola. */
  delta?: number | null;
  tone?: Tone;
}) {
  return (
    <div className="rounded-[var(--radius-card)] glass p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
        {delta !== undefined && delta !== null && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              delta >= 0
                ? 'bg-[var(--color-good)]/15 text-[var(--color-good)]'
                : 'bg-[var(--color-bad)]/15 text-[var(--color-bad)]'
            }`}
          >
            {/* Flecha además del color: el color solo no es accesible. */}
            <Icon name={delta >= 0 ? 'up' : 'down'} size={11} />
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className={`mt-2 text-[26px] font-semibold leading-none ${TONE[tone]}`}>{value}</div>
      {detail && <div className="mt-1.5 text-xs text-[var(--color-muted)]">{detail}</div>}
    </div>
  );
}

export default function Dashboard({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-[var(--radius-card)] bg-black/[0.05]"
          />
        ))}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-[var(--radius-card)] glass p-4 text-sm text-[var(--color-bad)]">
        No se pudo cargar el panel. ¿Está corriendo el backend?
      </div>
    );
  }

  const { fx, margenes, ventas, inventario, finanzas, pagos, clientes } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Tipo de cambio"
          value={`Bs ${fx.tipoCambio}`}
          detail={
            fx.variacionDesdeUnificacionPct != null
              ? `${fx.variacionDesdeUnificacionPct > 0 ? '+' : ''}${fx.variacionDesdeUnificacionPct}% desde la unificación`
              : `Régimen ${fx.regimen}`
          }
          delta={fx.variacion30dPct}
          tone={fx.variacion30dPct > 3 ? 'gold' : 'neutral'}
        />
        <Metric
          label="Ventas 30 días"
          value={bob(ventas.totalBob)}
          detail={`${ventas.cantidadVentas} ventas · ticket ${bob(ventas.ticketPromedioBob)}`}
          delta={ventas.variacionPct}
        />
        <Metric
          label="Utilidad neta 30d"
          value={bob(finanzas.utilidadNetaBob)}
          detail={`Margen neto ${finanzas.margenNetoPct}%`}
          tone={finanzas.utilidadNetaBob < 0 ? 'bad' : 'good'}
        />
        <Metric
          label="Productos en riesgo"
          value={String(margenes.totalEnRiesgo)}
          detail={`${margenes.totalPerdiendoDinero} ya se venden bajo costo`}
          tone={margenes.totalPerdiendoDinero > 0 ? 'bad' : 'good'}
        />
        <Metric
          label="Por agotarse"
          value={String(inventario.porAgotarse.length)}
          detail={`${bob(inventario.capitalInmovilizadoTotalBob)} en inventario`}
          tone={inventario.porAgotarse.length > 0 ? 'gold' : 'neutral'}
        />
        <Metric
          label="Por pagar"
          value={bob(pagos.totalPendienteBob)}
          detail={`${pagos.vencidas.length} vencidas · ${pagos.proximas.length} esta semana`}
          tone={pagos.vencidas.length > 0 ? 'bad' : 'neutral'}
        />
      </div>

      {margenes.productos.length > 0 && (
        <div className="rounded-[var(--radius-card)] glass p-5">
          <h3 className="text-sm font-semibold">Márgenes bajo presión</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Recalculado al costo de reposición de hoy (Bs {fx.tipoCambio}/USD), no al de compra.
          </p>
          <div className="scroll-slim mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Precio</th>
                  <th className="pb-2 text-right font-medium">Costo hoy</th>
                  <th className="pb-2 text-right font-medium">Al comprar</th>
                  <th className="pb-2 text-right font-medium">Margen real</th>
                </tr>
              </thead>
              <tbody>
                {margenes.productos.map((p: any) => (
                  <tr key={p.id} className="border-t border-[var(--color-line)]">
                    <td className="py-2.5 pr-2">{p.nombre}</td>
                    <td className="py-2.5 text-right">{bob(p.precioBob)}</td>
                    <td className="py-2.5 text-right">{bob(p.costoReposicionHoyBob)}</td>
                    <td className="py-2.5 text-right text-[var(--color-faint)]">
                      {p.margenAlComprarPct}%
                    </td>
                    <td
                      className={`py-2.5 text-right font-semibold ${
                        p.pierdeDinero
                          ? 'text-[var(--color-bad)]'
                          : p.enRiesgo
                            ? 'text-[var(--color-gold)]'
                            : 'text-[var(--color-good)]'
                      }`}
                    >
                      {p.margenRealHoyPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clientes.inactivos.length > 0 && (
        <div className="rounded-[var(--radius-card)] glass p-5">
          <h3 className="text-sm font-semibold">Clientes que dejaron de comprar</h3>
          <ul className="mt-3 space-y-2.5 text-sm">
            {clientes.inactivos.slice(0, 4).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-4">
                <span>{c.nombre}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {c.diasSinComprar} días · {bob(c.totalGastadoBob)} histórico
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
