import type { Agent } from '../lib/api';
import Icon from './Icon';

/**
 * Ayuda.
 *
 * Lo que hace falta para confiar en un número que decide un precio: qué mira
 * cada apartado, de dónde sale la plata que se muestra, qué significa cada
 * término y qué NO hace la app.
 *
 * La sección de dónde salen los números no es relleno: el reclamo más razonable
 * que puede tener alguien frente a una app con IA es "¿y esto lo inventó?".
 */

interface Props {
  agents: Agent[];
  onTab: (id: string) => void;
  onAsk: (agentId: string, question: string) => void;
}

const APARTADOS = [
  {
    id: 'resumen',
    titulo: 'Resumen',
    texto:
      'El tablero con el pulso del negocio y sus indicadores recalculados al costo de reposición de hoy.',
  },
  {
    id: 'urgencias',
    titulo: 'Urgencias',
    texto:
      'El resumen diario y los hallazgos que requieren acción, ordenados por severidad y por bolivianos en juego.',
  },
  {
    id: 'dolar',
    titulo: 'Dólar',
    texto:
      'Cuánto está el tipo de cambio, cómo se movió y qué pasa con tus precios si sigue subiendo. Desde la unificación de junio de 2026 la app trabaja con una cotización flexible vigente.',
  },
  {
    id: 'impuestos',
    titulo: 'Impuestos',
    texto:
      'Estimación de IVA, IT e IUE con las fechas de vencimiento según el último dígito de tu NIT, más el catálogo de formularios del SIN con los tuyos marcados.',
  },
  {
    id: 'tramites',
    titulo: 'Trámites',
    texto:
      'Lo que necesita una empresa para operar en regla: SEPREC, NIT, licencia municipal, empleadores y permisos por rubro. El avance se persiste si hay Postgres; sin base dura sólo durante la sesión del servidor.',
  },
  {
    id: 'datos',
    titulo: 'Mis datos',
    texto:
      'Subís tus productos, ventas, clientes y gastos en CSV. Con Postgres arrancan vacíos; lo que subís se guarda en la base.',
  },
  {
    id: 'marketing',
    titulo: 'Marketing',
    texto:
      'Qué conviene promocionar, calculado por margen y rotación, con prompts listos para generar la imagen del aviso.',
  },
];

const GLOSARIO = [
  {
    termino: 'Costo de reposición',
    texto:
      'Lo que te saldría reponer hoy lo que vendiste, no lo que te salió cuando lo compraste. Con el dólar en movimiento, cobrar sobre el costo viejo es vender perdiendo sin darte cuenta.',
  },
  {
    termino: 'Margen',
    texto:
      'Cuánto queda de cada venta después del costo, en porcentaje. Acá siempre se calcula contra el costo de reposición.',
  },
  {
    termino: 'IVA (13%)',
    texto:
      'Impuesto al Valor Agregado. Se declara mensual con el Formulario 200. Las compras con factura generan crédito fiscal que se resta del débito de tus ventas.',
  },
  {
    termino: 'IT (3%)',
    texto:
      'Impuesto a las Transacciones, sobre las ventas brutas. Formulario 400, mensual. Se puede compensar con el IUE pagado el año anterior.',
  },
  {
    termino: 'IUE (25%)',
    texto:
      'Impuesto sobre las Utilidades de las Empresas. Es anual, sobre la utilidad neta. Formulario 500.',
  },
  {
    termino: 'Tipo de cambio flexible',
    texto:
      'Desde el 29 de junio de 2026 la app modela un tipo de cambio vigente que flota. Cada cotización muestra fecha y fuente.',
  },
];

