import { z } from 'zod';
import {
  CustomerSchema,
  ExpenseSchema,
  ProductSchema,
  SaleSchema,
  type Customer,
  type Expense,
  type FxRate,
  type Product,
  type Sale,
} from '../types.js';
import { mapRows, parseCsv, type Entity } from './csv.js';
import type { DataSource } from './source.js';

/**
 * Fuente que superpone los datos del comercio sobre los de ejemplo.
 *
 * El punto de extensión sancionado: implementa DataSource y se enchufa en
 * createContext(), sin tocar ninguna herramienta ni ningún prompt.
 *
 * La superposición es por entidad, y eso es deliberado: un comercio casi nunca
 * puede exportar las cuatro cosas de una. Si sube sólo el catálogo, sus
 * productos conviven con las ventas de ejemplo y el análisis cambiario ya sirve.
 * Mezclar datos reales con ejemplo es explícito y visible en la interfaz — lo
 * inaceptable sería que el usuario no supiera cuál está mirando.
 *
 * En memoria: se pierde al reiniciar el servidor. Persistir es el paso siguiente.
 */

const SCHEMAS = {
  products: ProductSchema,
  sales: SaleSchema,
  customers: CustomerSchema,
  expenses: ExpenseSchema,
} as const;

export interface ImportReport {
  entidad: Entity;
  /** Filas que entraron al sistema. */
  importadas: number;
  /** Filas leídas del archivo, incluidas las que fallaron. */
  leidas: number;
  rechazadas: { fila: number; motivo: string }[];
  /** Cabeceras detectadas, para poder explicar un mapeo fallido. */
  columnas: string[];
}

export interface OverlayStatus {
  entidad: Entity;
  origen: 'propio' | 'ejemplo';
  filas: number;
  cargadoEn: string | null;
}

export class OverlayDataSource implements DataSource {
  readonly name = 'overlay';
  private readonly rows = new Map<Entity, unknown[]>();
  private readonly loadedAt = new Map<Entity, string>();

  constructor(private readonly base: DataSource) {}

  /**
   * Importa un CSV. Las filas inválidas no abortan la importación: se devuelven
   * con su número de fila y su motivo, porque un catálogo grande casi siempre
   * trae dos o tres filas sucias y perder las 800 buenas por eso es absurdo.
   */
  importCsv(entity: Entity, csv: string): ImportReport {
    const raw = parseCsv(csv);
    const { ok, errores, columnas } = mapRows(entity, raw);
    const schema = SCHEMAS[entity] as z.ZodType<unknown>;

    const valid: unknown[] = [];
    ok.forEach((row, i) => {
      const parsed = schema.safeParse(row);
      if (parsed.success) valid.push(parsed.data);
      else {
        const issue = parsed.error.issues[0];
        errores.push({
          fila: i + 2,
          motivo: issue ? `${issue.path.join('.') || 'fila'}: ${issue.message}` : 'fila inválida',
        });
      }
    });

    if (valid.length > 0) {
      this.rows.set(entity, valid);
      this.loadedAt.set(entity, new Date().toISOString());
    }

    return {
      entidad: entity,
      importadas: valid.length,
      leidas: raw.length,
      rechazadas: errores.slice(0, 25),
      columnas,
    };
  }

  /** Vuelve a los datos de ejemplo. */
  reset(entity?: Entity): void {
    if (entity) {
      this.rows.delete(entity);
      this.loadedAt.delete(entity);
    } else {
      this.rows.clear();
      this.loadedAt.clear();
    }
  }

  async status(): Promise<OverlayStatus[]> {
    const entidades: Entity[] = ['products', 'sales', 'customers', 'expenses'];
    const base = await Promise.all([
      this.base.products(),
      this.base.sales(),
      this.base.customers(),
      this.base.expenses(),
    ]);

    return entidades.map((entidad, i) => {
      const propio = this.rows.get(entidad);
      return {
        entidad,
        origen: propio ? 'propio' : 'ejemplo',
        filas: propio ? propio.length : (base[i]?.length ?? 0),
        cargadoEn: this.loadedAt.get(entidad) ?? null,
      };
    });
  }

  async products(): Promise<Product[]> {
    return (this.rows.get('products') as Product[]) ?? this.base.products();
  }
  async sales(): Promise<Sale[]> {
    return (this.rows.get('sales') as Sale[]) ?? this.base.sales();
  }
  async customers(): Promise<Customer[]> {
    return (this.rows.get('customers') as Customer[]) ?? this.base.customers();
  }
  async expenses(): Promise<Expense[]> {
    return (this.rows.get('expenses') as Expense[]) ?? this.base.expenses();
  }
  fxHistory(): Promise<FxRate[]> {
    // El tipo de cambio no lo carga el comercio: es un dato de mercado.
    return this.base.fxHistory();
  }
}
