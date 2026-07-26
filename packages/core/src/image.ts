/**
 * Generación de imágenes.
 *
 * Anthropic no genera imágenes: Claude escribe el prompt, otro proveedor lo
 * convierte en píxeles. Por eso esto vive en su propio módulo y detrás de una
 * variable de entorno — el resto del producto no depende de que exista.
 *
 * Sin `IMAGE_API_KEY` la función no falla: informa que no está configurado y
 * devuelve el prompt para que el usuario lo pegue donde quiera. Esa es la
 * degradación correcta, porque el prompt ya es la mitad del valor.
 */

export type ImageProviderName = 'openai' | 'gemini';

/**
 * Imagen que el comercio adjunta como referencia: la foto de su producto o su
 * logo. Va aparte del prompt porque el prompt la describe pero no la contiene.
 */
export interface ImagenReferencia {
  /** 'producto' | 'logo'. Sólo informativo: el prompt ya dice qué hacer con cada una. */
  rol: string;
  mime: string;
  /** Base64 sin el encabezado `data:`. */
  base64: string;
}

export interface ImageResult {
  ok: boolean;
  /** El prompt usado, siempre presente: es útil aunque no haya imagen. */
  prompt: string;
  /** Imagen en data URI, lista para <img src>. Sólo cuando ok es true. */
  dataUri?: string;
  proveedor?: ImageProviderName;
  /** Por qué no se generó, en lenguaje llano. */
  motivo?: string;
}

export function imageProviderConfigured(): ImageProviderName | null {
  if (!process.env.IMAGE_API_KEY) return null;
  const p = (process.env.IMAGE_PROVIDER ?? 'openai').toLowerCase();
  return p === 'gemini' ? 'gemini' : 'openai';
}

async function generateOpenAI(
  prompt: string,
  key: string,
  referencias: ImagenReferencia[],
  signal?: AbortSignal,
): Promise<ImageResult> {
  const model = process.env.IMAGE_MODEL ?? 'gpt-image-1';
  const size = process.env.IMAGE_SIZE ?? '1024x1024';

  // Con referencias hay que ir a /edits, que es multipart: /generations no
  // acepta imágenes de entrada y las ignoraría en silencio.
  const res = referencias.length
    ? await (async () => {
        const form = new FormData();
        form.append('model', model);
        form.append('prompt', prompt);
        form.append('size', size);
        for (const r of referencias) {
          const bin = Uint8Array.from(atob(r.base64), (ch) => ch.charCodeAt(0));
          form.append('image[]', new Blob([bin], { type: r.mime }), `${r.rol}.png`);
        }
        return fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: form,
          signal,
        });
      })()
    : await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
        signal,
      });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, prompt, motivo: `el proveedor respondió ${res.status}. ${detail.slice(0, 300)}` };
  }

  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const first = json.data?.[0];
  if (first?.b64_json) {
    return { ok: true, prompt, proveedor: 'openai', dataUri: `data:image/png;base64,${first.b64_json}` };
  }
  if (first?.url) {
    return { ok: true, prompt, proveedor: 'openai', dataUri: first.url };
  }
  return { ok: false, prompt, motivo: 'el proveedor no devolvió ninguna imagen' };
}

async function generateGemini(
  prompt: string,
  key: string,
  referencias: ImagenReferencia[],
  signal?: AbortSignal,
): Promise<ImageResult> {
  const model = process.env.IMAGE_MODEL ?? 'gemini-2.5-flash-image';
  // Las referencias van ANTES del texto: el modelo las toma como contexto de lo
  // que tiene que respetar, no como algo que se le menciona al pasar.
  const parts = [
    ...referencias.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })),
    { text: prompt },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal,
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, prompt, motivo: `el proveedor respondió ${res.status}. ${detail.slice(0, 300)}` };
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    return { ok: false, prompt, motivo: 'el proveedor no devolvió ninguna imagen' };
  }
  return {
    ok: true,
    prompt,
    proveedor: 'gemini',
    dataUri: `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`,
  };
}

export async function generateImage(
  prompt: string,
  referencias: ImagenReferencia[] = [],
  signal?: AbortSignal,
): Promise<ImageResult> {
  const clean = prompt.trim();
  if (!clean) return { ok: false, prompt, motivo: 'el prompt está vacío' };

  const provider = imageProviderConfigured();
  const key = process.env.IMAGE_API_KEY;
  if (!provider || !key) {
    return {
      ok: false,
      prompt: clean,
      motivo:
        'no hay generador de imágenes configurado. Pegá el prompt en el generador que uses, ' +
        'o definí IMAGE_API_KEY (y opcionalmente IMAGE_PROVIDER: openai | gemini) en el servidor.',
    };
  }

  try {
    return provider === 'gemini'
      ? await generateGemini(clean, key, referencias, signal)
      : await generateOpenAI(clean, key, referencias, signal);
  } catch (error) {
    return {
      ok: false,
      prompt: clean,
      motivo: error instanceof Error ? error.message : 'error desconocido al generar la imagen',
    };
  }
}
