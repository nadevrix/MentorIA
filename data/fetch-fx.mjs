/**
 * Trae la serie real del tipo de cambio del BCB y la escribe en data/seed/fx.json.
 *
 * Contexto que hace falta para entender el archivo que genera: hasta finales de
 * junio de 2026 Bolivia tenía un tipo oficial intervenido y un paralelo que se
 * movía aparte. Desde el 29/06/2026 el BCB unificó el régimen y publica un solo
 * tipo, que flota. Por eso cada punto lleva `regimen`: 'fijo' para el tramo
 * viejo, 'flexible' para el actual. El quiebre es visible en el gráfico.
 *
 * Uso:  node data/fetch-fx.mjs
 * Si la fuente falla, no toca el archivo existente: una demo no se cae por un
 * scraping caído.
 */

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'seed', 'fx.json');
const SOURCE = 'https://dolarbluebolivia.click/';

/** Extrae un literal de arreglo JS asignado a una const del HTML. */
function extractArray(html, constName) {
  const at = html.indexOf(`${constName}`);
  if (at === -1) return null;
  const start = html.indexOf('[', at);
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function main() {
  console.log(`[fx] consultando ${SOURCE}`);
  const res = await fetch(SOURCE, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MentorIA/1.0)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`la fuente respondió ${res.status}`);
  const html = await res.text();

  const serie = extractArray(html, 'SERIE_OFICIAL_SSR');
  if (!serie?.length) throw new Error('no se encontró SERIE_OFICIAL_SSR en la página');

  const rows = serie
    .filter((r) => r?.d && Number.isFinite(r.sell))
    .map((r) => ({
      date: r.d,
      // Un solo tipo vigente. `sell` es el de venta, que es al que un importador compra.
      rate: Number(r.sell),
      // 'unificado' = régimen flexible actual; 'referencial' = el tramo fijo anterior.
      regimen: r.kind === 'unificado' ? 'flexible' : 'fijo',
      source: 'bcb',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const flexibles = rows.filter((r) => r.regimen === 'flexible');
  const primero = rows[0];
  const ultimo = rows.at(-1);

  await writeFile(OUT, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');

  console.log(`[fx] ${rows.length} puntos escritos en data/seed/fx.json`);
  console.log(`[fx] rango: ${primero.date} (Bs ${primero.rate}) → ${ultimo.date} (Bs ${ultimo.rate})`);
  console.log(`[fx] régimen flexible: ${flexibles.length} puntos desde ${flexibles[0]?.date ?? '—'}`);
  if (flexibles.length >= 2) {
    const a = flexibles[0].rate;
    const b = flexibles.at(-1).rate;
    console.log(`[fx] variación en régimen flexible: ${(((b - a) / a) * 100).toFixed(1)}%`);
  }
}

main().catch(async (err) => {
  console.error(`[fx] falló: ${err.message}`);
  try {
    const actual = JSON.parse(await readFile(OUT, 'utf8'));
    console.error(`[fx] se conserva el archivo existente (${actual.length} puntos). Nada que hacer.`);
  } catch {
    console.error('[fx] y no hay archivo previo: hay que generar los datos a mano.');
  }
  process.exitCode = 1;
});
