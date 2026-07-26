import { useMemo, useRef, useState } from 'react';
// Del core, no una copia: si el prompt se armara distinto acá que en el
// servidor, el dueño vería un texto y el generador recibiría otro.
import { componerPrompt, ESTILOS, PLANTILLAS } from '@pyme/core/marketing-prompts';
import { generateImage, type ImagenReferencia, type ImageResult } from '../lib/api';
import Icon from './Icon';

/**
 * Taller de imagen.
 *
 * Se elige el tipo de pieza (nuevo producto, promoción, anuncio o una idea
 * propia), se completan dos o tres campos, se elige un estilo y se adjuntan la
 * foto del producto y el logo. El prompt se arma solo y queda a la vista,
 * editable: el dueño ve exactamente qué se le va a pedir al generador.
 *
 * El prompt es útil aunque no haya generador configurado — se copia y se pega
 * donde sea. Por eso el botón de copiar no depende de que la generación ande.
 *
 * Las fotos se achican en el navegador antes de subirlas. Una foto de celular
 * son 4 MB y en base64 crece un tercio más: sin achicar, el pedido rebota por
 * tamaño y el dueño no entiende por qué.
 */

const LADO_MAX = 1024;
const CALIDAD = 0.85;

/** Achica manteniendo proporción y devuelve base64 sin el encabezado `data:`. */
async function prepararFoto(
  file: File,
  rol: 'producto' | 'logo',
): Promise<ImagenReferencia & { previa: string }> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permitió procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // El mime lo decide el rol, no el formato original: el logo va en PNG para
  // conservar la transparencia venga como venga; la foto del producto va en
  // JPEG, que comprime mucho mejor una fotografía.
  const mime = rol === 'logo' ? 'image/png' : 'image/jpeg';
  const dataUri = canvas.toDataURL(mime, CALIDAD);
  return {
    rol,
    mime,
    base64: dataUri.slice(dataUri.indexOf(',') + 1),
    previa: dataUri,
  };
}

function Adjunto({
  rol,
  etiqueta,
  ayuda,
  foto,
  onFoto,
  onError,
}: {
  rol: 'producto' | 'logo';
  etiqueta: string;
  ayuda: string;
  foto: (ImagenReferencia & { previa: string }) | null;
  onFoto: (f: (ImagenReferencia & { previa: string }) | null) => void;
  onError: (m: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  async function elegir(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      onError('Sólo se aceptan imágenes PNG, JPG o WEBP.');
      return;
    }
    try {
      onFoto(await prepararFoto(file, rol));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo leer la imagen.');
    }
  }

  return (
    <div className="rounded-xl bg-black/[0.03] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">{etiqueta}</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-faint)]">{ayuda}</p>
        </div>
        {foto ? (
          <img
            src={foto.previa}
            alt={etiqueta}
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-[var(--color-line)] text-[var(--color-faint)]">
            <Icon name="package" size={16} />
          </span>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0])}
      />

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-full glass-soft px-3 py-1.5 text-[11px] font-semibold"
        >
          {foto ? 'Cambiar' : 'Subir foto'}
        </button>
        {foto && (
          <button
            type="button"
            onClick={() => {
              onFoto(null);
              if (input.current) input.current.value = '';
            }}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-bad)]"
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

