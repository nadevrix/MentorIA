import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  BarChart3,
  Check,
  Compass,
  Loader2,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Iconos de la interfaz.
 *
 * SVG en vez de emoji, y no es cosmético: un emoji se dibuja distinto en cada
 * sistema operativo, no hereda el color del contexto y no se puede alinear con
 * precisión. Un SVG toma `currentColor` y se ve igual en todas partes.
 *
 * Lucide, licencia ISC: libre para uso comercial y sin atribución. Se importa
 * por nombre, así que el bundle sólo se lleva los iconos que se usan.
 *
 * El backend manda el NOMBRE del icono (ver AgentDefinition.icon); el mapeo a
 * componente vive acá, del lado que sabe de presentación.
 */
const ICONS = {
  compass: Compass,
  banknote: Banknote,
  package: Package,
  chart: BarChart3,
  users: Users,
  up: ArrowUp,
  down: ArrowDown,
  check: Check,
  warning: AlertTriangle,
  loading: Loader2,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: string;
  size?: number;
  className?: string;
  /** Gira, para estados de carga. */
  spin?: boolean;
}

export default function Icon({ name, size = 16, className = '', spin = false }: Props) {
  const Cmp = ICONS[name as IconName];
  // Un nombre desconocido no debe romper la pantalla: se dibuja nada.
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={2}
      aria-hidden
      className={`${spin ? 'animate-spin ' : ''}${className}`}
    />
  );
}
