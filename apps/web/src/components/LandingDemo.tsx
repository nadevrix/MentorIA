import { useEffect, useState } from 'react';
import { bob, simulate, type ScenarioResult } from '../lib/api';
import Icon from './Icon';

/**
 * Demo en vivo de la portada.
 *
 * Es la pieza central: en vez de contar lo que hace el producto, lo ejecuta.
 * Se elige un tipo de cambio hipotético y la tabla muestra, con datos reales
 * y cálculo determinista, qué productos pasan a venderse bajo costo y a cuánto
 * habría que subirlos.
 *
 * Corre sin sesión y sin modelo: pega contra /api/simulate, que es aritmética
 * pura. Nadie tiene que registrarse para ver si esto sirve.
 *
 * Si la API no responde, esto NO puede quedar en blanco ni romper la portada:
 * degrada a un aviso y el resto de la página sigue en pie.
 */

const ESCENARIOS = [12, 13.5, 15];

/** "12" → "12,00" — la coma decimal es la boliviana. */
const conDecimales = (n: number) => n.toFixed(2).replace('.', ',');

export default function LandingDemo() {
  const [rate, setRate] = useState(13.5);
  const [data, setData] = useState<ScenarioResult | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    simulate(rate)
      .then((r) => {
        if (!vivo) return;
        setData(r);
        setEstado('listo');
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
    };
  }, [rate]);

  // Cinco filas alcanzan para que se entienda; el catálogo entero está adentro.
  const productos = (data?.productos ?? []).slice(0, 5);

  return (
    <section className="rounded-[var(--radius-card)] glass overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] p-5 md:p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Demo en vivo · sin registro
          </p>
          <h2 className="mt-2 text-[19px] font-semibold leading-tight">
            ¿Qué pasa con tus precios si el dólar llega a…?
          </h2>
        </div>

        {/* Los controles arriba a la derecha, junto a lo que modifican. */}
        <div className="flex items-center gap-1.5 rounded-full bg-black/[0.04] p-1">
          {ESCENARIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              aria-pressed={rate === r}
              className={`rounded-full px-3.5 py-1.5 font-mono text-xs font-semibold tabular-nums transition ${
                rate === r
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {conDecimales(r)}
            </button>
          ))}
        </div>
      </div>

      {estado === 'error' && (
        <div className="flex items-center gap-2.5 p-6 text-sm text-[var(--color-muted)]">
          <Icon name="warning" size={16} className="shrink-0 text-[var(--color-gold)]" />
          La demo en vivo no está disponible en este momento. El resto de la página funciona igual.
        </div>
      )}

      {estado === 'cargando' && (
        <div className="space-y-2 p-5 md:p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-black/[0.04]" />
          ))}
        </div>
      )}

      {estado === 'listo' && data && (
        <>
          <dl className="grid grid-cols-2 gap-px border-b border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-4">
            <Cifra
              rotulo="Tipo de cambio hoy"
              valor={`Bs ${conDecimales(data.escenario.tipoCambioActual)}`}
            />
            <Cifra
              rotulo="Bajo costo"
              valor={`${data.productosBajoCosto.antes} → ${data.productosBajoCosto.despues}`}
              alerta={data.productosBajoCosto.despues > data.productosBajoCosto.antes}
            />
            <Cifra
              rotulo="Margen promedio"
              valor={`${data.margenPromedioPct.despues.toFixed(1).replace('.', ',')}%`}
              alerta={data.margenPromedioPct.despues < 0}
            />
            <Cifra
              rotulo="Utilidad mensual"
              valor={bob(data.utilidadMensualBob.despues)}
              alerta={data.utilidadMensualBob.delta < 0}
            />
          </dl>

          {productos.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-muted)]">
              Todavía no hay productos cargados para simular.
            </p>
          ) : (
            // overflow-x-auto: una tabla ancha scrollea sola, no empuja la página.
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                    <th className="px-5 py-2.5 font-semibold">Producto</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Precio hoy</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Costo reponer</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Margen</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Debería costar</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="max-w-[240px] truncate px-5 py-3 font-medium">{p.nombre}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[var(--color-muted)]">
                        {bob(p.precioActualBob)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[var(--color-muted)]">
                        {bob(p.costoEscenarioBob)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold tabular-nums ${
                          p.margenEscenarioPct < 0
                            ? 'text-[var(--color-bad)]'
                            : 'text-[var(--color-good)]'
                        }`}
                      >
                        {p.margenEscenarioPct.toFixed(0)}%
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {bob(p.precioSugeridoBob)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="border-t border-[var(--color-line)] px-5 py-3.5 text-[11px] leading-relaxed text-[var(--color-faint)]">
            Calculado sobre datos de ejemplo con aritmética determinista, sin intervención del
            modelo. El mismo escenario da siempre el mismo número.
          </p>
        </>
      )}
    </section>
  );
}

function Cifra({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface)]/60 px-5 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {rotulo}
      </dt>
      <dd
        className={`mt-1 text-[19px] font-semibold tabular-nums ${
          alerta ? 'text-[var(--color-bad)]' : ''
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
