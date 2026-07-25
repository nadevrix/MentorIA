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

interface Props {
  tabs: readonly Tab[];
  activeTab: string;
  onTab: (id: string) => void;
  title: string;
  subtitle?: string;
  /** Chip de la barra superior: el tipo de cambio vigente (único desde la unificación). */
  rate?: { valor: number; variacionPct?: number | null } | null;
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
  title,
  subtitle,
  rate,
  headerRight,
  children,
  aside,
}: Props) {
  // Sin fondo propio en el contenedor exterior: un color opaco acá taparía las
  // luces del lienzo y el vidrio se quedaría sin nada que refractar.
  return (
    <div className="min-h-full p-3 lg:p-6">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-[1440px] flex-col overflow-hidden rounded-[var(--radius-shell)] glass-shell lg:h-[calc(100vh-3rem)] lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-6 px-6 py-5">
            <Logo />

            <nav className="hidden items-center gap-6 text-sm md:flex">
              <span className="font-semibold text-[var(--color-accent)]">Inicio</span>
              <span className="text-[var(--color-muted)]">Ajustes</span>
              <span className="text-[var(--color-muted)]">Ayuda</span>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {rate && (
                <div className="flex items-center gap-2.5 rounded-full glass-soft px-4 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-good)]" aria-hidden />
                  <span className="text-xs text-[var(--color-muted)]">Dólar</span>
                  <span className="text-sm font-semibold">Bs {rate.valor}</span>
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
              {headerRight}
            </div>
          </header>

          <div className="scroll-slim flex-1 overflow-y-auto px-6 pb-6">
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
                        ? 'font-semibold text-[var(--color-fg)]'
                        : tab.disabled
                          ? 'cursor-not-allowed text-[var(--color-faint)]'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    {tab.label}
                    {!tab.disabled && tab.badge != null && tab.badge > 0 && (
                      <span
                        title={`${tab.badge} pendiente(s)`}
                        className="ml-1.5 rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-gold)]"
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

        <aside className="flex w-full shrink-0 flex-col border-t border-[var(--color-line)] bg-white/40 lg:h-auto lg:w-[400px] lg:border-l lg:border-t-0">
          {aside}
        </aside>
      </div>
    </div>
  );
}
