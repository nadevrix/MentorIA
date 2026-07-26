/**
 * Plantillas de prompt para las piezas de marketing.
 *
 * La composición es determinista: mismas opciones, mismo prompt. No pasa por el
 * modelo porque no hace falta —armar un texto con huecos no es una decisión— y
 * porque así el dueño puede repetir una pieza que le funcionó sin depender de
 * que el modelo redacte igual dos veces.
 *
 * Los prompts van en inglés a propósito: los modelos de imagen entienden mucho
 * mejor el vocabulario fotográfico en inglés, y la diferencia se nota. Lo que ve
 * el usuario está en español; lo que viaja al generador, no.
 */

export type SeccionMarketing = 'nuevo-producto' | 'promocion' | 'anuncio' | 'personalizado';

export interface CampoPlantilla {
  id: string;
  etiqueta: string;
  /** Texto de ejemplo dentro del campo. */
  ejemplo: string;
  obligatorio: boolean;
}

export interface PlantillaMarketing {
  id: SeccionMarketing;
  nombre: string;
  /** Para qué sirve, en una línea, visible al usuario. */
  proposito: string;
  campos: CampoPlantilla[];
  /**
   * Plantilla del prompt, en inglés.
   *
   * `{campo}` se reemplaza por lo que escribió el usuario. `[[ ... ]]` marca un
   * tramo opcional: si los campos que contiene están vacíos, el tramo entero
   * desaparece —así una promoción sin fecha no queda con un "hasta ." colgando—.
   *
   * Vive acá, con los datos, y no repartido entre servidor e interfaz: el texto
   * que define el producto no puede tener dos versiones que se desincronicen.
   */
  plantilla: string;
}

export interface EstiloVisual {
  id: string;
  /** Cómo se llama para el usuario. */
  nombre: string;
  /** Lo que realmente se le manda al generador. */
  descripcion: string;
}

/**
 * Estilos más usados en publicidad de producto.
 *
 * No es una lista cerrada: el usuario puede escribir el suyo, y ese texto entra
 * tal cual. Estos están para que quien no sabe qué pedir no arranque de cero.
 */
export const ESTILOS: readonly EstiloVisual[] = [
  {
    id: 'estudio',
    nombre: 'Foto de estudio',
    descripcion:
      'clean studio product photography, seamless background, soft diffused key light with subtle rim light, crisp focus, commercial catalog quality',
  },
  {
    id: 'minimalista',
    nombre: 'Minimalista',
    descripcion:
      'minimalist composition, single flat pastel background, generous negative space, one soft shadow, calm and uncluttered, editorial simplicity',
  },
  {
    id: 'vibrante',
    nombre: 'Vibrante y llamativo',
    descripcion:
      'bold saturated colors, high contrast, dynamic diagonal composition, energetic pop-art influence, eye-catching and loud, designed to stop the scroll',
  },
  {
    id: 'lifestyle',
    nombre: 'Natural / lifestyle',
    descripcion:
      'lifestyle photography, product in real everyday use, natural window light, shallow depth of field, warm and authentic, unposed feel',
  },
  {
    id: 'lujo',
    nombre: 'Elegante / premium',
    descripcion:
      'luxury product photography, dark moody background, dramatic directional lighting, reflective surface, gold and deep tones, sophisticated and aspirational',
  },
  {
    id: 'flatlay',
    nombre: 'Vista cenital (flat lay)',
    descripcion:
      'top-down flat lay, product centered on textured surface, complementary props arranged symmetrically, even soft lighting, organized and tidy',
  },
  {
    id: 'urbano',
    nombre: 'Urbano / callejero',
    descripcion:
      'urban street setting, concrete and neon elements, gritty realistic textures, late afternoon light, contemporary and youthful',
  },
  {
    id: 'ilustracion',
    nombre: 'Ilustración plana',
    descripcion:
      'flat vector illustration, simple geometric shapes, limited harmonious color palette, thick clean outlines, friendly modern design',
  },
];

