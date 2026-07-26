import BrainMark from './BrainMark';
import Icon from './Icon';
import LandingDemo from './LandingDemo';
import type { ModoAcceso } from './Login';

/**
 * Portada.
 *
 * Estructura tomada de exa.ai: barra mínima con dos botones a la derecha,
 * titular grande con mucho aire, y —lo que de verdad la define— una demo
 * interactiva apenas debajo del titular, con controles y una tabla de salida
 * real. Después, bloques de capacidades, un bloque de confianza con salida en
 * monoespaciada, y un pie a varias columnas.
 *
 * La decisión que importa: la demo va ARRIBA, antes de explicar nada. Contar lo
 * que hace un producto convence menos que ejecutarlo delante de quien mira, y
 * el simulador cambiario se entiende en tres segundos sin saber nada del rubro.
 */

interface Props {
  onEntrar: (modo: ModoAcceso) => void;
}

const CAPACIDADES = [
  {
    icon: 'banknote',
    titulo: 'Precios que siguen al dólar',
    texto:
      'Compara cada precio con lo que costaría reponer el producto hoy, no con lo que costó al comprarlo. Ahí aparecen los que se venden bien y pierden plata.',
  },
  {
    icon: 'package',
    titulo: 'Inventario y clientes',
    texto:
      'Qué está por agotarse, cuánto capital tenés dormido en mercadería que no rota, y qué clientes dejaron de comprarte sin que lo notaras.',
  },
  {
    icon: 'chart',
    titulo: 'Impuestos al día',
    texto:
      'IVA, IT e IUE estimados, con la fecha de vencimiento según el último dígito de tu NIT y los formularios del SIN que te tocan.',
  },
  {
    icon: 'compass',
    titulo: 'Trámites para operar en regla',
    texto:
      'SEPREC, NIT, licencia municipal, empleadores y los permisos de tu rubro. Marcás lo que ya hiciste y queda guardado.',
  },
];

const NUMEROS = [
  { valor: '5', rotulo: 'agentes especializados' },
  { valor: '12', rotulo: 'herramientas deterministas' },
  { valor: '8', rotulo: 'detectores de riesgo' },
  { valor: '57', rotulo: 'formularios del SIN' },
];

