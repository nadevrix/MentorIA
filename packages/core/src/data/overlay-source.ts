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
import { PostgresDataSource } from './postgres-source.js';
import type { DataSource } from './source.js';

/**
 * Capa de importación CSV sobre la fuente base.
 *
 * Con Postgres: el CSV se escribe en la base y sobrevive reinicios.
 * Con seed (dev local): el CSV vive en memoria del proceso, como antes.
 *
 * La superposición es por entidad a propósito: un comercio casi nunca exporta
 * las cuatro cosas de una. El estado (`propio` / `ejemplo` / `vacio`) deja
 * explícito qué está mirando el usuario.
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
  origen: 'propio' | 'ejemplo' | 'vacio';
  filas: number;
  cargadoEn: string | null;
  /** true cuando los datos propios viven en Postgres. */
  persistente: boolean;
}

export class OverlayDataSource implements DataSource {
  readonly name = 'overlay';
  private readonly rows = new Map<Entity, unknown[]>();
  private readonly loadedAt = new Map<Entity, string>();

  constructor(private readonly base: DataSource) {}

  /** Qué fuente hay debajo de la superposición. Para /health y depuración. */
  get baseName(): string {
    return this.base.name;
  }

  private get store(): PostgresDataSource | null {
    return this.base instanceof PostgresDataSource ? this.base : null;
  }

  /**
   * Importa un CSV. Las filas inválidas no abortan la importación: se devuelven
   * con su número de fila y su motivo, porque un catálogo grande casi siempre
   * trae dos o tres filas sucias y perder las 800 buenas por eso es absurdo.
   */
  async importCsv(entity: Entity, csv: string): Promise<ImportReport> {
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
      const cuando = new Date().toISOString();
      if (this.store) {
        await this.store.replace(entity, valid);
        // No guardar en RAM: la fuente de verdad es Postgres.
        this.rows.delete(entity);
        this.loadedAt.set(entity, cuando);
      } else {
        this.rows.set(entity, valid);
        this.loadedAt.set(entity, cuando);
      }
    }

    return {
      entidad: entity,
      importadas: valid.length,
      leidas: raw.length,
      rechazadas: errores.slice(0, 25),
      columnas,
    };
  }

  /** Vacía la entidad (Postgres) o vuelve a los datos de ejemplo (seed). */
  async reset(entity?: Entity): Promise<void> {
    if (this.store) {
      await this.store.clear(entity);
      if (entity) this.loadedAt.delete(entity);
      else this.loadedAt.clear();
      return;
    }

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
    const persistente = this.store !== null;

    return entidades.map((entidad, i) => {
      const propioMemoria = this.rows.get(entidad);
      const filasBase = base[i]?.length ?? 0;

      if (persistente) {
        return {
          entidad,
          origen: filasBase > 0 ? ('propio' as const) : ('vacio' as const),
          filas: filasBase,
          cargadoEn: this.loadedAt.get(entidad) ?? null,
          persistente,
        };
      }

      if (propioMemoria) {
        return {
          entidad,
          origen: 'propio' as const,
          filas: propioMemoria.length,
          cargadoEn: this.loadedAt.get(entidad) ?? null,
          persistente,
        };
      }

      return {
        entidad,
        origen: filasBase > 0 ? ('ejemplo' as const) : ('vacio' as const),
        filas: filasBase,
        cargadoEn: null,
        persistente,
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
