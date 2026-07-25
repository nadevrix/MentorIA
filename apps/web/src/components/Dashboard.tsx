import { bob } from '../lib/api';

interface Props {
  data: Record<string, any> | null;
  loading: boolean;
}

function Card({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  const toneClass =
    tone === 'bad' ? 'text-[var(--color-bad)]' : tone === 'good' ? 'text-[var(--color-good)]' : 'text-white';
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-400">{detail}</div>}
    </div>
  );
}

export default function Dashboard({ data, loading }: Props) {
  if (loading) {
    return <div className="p-4 text-sm text-slate-400">Cargando indicadores…</div>;
  }
  if (!data) {
    return (
      <div className="p-4 text-sm text-[var(--color-bad)]">
        No se pudo cargar el panel. ¿Está corriendo el backend?
      </div>
    );
  }

  const { fx, margenes, ventas, inventario, finanzas, pagos, clientes } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card
          label="Dólar paralelo"
          value={`${fx.paralelo} Bs`}
          detail={`Oficial ${fx.oficial} · ${fx.variacion30dPct > 0 ? '+' : ''}${fx.variacion30dPct}% en 30d`}
          tone={fx.variacion30dPct > 3 ? 'bad' : 'neutral'}
        />
        <Card
          label="Ventas 30 días"
          value={bob(ventas.totalBob)}
          detail={
            ventas.variacionPct === null
              ? `${ventas.cantidadVentas} ventas`
              : `${ventas.variacionPct > 0 ? '+' : ''}${ventas.variacionPct}% vs. mes anterior`
          }
          tone={ventas.variacionPct !== null && ventas.variacionPct < 0 ? 'bad' : 'good'}
        />
        <Card
          label="Utilidad neta 30d"
          value={bob(finanzas.utilidadNetaBob)}
          detail={`Margen neto ${finanzas.margenNetoPct}%`}
          tone={finanzas.utilidadNetaBob < 0 ? 'bad' : 'good'}
        />
        <Card
          label="Productos en riesgo"
          value={String(margenes.totalEnRiesgo)}
          detail={`${margenes.totalPerdiendoDinero} ya se venden bajo costo de reposición`}
          tone={margenes.totalEnRiesgo > 0 ? 'bad' : 'good'}
        />
        <Card
          label="Por agotarse"
          value={String(inventario.porAgotarse.length)}
          detail={`${bob(inventario.capitalInmovilizadoTotalBob)} inmovilizados en stock`}
        />
        <Card
          label="Por pagar"
          value={bob(pagos.totalPendienteBob)}
          detail={`${pagos.vencidas.length} vencidas · ${pagos.proximas.length} esta semana`}
          tone={pagos.vencidas.length > 0 ? 'bad' : 'neutral'}
        />
      </div>

      {margenes.productos.length > 0 && (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-semibold">Márgenes bajo presión</h3>
          <p className="mt-1 text-xs text-slate-400">
            Recalculado al costo de reposición de hoy ({fx.paralelo} Bs/USD), no al de compra.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-2">Producto</th>
                  <th className="pb-2 text-right">Precio</th>
                  <th className="pb-2 text-right">Costo hoy</th>
                  <th className="pb-2 text-right">Margen al comprar</th>
                  <th className="pb-2 text-right">Margen real</th>
                </tr>
              </thead>
              <tbody>
                {margenes.productos.map((p: any) => (
                  <tr key={p.id} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pr-2">{p.nombre}</td>
                    <td className="py-2 text-right tabular-nums">{bob(p.precioBob)}</td>
                    <td className="py-2 text-right tabular-nums">{bob(p.costoReposicionHoyBob)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-400">{p.margenAlComprarPct}%</td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${
                        p.pierdeDinero
                          ? 'text-[var(--color-bad)]'
                          : p.enRiesgo
                            ? 'text-[var(--color-accent)]'
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
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-semibold">Clientes que dejaron de comprar</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {clientes.inactivos.slice(0, 4).map((c: any) => (
              <li key={c.id} className="flex justify-between gap-4">
                <span>{c.nombre}</span>
                <span className="text-slate-400">
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