export default function Landing({ onEntrar }: Props) {
  return (
    <div className="min-h-full">
      {/* Barra mínima: marca a la izquierda, acciones a la derecha. */}
      <header className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-4 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <BrainMark size={32} className="text-[var(--color-accent)]" />
          <span className="text-[16px] font-bold tracking-tight">
            Mentor <span className="text-[var(--color-accent)]">IA</span>
          </span>
        </div>

        {/*
          Arriba a la derecha, el par de siempre: entrar en secundario y
          registrarse en primario. Quien ya tiene cuenta busca el enlace; quien
          no la tiene necesita que el botón lo empuje.
        */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEntrar('login')}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => onEntrar('registro')}
            className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-strong)]"
          >
            Registrarse
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5">
        <section className="pb-10 pt-10 md:pb-14 md:pt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Copiloto para PyMEs bolivianas
          </p>
          {/* clamp: el titular llena la pantalla en desktop sin desbordar en móvil. */}
          <h1
            className="mt-5 max-w-[15ch] font-bold tracking-tight"
            style={{ fontSize: 'clamp(2.35rem, 6.2vw, 4.25rem)', lineHeight: 1.03 }}
          >
            Vender bien y perder plata al mismo tiempo.
          </h1>
          <p className="mt-6 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-muted)] md:text-[19px]">
            Desde que el dólar flota, reponer lo que vendés cuesta más cada semana. La lista de
            precios no se actualiza sola. Mentor IA revisa tu negocio todos los días y te dice qué
            hacer: con el producto, el monto y la fecha.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {/* Los llamados del cuerpo van a registro: quien baja hasta acá todavía no entró. */}
            <button
              type="button"
              onClick={() => onEntrar('registro')}
              className="rounded-full bg-[var(--color-accent)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-strong)]"
            >
              Crear cuenta gratis
            </button>
            <span className="text-[13px] text-[var(--color-muted)]">
              Probá la demo de acá abajo sin registrarte.
            </span>
          </div>
        </section>

        {/* El producto ejecutándose, antes de cualquier explicación. */}
        <LandingDemo />

        <section id="capacidades" className="scroll-mt-6 pt-20">
          <h2 className="max-w-[20ch] text-[26px] font-bold tracking-tight md:text-[32px]">
            Cuatro frentes que un dueño no puede mirar todos los días.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {CAPACIDADES.map((c) => (
              <article key={c.titulo} className="rounded-[var(--radius-card)] glass p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
                  <Icon name={c.icon} size={18} />
                </span>
                <h3 className="mt-4 text-[16px] font-semibold">{c.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{c.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pt-20">
          <div className="rounded-[var(--radius-card)] glass overflow-hidden">
            <div className="p-6 md:p-9">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
                Por qué creerle a los números
              </p>
              <h2 className="mt-4 max-w-[22ch] text-[26px] font-bold tracking-tight md:text-[32px]">
                El modelo no calcula: interpreta.
              </h2>
              <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-muted)]">
                Cada cifra sale de un cálculo determinista sobre tus datos — el mismo número,
                siempre, con o sin conexión al modelo. La inteligencia artificial redacta la
                explicación y decide qué mirar primero, nada más. El resumen diario ni siquiera
                tiene herramientas para consultar por su cuenta: sólo puede narrar números que ya
                se calcularon, así que estructuralmente no puede inventarte uno.
              </p>
            </div>

            {/* Salida cruda en monoespaciada: se ve que hay un cálculo detrás, no una frase. */}
            <div className="overflow-x-auto border-t border-[var(--color-line)] bg-black/[0.03] px-6 py-5 md:px-9">
              <pre className="font-mono text-[12px] leading-relaxed text-[var(--color-muted)]">
{`analyze_margins → {
  producto:            "Cable USB-C trenzado 2m",
  precioBob:           25.00,
  costoReposicionBob:  27.29,   // costUsd × tipoCambioVigente
  margenRealPct:       -9.16,   // cada venta pierde Bs 2,29
  precioSugeridoBob:   41.98
}`}
              </pre>
            </div>
          </div>
        </section>

        <section className="pt-20">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {NUMEROS.map((n) => (
              <div key={n.rotulo} className="rounded-[var(--radius-card)] glass px-5 py-6">
                <dt className="text-[34px] font-bold leading-none tabular-nums text-[var(--color-accent)]">
                  {n.valor}
                </dt>
                <dd className="mt-2 text-[13px] leading-snug text-[var(--color-muted)]">
                  {n.rotulo}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="pt-20">
          <div className="rounded-[var(--radius-card)] glass p-8 text-center md:p-12">
            <h2 className="mx-auto max-w-[22ch] text-[26px] font-bold tracking-tight md:text-[32px]">
              Entrá y mirá qué encontraron tus agentes.
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-[var(--color-muted)]">
              El panel abre con datos de ejemplo cargados. Podés reemplazarlos por los tuyos
              subiendo un CSV.
            </p>
            <button
              type="button"
              onClick={() => onEntrar('registro')}
              className="mt-7 rounded-full bg-[var(--color-accent)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-strong)]"
            >
              Crear cuenta gratis
            </button>
          </div>
        </section>

        <footer className="mt-20 grid gap-8 border-t border-[var(--color-line)] py-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <BrainMark size={22} className="text-[var(--color-accent)]" />
              <span className="text-sm font-bold tracking-tight">Mentor IA</span>
            </div>
            <p className="mt-2.5 max-w-[34ch] text-xs leading-relaxed text-[var(--color-faint)]">
              Copiloto de decisión para PyMEs importadoras bolivianas.
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Fuentes
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-[var(--color-faint)]">
              <li>
                <a
                  href="https://www.bcb.gob.bo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-[var(--color-fg)]"
                >
                  Banco Central de Bolivia
                </a>
              </li>
              <li>
                <a
                  href="https://www.impuestos.gob.bo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-[var(--color-fg)]"
                >
                  Servicio de Impuestos Nacionales
                </a>
              </li>
              <li>
                <a
                  href="https://www.seprec.gob.bo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-[var(--color-fg)]"
                >
                  SEPREC
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Alcance
            </p>
            <p className="mt-3 max-w-[36ch] text-xs leading-relaxed text-[var(--color-faint)]">
              Los impuestos son una estimación para reservar plata y no perder vencimientos: no es
              una declaración ni reemplaza a tu contador. La app no cobra, no paga y no transfiere
              dinero.
            </p>
            <p className="mt-3 text-xs text-[var(--color-faint)]">Buildathon Bolivia 2026</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
