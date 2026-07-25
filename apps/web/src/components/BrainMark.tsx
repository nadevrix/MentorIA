interface Props {
  size?: number;
  className?: string;
}

/**
 * Marca de Mentor IA: un cerebro partido en dos mitades.
 *
 * La izquierda son trazas de circuito con nodos —la máquina—; la derecha son
 * circunvoluciones orgánicas —el criterio del dueño del negocio—. El producto
 * es exactamente esa unión: cálculo determinista de un lado, decisión humana
 * del otro.
 *
 * Dibujo original, no una copia de la imagen de stock: aquella es un preview
 * con marca de agua y su licencia no permite usarla como identidad de producto.
 *
 * Usa `currentColor`, así que toma el color del contexto donde se monte.
 * Trazo de 1,6 en un lienzo de 24 para que aguante a 20-32px sin empastarse.
 */
export default function BrainMark({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Mentor IA"
    >
      {/* Silueta: dos lóbulos simétricos con un surco central. */}
      <path d="M12 4.2c-1.5-1.3-3.6-1.3-5 0-.7.6-1.1 1.5-1.1 2.4-1.2.5-2 1.7-2 3 0 .8.3 1.5.8 2.1-.4.5-.6 1.2-.6 1.9 0 1.5 1 2.7 2.4 3.1.2 1.5 1.5 2.6 3 2.6 1 0 1.9-.5 2.5-1.2" />
      <path d="M12 4.2c1.5-1.3 3.6-1.3 5 0 .7.6 1.1 1.5 1.1 2.4 1.2.5 2 1.7 2 3 0 .8-.3 1.5-.8 2.1.4.5.6 1.2.6 1.9 0 1.5-1 2.7-2.4 3.1-.2 1.5-1.5 2.6-3 2.6-1 0-1.9-.5-2.5-1.2" />
      <path d="M12 4.2v14" />

      {/* Mitad izquierda: trazas rectas con nodos, lenguaje de circuito. */}
      <path d="M9.4 7.6H7.6v2.1" />
      <path d="M9.4 12.4H6.2" />
      <path d="M9.4 15.6H8v-1.6" />
      <circle cx="7.6" cy="10.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="12.4" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="13.5" r=".9" fill="currentColor" stroke="none" />

      {/* Mitad derecha: curvas orgánicas. */}
      <path d="M14.6 7.4c1.1.2 1.8 1 1.9 2.1" />
      <path d="M14.4 11.2c1.5 0 2.6.9 2.9 2.2" />
      <path d="M14.8 15.4c.9-.2 1.6-.8 1.9-1.6" />
    </svg>
  );
}
