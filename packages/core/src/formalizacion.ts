import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Formalización de la empresa: qué trámites necesita una PyME boliviana y
 * cuáles ya tiene resueltos.
 *
 * La lista de trámites es dato de referencia y vive en un archivo. El estado
 * (hecho / pendiente / no aplica) es dato del negocio y va a la base.
 *
 * El estado NO pasa por DataSource a propósito: CLAUDE.md marca ese archivo
 * como contrato compartido y cambiarlo rompería el trabajo de los demás. Este
 * store habla con Postgres por su cuenta, y si no hay base guarda en memoria
 * para que la funcionalidad exista igual.
 *
 * ADVERTENCIA que se muestra al usuario: es una lista para no olvidarse un
 * trámite, no asesoría legal. Requisitos y montos cambian por normativa y por
 * municipio.
 */

const here = dirname(fileURLToPath(import.meta.url));
const RUTA = resolve(here, '../../../data/seed/formalizacion.json');

export type EstadoItem = 'pendiente' | 'hecho' | 'no_aplica';

export interface ItemFormalizacion {
  id: string;
  titulo: string;
  entidad: string;
  obligatorio: boolean;
  aplicaA: string[];
  descripcion: string;
  renovacion?: string;
  fuente: string | null;
}

export interface FaseFormalizacion {
  id: string;
  nombre: string;
  descripcion: string;
  items: ItemFormalizacion[];
}

export interface Catalogo {
  nota: string;
  revisadoEn: string;
  fases: FaseFormalizacion[];
}

export interface EstadoGuardado {
  itemId: string;
  estado: EstadoItem;
  nota: string | null;
  vence: string | null;
}

let catalogo: Catalogo | null = null;

export async function catalogoFormalizacion(): Promise<Catalogo> {
  if (catalogo) return catalogo;
  const raw = await readFile(process.env.FORMALIZACION_FILE ?? RUTA, 'utf8');
  catalogo = JSON.parse(raw) as Catalogo;
  return catalogo;
}

/** Guarda el avance. Postgres si hay DATABASE_URL; si no, memoria del proceso. */
export class ComplianceStore {
  private readonly pool: pg.Pool | null;
  private readonly memoria = new Map<string, EstadoGuardado>();
  private listo = false;

  constructor(connectionString = process.env.DATABASE_URL) {
    this.pool = connectionString
      ? new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 30_000 })
      : null;
  }

  get persistente(): boolean {
    return this.pool !== null;
  }

  /** Crea la tabla al primer uso: evita otro paso de migración. */
  private async asegurarTabla(): Promise<void> {
    if (!this.pool || this.listo) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS compliance (
        item_id    text PRIMARY KEY,
        estado     text NOT NULL DEFAULT 'pendiente',
        nota       text,
        vence      date,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    this.listo = true;
  }

  async leer(): Promise<EstadoGuardado[]> {
    if (!this.pool) return [...this.memoria.values()];
    await this.asegurarTabla();
    const { rows } = await this.pool.query(
      `SELECT item_id, estado, nota, vence FROM compliance`,
    );
    return rows.map((r) => ({
      itemId: r.item_id,
      estado: r.estado as EstadoItem,
      nota: r.nota ?? null,
      vence: r.vence ? new Date(r.vence).toISOString().slice(0, 10) : null,
    }));
  }

  async guardar(item: EstadoGuardado): Promise<void> {
    if (!this.pool) {
      this.memoria.set(item.itemId, item);
      return;
    }
    await this.asegurarTabla();
    await this.pool.query(
      `INSERT INTO compliance (item_id, estado, nota, vence, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (item_id) DO UPDATE
         SET estado = EXCLUDED.estado,
             nota = EXCLUDED.nota,
             vence = EXCLUDED.vence,
             updated_at = now()`,
      [item.itemId, item.estado, item.nota, item.vence],
    );
  }
}

export interface ResumenFormalizacion {
  nota: string;
  persistente: boolean;
  /** Obligatorios que aplican y todavía no están hechos. */
  faltantes: { id: string; titulo: string; entidad: string; fase: string }[];
  totalObligatorios: number;
  hechos: number;
  fases: (FaseFormalizacion & {
    items: (ItemFormalizacion & { estado: EstadoItem; nota: string | null; vence: string | null })[];
  })[];
}

/**
 * Combina el catálogo con el avance guardado.
 *
 * `perfil` filtra lo que no corresponde: sin empleados no tiene sentido pedir
 * el registro de empleador, y marcarlo como faltante sería ruido.
 */
export async function resumenFormalizacion(
  store: ComplianceStore,
  perfil: { tipo?: string; conEmpleados?: boolean; rubros?: string[] } = {},
): Promise<ResumenFormalizacion> {
  const [cat, guardado] = await Promise.all([catalogoFormalizacion(), store.leer()]);
  const porId = new Map(guardado.map((g) => [g.itemId, g]));

  const tipo = perfil.tipo ?? 'srl';
  const rubros = new Set(perfil.rubros ?? []);

  const aplica = (item: ItemFormalizacion): boolean => {
    if (item.aplicaA.includes('con_empleados')) return perfil.conEmpleados === true;
    const especificos = item.aplicaA.filter(
      (a) => !['unipersonal', 'srl', 'sa'].includes(a),
    );
    if (especificos.length > 0) return especificos.some((a) => rubros.has(a));
    return item.aplicaA.includes(tipo);
  };

  const faltantes: ResumenFormalizacion['faltantes'] = [];
  let totalObligatorios = 0;
  let hechos = 0;

  const fases = cat.fases.map((f) => ({
    ...f,
    items: f.items.map((i) => {
      const g = porId.get(i.id);
      const corresponde = aplica(i);
      const estado: EstadoItem = g?.estado ?? (corresponde ? 'pendiente' : 'no_aplica');
      // El perfil manda sobre el estado guardado al contar: si alguien marcó el
      // ROE y después dice que no tiene empleados, no puede seguir sumando.
      if (corresponde && i.obligatorio && estado !== 'no_aplica') {
        totalObligatorios++;
        if (estado === 'hecho') hechos++;
        else faltantes.push({ id: i.id, titulo: i.titulo, entidad: i.entidad, fase: f.nombre });
      }
      return { ...i, estado, nota: g?.nota ?? null, vence: g?.vence ?? null };
    }),
  }));

  return {
    nota: cat.nota,
    persistente: store.persistente,
    faltantes,
    totalObligatorios,
    hechos,
    fases,
  };
}
