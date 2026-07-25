/**
 * Trae el catálogo de formularios del Servicio de Impuestos Nacionales.
 *
 *   node data/fetch-formularios.mjs
 *
 * Fuente: la página oficial de formularios del SIN, leída por la API REST de
 * WordPress en vez de raspar el HTML de la página completa. Es el mismo
 * contenido pero sin el cromo del sitio, así que un rediseño del portal no
 * rompe el parseo — sólo lo rompería un cambio en el contenido mismo.
 *
 * El robots.txt del SIN sólo bloquea /wp-admin/, así que esta lectura está
 * permitida. Es información pública y se consulta una vez, no en cada request.
 *
 * Si la fuente falla, no toca el archivo existente: una demo no se cae porque
 * el portal del SIN esté caído.
 */

import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'seed', 'formularios.json');
const API = 'https://www.impuestos.gob.bo/wp-json/wp/v2/pages/23235';
const FUENTE = 'https://www.impuestos.gob.bo/index.php/formularios/';

const limpiar = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();

/** Extrae el campo que sigue a una etiqueta en negrita ("Grava:", "Alcance:"). */
function campo(html, etiqueta) {
  const re = new RegExp(`<strong>\\s*${etiqueta}\\s*:?\\s*</strong>([\\s\\S]*?)(?=<strong>|<br\\s*/?>\\s*<br|$)`, 'i');
  const m = re.exec(html);
  return m ? limpiar(m[1]) : null;
}

/**
 * Periodicidad de un formulario: el "Presentación …" que aparece después del
 * enlace. El SIN lo escribe debajo del formulario al que aplica.
 */
function periodicidadDespuesDe(html, indice) {
  const resto = html.slice(indice);
  const m = /<strong>\s*Presentaci[óo]n\s+([^<]+?)\s*<\/strong>/i.exec(resto);
  return m ? limpiar(m[1]).toLowerCase() : null;
}

function parsearTarjeta(bloque) {
  const tituloM = /<h5[^>]*>([\s\S]*?)<\/h5>/i.exec(bloque);
  if (!tituloM) return null;
  const impuesto = limpiar(tituloM[1]);
  if (!impuesto) return null;

  const formularios = [];
  const vistos = new Set();

  // Cada enlace cuyo texto empieza con "Form" o "Boleta" es un documento.
  const reEnlace = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of bloque.matchAll(reEnlace)) {
    const url = m[1];
    const texto = limpiar(m[2]);
    if (!texto) continue;

    const numM = /\b(?:form(?:ulario)?|boleta(?: de pago)?)\.?\s*-?\s*(\d{3,4})\b/i.exec(texto);
    if (!numM) continue;

    const numero = numM[1];
    // Un mismo formulario aparece varias veces (resumido, extendido, tutorial):
    // se queda la primera aparición, que es la versión principal.
    const clave = `${numero}|${texto}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const versionM = /\bV(\d+)\b/i.exec(texto);
    formularios.push({
      numero,
      nombre: texto,
      version: versionM ? `V${versionM[1]}` : null,
      esBoleta: /boleta/i.test(texto),
      periodicidad: periodicidadDespuesDe(bloque, m.index + m[0].length),
      url: url.startsWith('http') ? url : new URL(url, 'https://www.impuestos.gob.bo').href,
      // Los tutoriales en YouTube no son el formulario; se marcan para no confundirlos.
      esTutorial: /youtube\.com|youtu\.be/i.test(url) || /tutorial/i.test(texto),
    });
  }

  return {
    impuesto,
    grava: campo(bloque, 'Grava'),
    alcance: campo(bloque, 'Alcance'),
    formularios: formularios.filter((f) => !f.esTutorial),
  };
}

async function main() {
  console.log(`[sin] consultando ${API}`);
  const res = await fetch(API, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MentorIA/1.0)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`la fuente respondió ${res.status}`);

  const html = (await res.json()).content?.rendered ?? '';
  if (!html) throw new Error('la página no trajo contenido');

  // Cada impuesto es una tarjeta; se corta por el título de la siguiente.
  const bloques = html.split(/(?=<h5[^>]*class="rectangular-card-title")/i).slice(1);
  const impuestos = bloques.map(parsearTarjeta).filter((x) => x && x.formularios.length > 0);

  if (impuestos.length === 0) throw new Error('no se reconoció ningún impuesto: cambió la estructura de la página');

  const total = impuestos.reduce((n, i) => n + i.formularios.length, 0);
  const salida = {
    fuente: FUENTE,
    obtenidoEn: new Date().toISOString(),
    nota:
      'Catálogo informativo publicado por el SIN. Para fines legales hay que remitirse a las ' +
      'disposiciones oficiales. Las versiones de formulario cambian por resolución.',
    impuestos,
  };

  await writeFile(OUT, `${JSON.stringify(salida, null, 2)}\n`, 'utf8');

  console.log(`[sin] ${impuestos.length} impuestos · ${total} formularios → data/seed/formularios.json`);
  for (const i of impuestos) {
    console.log(`  ${i.impuesto.padEnd(28)} ${i.formularios.map((f) => f.numero).join(', ')}`);
  }
}

main().catch(async (err) => {
  console.error(`[sin] falló: ${err.message}`);
  try {
    const actual = JSON.parse(await readFile(OUT, 'utf8'));
    console.error(`[sin] se conserva el archivo existente (${actual.impuestos.length} impuestos).`);
  } catch {
    console.error('[sin] y no hay archivo previo.');
  }
  process.exitCode = 1;
});
