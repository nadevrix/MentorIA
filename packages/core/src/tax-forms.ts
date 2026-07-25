import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Catálogo de formularios del SIN.
 *
 * Se guarda como archivo y no en la base porque es dato de referencia: cambia
 * por resolución, no por operación del comercio. Lo actualiza
 * `node data/fetch-formularios.mjs`, que lo trae de la página oficial.
 *
 * Se lee una sola vez y queda en memoria: son ~20 KB que no cambian en toda la
 * vida del proceso.
 */

const here = dirname(fileURLToPath(import.meta.url));
/** dist/ -> raíz del repo -> data/seed */
const RUTA = resolve(here, '../../../data/seed/formularios.json');

export interface FormularioSin {
  numero: string;
  nombre: string;
  version: string | null;
  esBoleta: boolean;
  periodicidad: string | null;
  url: string;
}

export interface ImpuestoSin {
  impuesto: string;
  grava: string | null;
  alcance: string | null;
  formularios: FormularioSin[];
}

export interface CatalogoSin {
  fuente: string;
  obtenidoEn: string;
  nota: string;
  impuestos: ImpuestoSin[];
}

let cache: CatalogoSin | null = null;

export async function taxForms(): Promise<CatalogoSin> {
  if (cache) return cache;
  try {
    const raw = await readFile(process.env.TAX_FORMS_FILE ?? RUTA, 'utf8');
    cache = JSON.parse(raw) as CatalogoSin;
    return cache;
  } catch {
    // Que falte el catálogo no debe tumbar el apartado de impuestos: el cálculo
    // de obligaciones no depende de él.
    return {
      fuente: 'https://www.impuestos.gob.bo/index.php/formularios/',
      obtenidoEn: '',
      nota: 'Catálogo no disponible. Generalo con: node data/fetch-formularios.mjs',
      impuestos: [],
    };
  }
}

/**
 * Los formularios que le tocan a un régimen.
 * En Régimen General son IVA, IT e IUE; el Simplificado paga cuota fija y no
 * declara ninguno de los tres.
 */
export async function formulariosDelRegimen(
  regimen: 'general' | 'simplificado',
): Promise<ImpuestoSin[]> {
  if (regimen !== 'general') return [];
  const cat = await taxForms();
  const propios = new Set(['IVA', 'IT', 'IUE']);
  return cat.impuestos.filter((i) => propios.has(i.impuesto.toUpperCase()));
}
