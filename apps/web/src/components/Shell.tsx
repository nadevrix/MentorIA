import type { ReactNode } from 'react';
import BrainMark from './BrainMark';
import Icon from './Icon';

/**
 * Cromo de la aplicación: contenedor flotante, navegación superior y pestañas.
 *
 * El contenedor es una lámina de vidrio sobre el lienzo con luces de color:
 * de ahí sale la refracción. Nada en esta cadena puede llevar fondo opaco,
 * porque taparía la luz que el vidrio necesita.
 */

export interface Tab {
  id: string;
  label: string;
  /** Las pestañas cuya funcionalidad todavía no existe se muestran apagadas. */
  disabled?: boolean;
  /** Cuántas cosas esperan acción. Se muestra sólo si es mayor que cero. */
  badge?: number;
}

export type TopNav = 'inicio' | 'ajustes' | 'ayuda';

interface Props {
  tabs: readonly Tab[];
  activeTab: string;
  onTab: (id: string) => void;
  topNav?: TopNav;
  onTopNav?: (nav: TopNav) => void;
  title: string;
  subtitle?: string;
  /** Chip de la barra superior: el tipo de cambio vigente (único desde la unificación). */
  rate?: { valor: number; variacionPct?: number | null } | null;
  urgenciasBadge?: { count: number } | null;
  onUrgenciasClick?: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
  aside: ReactNode;
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <BrainMark size={30} className="text-[var(--color-accent)]" />
      <span className="text-[15px] font-bold tracking-tight">
        Mentor <span className="text-[var(--color-accent)]">IA</span>
      </span>
    </div>
  );
}

export default function Shell({
  tabs,
  activeTab,
  onTab,
  topNav = 'inicio',
  onTopNav,
  title,
  subtitle,
  rate,
  urgenciasBadge,
  onUrgenciasClick,
  headerRight,
  children,
  aside,
}: Props) {
  // Sin fondo propio en el contenedor exterior: un color opaco acá taparía las
  // luces del lienzo y el vidrio se quedaría sin nada que refractar.
  return (
    <div className="min-h-full p-3 lg:p-6">
      {/*
        La altura fija es sólo de escritorio.

        En el teléfono la lámina se apilaba en columna dentro de una altura de
        pantalla con overflow oculto: el panel lateral quedaba abajo, sin límite
        de alto y sin poder encogerse, así que empujaba al contenido principal
        contra el techo y su propio final quedaba recortado. Resultado: no se
        podía subir ni bajar.

        Debajo de lg la lámina crece con su contenido y scrollea la página, que
        es como se espera que se comporte una página en un teléfono. dvh en vez
        de vh porque en móvil vh no descuenta la barra de direcciones.
      */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col overflow-hidden rounded-[var(--radius-shell)] glass-shell lg:h-[calc(100dvh-3rem)] lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* flex-wrap: en móvil el menú y el chip del dólar bajan de línea en vez de desaparecer. */}
          <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 md:px-6 md:py-5">
            <Logo />

            <nav className="flex items-center gap-1 text-sm md:gap-2">
              <button
                type="button"
                onClick={() => onTopNav?.('inicio')}
                className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                  topNav === 'inicio'
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/30'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-black/5'
                }`}
              >
                Inicio
              </button>
              <button
                type="button"
                onClick={() => onTopNav?.('ajustes')}
                className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                  topNav === 'ajustes'
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/30'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-black/5'
                }`}
              >
                Ajustes
              </button>
              <button
                type="button"
                onClick={() => onTopNav?.('ayuda')}
                className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                  topNav === 'ayuda'
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/30'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-black/5'
                }`}
              >
                Ayuda
              </button>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {rate && (
                <div className="flex items-center gap-2.5 rounded-full glass-soft px-4 py-2 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs text-[var(--color-muted)] font-medium">Dólar En Vivo</span>
                  <span className="text-sm font-semibold tabular-nums">Bs {rate.valor}</span>
                  {rate.variacionPct != null && (
                    <span
                      className={`flex items-center gap-0.5 text-xs font-semibold ${
                        rate.variacionPct >= 0
                          ? 'text-[var(--color-bad)]'
                          : 'text-[var(--color-good)]'
                      }`}
                    >
                      {/* Que suba es malo para el importador: rojo hacia arriba. */}
                      <Icon name={rate.variacionPct >= 0 ? 'up' : 'down'} size={11} />
                      {Math.abs(rate.variacionPct)}%
                    </span>
                  )}
                </div>
              )}

              {/* Botón de acceso a Urgencias */}
              <button
                type="button"
                onClick={onUrgenciasClick}
                className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-500/20 active:scale-95"
                title="Ver hallazgos urgentes del negocio"
              >
                <span>Urgencias</span>
                {urgenciasBadge && urgenciasBadge.count > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {urgenciasBadge.count}
                  </span>
                )}
              </button>

              {headerRight}
            </div>
          </header>

          {/* El scroll propio es de escritorio; en móvil scrollea la página. */}
          <div className="scroll-slim flex-1 px-4 pb-6 md:px-6 lg:overflow-y-auto">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[26px] font-bold leading-tight">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
              </div>
            </div>

            <div
              role="tablist"
              className="mt-5 flex flex-wrap items-center gap-6 border-b border-[var(--color-line)]"
            >
              {tabs.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    disabled={tab.disabled}
                    onClick={() => onTab(tab.id)}
                    className={`relative -mb-px pb-3 text-sm transition ${
                      active
                        ? tab.id === 'urgencias'
                          ? 'font-bold text-red-600'
                          : 'font-semibold text-[var(--color-fg)]'
                        : tab.disabled
                          ? 'cursor-not-allowed text-[var(--color-faint)]'
                          : tab.id === 'urgencias'
                            ? 'font-semibold text-red-600/80 hover:text-red-600'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    {tab.label}
                    {!tab.disabled && tab.badge != null && tab.badge > 0 && (
                      <span
                        title={`${tab.badge} pendiente(s)`}
                        className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                          tab.id === 'urgencias'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'bg-[var(--color-gold)]/15 text-[var(--color-gold)] font-semibold'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    {tab.disabled && (
                      <span className="ml-1.5 rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        pronto
                      </span>
                    )}
                    {active && (
                      <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[var(--color-accent)]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-4">{children}</div>
          </div>
        </main>

        {/*
          En móvil se le da una altura acotada a propósito: sin ella el chat
          crece con cada respuesta y la página se vuelve interminable. Con
          70dvh, el chat conserva su propio scroll y el pulgar llega al campo
          de escribir sin recorrer toda la conversación.
        */}
        <aside className="glass-aside flex h-[70dvh] w-full shrink-0 flex-col border-t border-[var(--color-line)] lg:h-full lg:max-h-full lg:overflow-hidden lg:w-[400px] lg:border-l lg:border-t-0">
          {aside}
        </aside>
      </div>
    </div>
  );
}