export default function TallerImagen() {
  const [seccion, setSeccion] = useState<string>('nuevo-producto');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [estilo, setEstilo] = useState('estudio');
  const [estiloPropio, setEstiloPropio] = useState('');
  const [producto, setProducto] = useState<(ImagenReferencia & { previa: string }) | null>(null);
  const [logo, setLogo] = useState<(ImagenReferencia & { previa: string }) | null>(null);
  const [editado, setEditado] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const actual = PLANTILLAS.find((p) => p.id === seccion);

  const promptArmado = useMemo(() => {
    if (!actual) return '';
    // Un obligatorio vacío se muestra como [campo] en vez de dejar un hueco
    // (": .") en el texto. No puede viajar así: el botón exige completarlo.
    const visibles = Object.fromEntries(
      actual.campos.map((c) => {
        const v = (valores[c.id] ?? '').trim();
        return [c.id, v || (c.obligatorio ? `[${c.etiqueta.toLowerCase()}]` : '')];
      }),
    );
    return componerPrompt({
      plantilla: actual.plantilla,
      valores: visibles,
      estilo: estilo === 'otro' ? estiloPropio : estilo,
      conFotoProducto: Boolean(producto),
      conLogo: Boolean(logo),
    });
  }, [actual, valores, estilo, estiloPropio, producto, logo]);

  // Lo editado a mano manda; si no se tocó, sigue al armado automáticamente.
  const prompt = editado ?? promptArmado;

  const faltantes = (actual?.campos ?? []).filter(
    (c) => c.obligatorio && !(valores[c.id] ?? '').trim(),
  );

  async function generar() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const refs: ImagenReferencia[] = [];
      if (producto) refs.push({ rol: 'producto', mime: producto.mime, base64: producto.base64 });
      if (logo) refs.push({ rol: 'logo', mime: logo.mime, base64: logo.base64 });
      setResult(await generateImage(prompt, refs));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la imagen.');
    } finally {
      setBusy(false);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  return (
    <section className="rounded-[var(--radius-card)] glass p-5">
      <h3 className="text-[15px] font-semibold">Taller de imagen</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
        Elegí qué querés publicar, completá los datos y adjuntá tus fotos. El prompt se arma solo y
        podés editarlo antes de generar.
      </p>

      {/* Qué pieza: es lo primero porque cambia todo lo de abajo. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {PLANTILLAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSeccion(p.id);
              setValores({});
              setEditado(null);
              // La imagen o el error de la pieza anterior no describen a ésta.
              setResult(null);
              setError(null);
            }}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              seccion === p.id
                ? 'bg-[var(--color-accent)] text-white shadow-sm'
                : 'glass-soft text-[var(--color-muted)]'
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {actual && (
        <>
          <p className="mt-2.5 text-[11px] text-[var(--color-faint)]">{actual.proposito}</p>

          <div className="mt-4 space-y-3">
            {actual.campos.map((c) => (
              <label key={c.id} className="block">
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                  {c.etiqueta}
                  {!c.obligatorio && (
                    <span className="ml-1 font-normal text-[var(--color-faint)]">(opcional)</span>
                  )}
                </span>
                <input
                  value={valores[c.id] ?? ''}
                  onChange={(e) => {
                    setValores((v) => ({ ...v, [c.id]: e.target.value }));
                    setEditado(null);
                  }}
                  placeholder={c.ejemplo}
                  maxLength={160}
                  className="mt-1.5 w-full rounded-xl glass-soft px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </label>
            ))}
          </div>
        </>
      )}

      {/* Estilo: desplegable con los más usados, y "otro" abre texto libre. */}
      <div className="mt-4">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--color-muted)]">Estilo visual</span>
          <select
            value={estilo}
            onChange={(e) => {
              setEstilo(e.target.value);
              setEditado(null);
            }}
            className="mt-1.5 w-full rounded-xl glass-soft px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {ESTILOS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
            <option value="otro">Otro — lo escribo yo</option>
          </select>
        </label>

        {estilo === 'otro' && (
          <input
            value={estiloPropio}
            onChange={(e) => {
              setEstiloPropio(e.target.value);
              setEditado(null);
            }}
            placeholder="acuarela sobre papel, colores suaves, trazo suelto"
            maxLength={240}
            className="mt-2 w-full rounded-xl glass-soft px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        )}
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <Adjunto
          rol="producto"
          etiqueta="Foto de tu producto"
          ayuda="El generador la usa como referencia para no inventar otro producto."
          foto={producto}
          onFoto={setProducto}
          onError={setError}
        />
        <Adjunto
          rol="logo"
          etiqueta="Tu logo"
          ayuda="Se coloca chico en una esquina, sin modificarlo."
          foto={logo}
          onFoto={setLogo}
          onError={setError}
        />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--color-muted)]">
            Prompt {editado !== null && <span className="text-[var(--color-accent)]">(editado)</span>}
          </span>
          {editado !== null && (
            <button
              type="button"
              onClick={() => setEditado(null)}
              className="text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
            >
              Volver al automático
            </button>
          )}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setEditado(e.target.value)}
          rows={5}
          className="scroll-slim mt-1.5 w-full resize-y rounded-xl glass-soft px-3.5 py-2.5 font-mono text-[11px] leading-relaxed outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <p className="mt-1.5 text-[11px] text-[var(--color-faint)]">
          Va en inglés a propósito: los generadores rinden bastante mejor así.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void generar()}
          disabled={busy || !prompt.trim() || faltantes.length > 0}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--color-accent-strong)] disabled:opacity-40"
        >
          {busy ? 'Generando…' : 'Generar imagen'}
        </button>
        <button
          type="button"
          onClick={() => void copiar()}
          disabled={!prompt.trim()}
          className="flex items-center gap-1.5 rounded-full glass-soft px-4 py-2 text-xs font-semibold disabled:opacity-40"
        >
          {copiado && <Icon name="check" size={13} className="text-[var(--color-good)]" />}
          {copiado ? 'Copiado' : 'Copiar prompt'}
        </button>
        {faltantes.length > 0 && (
          <span className="text-[11px] text-[var(--color-faint)]">
            Falta completar: {faltantes.map((f) => f.etiqueta.toLowerCase()).join(', ')}.
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[var(--color-bad)]/10 p-3 text-xs text-[var(--color-bad)]">
          <Icon name="warning" size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {result && !result.ok && (
        <p className="mt-3 rounded-xl bg-[var(--color-gold)]/10 p-3 text-xs leading-relaxed text-[var(--color-muted)]">
          {result.motivo}
        </p>
      )}

      {result?.ok && result.dataUri && (
        <figure className="mt-4">
          <img
            src={result.dataUri}
            alt={result.prompt.slice(0, 120)}
            className="w-full max-w-md rounded-[var(--radius-card)]"
          />
          <figcaption className="mt-2 text-[11px] text-[var(--color-faint)]">
            Generada con {result.proveedor}. Revisala antes de publicar.
          </figcaption>
        </figure>
      )}
    </section>
  );
}