export const PLANTILLAS: readonly PlantillaMarketing[] = [
  {
    id: 'nuevo-producto',
    nombre: 'Nuevo producto',
    proposito: 'Presentar algo que recién entró. El producto es el protagonista.',
    campos: [
      { id: 'producto', etiqueta: 'Producto', ejemplo: 'Auriculares inalámbricos X200', obligatorio: true },
      { id: 'detalle', etiqueta: 'Qué lo hace distinto', ejemplo: 'batería de 30 horas', obligatorio: false },
    ],
    plantilla:
      'Advertising photograph announcing a new product: {producto}. The product is the hero of the image, ' +
      'centered and sharply lit[[, highlighting that it {detalle}]]. Leave clean empty space in the upper ' +
      'third for a headline.',
  },
  {
    id: 'promocion',
    nombre: 'Promoción',
    proposito: 'Mover stock con un descuento o una oferta por tiempo limitado.',
    campos: [
      { id: 'producto', etiqueta: 'Producto', ejemplo: 'Parlante portátil', obligatorio: true },
      { id: 'oferta', etiqueta: 'La oferta', ejemplo: '30% de descuento', obligatorio: true },
      { id: 'vigencia', etiqueta: 'Hasta cuándo', ejemplo: 'sólo este fin de semana', obligatorio: false },
    ],
    plantilla:
      'Promotional advertising image for {producto} with a special offer: {oferta}. Composition built to feel ' +
      'urgent and valuable[[, conveying that it is limited: {vigencia}]]. Leave a clear high-contrast area for ' +
      'the discount badge.',
  },
  {
    id: 'anuncio',
    nombre: 'Anuncio',
    proposito: 'Comunicar algo del negocio: apertura, horario nuevo, envíos, sucursal.',
    campos: [
      { id: 'mensaje', etiqueta: 'Qué querés anunciar', ejemplo: 'Ahora hacemos envíos a todo el país', obligatorio: true },
      { id: 'negocio', etiqueta: 'Nombre del negocio', ejemplo: 'Importadora Ñuflo', obligatorio: false },
    ],
    plantilla:
      'Advertising image for a business announcement: {mensaje}[[, for the business {negocio}]]. Clear and ' +
      'welcoming, not a product close-up. Leave generous empty space for the announcement text.',
  },
  {
    id: 'personalizado',
    nombre: 'Personalizado',
    proposito: 'Escribí vos la escena. El estilo y las fotos se agregan igual.',
    campos: [
      { id: 'idea', etiqueta: 'Describí la imagen que querés', ejemplo: 'una mesa de desayuno con el producto al centro', obligatorio: true },
    ],
    plantilla: '{idea}',
  },
];

/** Tramos que se agregan según lo que el usuario adjunte o pida. */
export const COLETILLAS = {
  /** Sin esto, el generador suele ignorar la foto adjunta. */
  fotoProducto:
    'Use the attached product photograph as the exact reference for the product: keep its shape, color, ' +
    'proportions and label faithful. Do not invent a different product.',
  logo:
    'Place the attached logo discreetly in one corner, small, legible and unaltered. Do not redraw or restyle it.',
  formato: 'Square 1:1 format, suitable for a social media post.',
  /**
   * Va siempre y no es negociable: los modelos de imagen deletrean mal, y un
   * cartel con una palabra rota se ve peor que uno sin texto. El texto lo pone
   * después quien arma el post.
   */
  sinTexto: 'No text, no lettering, no watermark, no logos other than the one provided.',
} as const;

export interface ComposicionPrompt {
  plantilla: string;
  valores: Record<string, string>;
  /** Id de ESTILOS, o el texto que escribió el usuario si eligió otro. */
  estilo: string;
  conFotoProducto?: boolean;
  conLogo?: boolean;
}

/**
 * Rellena una plantilla.
 *
 * `{campo}` toma el valor; `[[ tramo ]]` se conserva sólo si TODOS los campos
 * que menciona tienen valor. Sin eso, una promoción sin fecha terminaba con un
 * "conveying that it is limited: ." pegado al final.
 */
export function rellenar(plantilla: string, valores: Record<string, string>): string {
  const valor = (id: string) => (valores[id] ?? '').trim();

  return plantilla
    .replace(/\[\[(.*?)\]\]/gs, (_, tramo: string) => {
      const campos = [...tramo.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);
      return campos.every((c) => valor(c) !== '') ? tramo : '';
    })
    .replace(/\{(\w+)\}/g, (_, id: string) => valor(id))
    .replace(/\s+/g, ' ')
    .trim();
}

/** El estilo elegido: de la lista si coincide un id, o el texto tal cual. */
export function textoEstilo(estilo: string): string {
  return ESTILOS.find((e) => e.id === estilo)?.descripcion ?? estilo.trim();
}

/**
 * Arma el prompt final.
 *
 * El orden importa: escena, estilo, referencias, encuadre, y al final lo que NO
 * debe hacer. Los generadores pesan más lo que va primero.
 */
export function componerPrompt(c: ComposicionPrompt): string {
  return [
    rellenar(c.plantilla, c.valores),
    textoEstilo(c.estilo),
    c.conFotoProducto ? COLETILLAS.fotoProducto : '',
    c.conLogo ? COLETILLAS.logo : '',
    COLETILLAS.formato,
    COLETILLAS.sinTexto,
  ]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
}
