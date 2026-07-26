import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  CustomerSchema,
  ExpenseSchema,
  FxRateSchema,
  ProductSchema,
  SaleSchema,
  type Customer,
  type Expense,
  type FxRate,
  type Product,
  type Sale,
} from '../types.js';
import type { DataSource } from './source.js';

const here = dirname(fileURLToPath(import.meta.url));
/** dist/data/ -> raíz del repo -> data/seed */
const DEFAULT_SEED_DIR = resolve(here, '../../../../data/seed');

/**
 * Fuente de datos de desarrollo: lee los JSON de `data/seed/`.
 *
 * Solo para local. En producción usamos Postgres vacío + CSV del comercio.
 * La demo comercial opcional se carga con `npm run db:seed`, no por defecto.
 * Ver docs/04-datos.md.
 */
export class SeedDataSource implements DataSource {
  readonly name = 'seed';
  private readonly dir: string;
  private cache = new Map<string, unknown>();

  constructor(dir: string = process.env.SEED_DIR ?? DEFAULT_SEED_DIR) {
    this.dir = dir;
  }

  private async load<T>(file: string, schema: z.ZodType<T>): Promise<T[]> {
    const cached = this.cache.get(file);
    if (cached) return cached as T[];

    const raw = await readFile(join(this.dir, file), 'utf8');
    const parsed = z.array(schema).parse(JSON.parse(raw));
    this.cache.set(file, parsed);
    return parsed;
  }

  products(): Promise<Product[]> {
    return this.load('products.json', ProductSchema);
  }

  sales(): Promise<Sale[]> {
    return this.load('sales.json', SaleSchema);
  }

  customers(): Promise<Customer[]> {
    return this.load('customers.json', CustomerSchema);
  }

  expenses(): Promise<Expense[]> {
    return this.load('expenses.json', ExpenseSchema);
  }

  async fxHistory(): Promise<FxRate[]> {
    const rates = await this.load('fx.json', FxRateSchema);
    return [...rates].sort((a, b) => a.date.localeCompare(b.date));
  }
}