export default function Ayuda({ agents, onTab, onAsk }: Props) {
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] glass p-5">
        <h2 className="text-[15px] font-semibold">Qué es Mentor IA</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
          Un equipo de agentes que revisa tu negocio y te dice qué hacer hoy. No espera que le
          preguntes: cuando abrís el panel, ya encontró lo que te está costando plata — productos
          que vendés por debajo del costo de reposición, impuestos por vencer, stock que no rota,
          clientes que dejaron de comprar — y lo ordena por urgencia y por bolivianos en juego.
        </p>
      </section>

      <section className="rounded-[var(--radius-card)] glass p-5">
        <div className="flex items-start gap-2.5">
          <Icon name="check" size={16} className="mt-0.5 shrink-0 text-[var(--color-good)]" />
          <div className="max-w-2xl">
            <h2 className="text-[15px] font-semibold">De dónde salen los números</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              <strong className="font-semibold text-[var(--color-fg)]">
                El modelo no calcula: interpreta.
              </strong>{' '}
              Cada cifra que ves la produce un cálculo determinista sobre tus datos — el mismo
              número, siempre, con o sin conexión al modelo. La IA sólo redacta la explicación y
              decide qué mirar primero. El resumen diario ni siquiera tiene herramientas para
              consultar nada por su cuenta: sólo puede narrar los números que ya se calcularon,
              así que estructuralmente no puede inventarte uno.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              Los datos del negocio salen de lo que subas en{' '}
              <button onClick={() => onTab('datos')} className="font-semibold underline">
                Mis datos
              </button>
              ; el tipo de cambio, de la serie del BCB; los formularios, del sitio del SIN.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] glass p-5">
        <h2 className="text-[15px] font-semibold">Los apartados</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {APARTADOS.map((a) => (
            <button
              key={a.id}
              onClick={() => onTab(a.id)}
              className="rounded-xl bg-black/[0.03] p-4 text-left transition hover:bg-black/[0.06]"
            >
              <div className="text-sm font-semibold">{a.titulo}</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{a.texto}</p>
            </button>
          ))}
        </div>
      </section>

      {agents.length > 0 && (
        <section className="rounded-[var(--radius-card)] glass p-5">
          <h2 className="text-[15px] font-semibold">Los agentes</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cada uno mira una parte del negocio. Tocá un ejemplo y te lo responde con tus datos.
          </p>
          <div className="mt-4 space-y-4">
            {agents.map((a) => (
              <div key={a.id} className="border-t border-[var(--color-line)] pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <Icon name={a.icon} size={14} className="text-[var(--color-accent)]" />
                  <span className="text-sm font-semibold">{a.name}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{a.tagline}</p>
                {a.examples.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.examples.slice(0, 3).map((e) => (
                      <button
                        key={e}
                        onClick={() => onAsk(a.id, e)}
                        className="rounded-full glass-soft px-3 py-1.5 text-[11px] text-[var(--color-muted)]"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[var(--radius-card)] glass p-5">
        <h2 className="text-[15px] font-semibold">Glosario</h2>
        <dl className="mt-3 space-y-3">
          {GLOSARIO.map((g) => (
            <div key={g.termino}>
              <dt className="text-sm font-semibold">{g.termino}</dt>
              <dd className="mt-0.5 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)]">
                {g.texto}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-[var(--radius-card)] glass p-5">
        <div className="flex items-start gap-2.5">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-[var(--color-gold)]" />
          <div className="max-w-2xl">
            <h2 className="text-[15px] font-semibold">Qué no hace</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              No presenta declaraciones ni reemplaza a tu contador: los impuestos son una estimación
              para reservar plata y no perder vencimientos. La lista de trámites es un recordatorio,
              no asesoría legal — requisitos, montos y plazos cambian por normativa y por municipio.
              Y no toca tu plata: no paga, no cobra y no transfiere nada.
            </p>
            <p className="mt-2 text-xs text-[var(--color-faint)]">
              Fuentes oficiales:{' '}
              <a
                href="https://www.impuestos.gob.bo/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                SIN
              </a>{' '}
              ·{' '}
              <a
                href="https://www.seprec.gob.bo/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                SEPREC
              </a>{' '}
              ·{' '}
              <a
                href="https://www.bcb.gob.bo/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                BCB
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
