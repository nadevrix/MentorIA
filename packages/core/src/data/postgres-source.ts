import pg from 'pg';
import type {
  Customer,
  Expense,
  FxRate,
  Product,
  Sale,
  SaleItem,
} from '../types.js';
import type { Entity } from './csv.js';
import type { DataSource } from './source.js';

/**
 * Fuente de datos sobre PostgreSQL (Render, Neon u otro).
 *
 * Es el punto de extensión que el proyecto ya tenía previsto: implementa
 * DataSource y se enchufa en createContext(). Ninguna herramienta, ningún
 * prompt y ninguna parte del frontend se entera del cambio.
 *
 * Dos decisiones que importan:
 *
 *  - `numeric` de Postgres llega como string al driver, porque no entra en un
 *    double sin perder precisión. Acá se convierte a number en el borde, que es
 *    donde tiene que pasar: adentro el dominio trabaja con números y punto.
 *
 *  - La caché guarda la PROMESA, no el valor resuelto. El panel corre siete
 *    herramientas en paralelo y todas piden productos y ventas casi al mismo
 *    tiempo: si se cacheara el valor, ninguna encontraría nada hasta que la
 *    primera terminara, y saldrían decenas de consultas simultáneas que agotan
 *    el pool. Guardando la promesa, la primera consulta la comparten todas.
 *    El TTL es corto para que una importación se vea casi enseguida.
 *
 * Las importaciones CSV escriben acá (replace/clear) para que sobrevivan a
 * reinicios del Web Service.
 */

const { Pool } = pg;

/** Milisegundos que vive la caché. Corto: prioriza frescura sobre ahorro. */
const TTL_MS = 5_000;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Postgres devuelve `date` como Date; el dominio usa ISO corto. */
function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? '').slice(0, 10);
}

export class PostgresDataSource implements DataSource {
  readonly name = 'postgres';
  private readonly pool: pg.Pool;
  private readonly cache = new Map<string, { at: number; promise: Promise<unknown> }>();

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      // Neon suspende la base cuando no se usa; despertarla puede tardar unos
      // segundos, y 10s no alcanzaba en frío.
      connectionTimeoutMillis: 30_000,
    });
  }

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;

    const promise = load().catch((err: unknown) => {
      // Un fallo no se cachea: si no se desaloja, el error queda pegado hasta
      // que expire el TTL y todos los pedidos siguientes fallan sin intentar.
      if (this.cache.get(key)?.promise === promise) this.cache.delete(key);
      throw err;
    });

    this.cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  /** Invalida la caché. Se llama después de escribir. */
  invalidate(): void {
    this.cache.clear();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  products(): Promise<Product[]> {
    return this.cached('products', async () => {
      const { rows } = await this.pool.query(
        `SELECT id, sku, name, category, cost_usd, purchase_fx_rate,
                price_bob, stock, reorder_point, imported, supplier
           FROM products`,
      );
      return rows.map((r): Product => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        costUsd: num(r.cost_usd),
        purchaseFxRate: num(r.purchase_fx_rate) || 1,
        priceBob: num(r.price_bob),
        stock: Math.round(num(r.stock)),
        reorderPoint: Math.round(num(r.reorder_point)),
        imported: Boolean(r.imported),
        supplier: r.supplier ?? undefined,
      }));
    });
  }

  sales(): Promise<Sale[]> {
    return this.cached('sales', async () => {
      // Dos consultas y un ensamblado en memoria, no un JOIN: con el JOIN habría
      // que deduplicar la cabecera por cada ítem, y son volúmenes chicos.
      const [ventas, items] = await Promise.all([
        this.pool.query(`SELECT id, date, customer_id, total_bob, channel FROM sales`),
        this.pool.query(
          `SELECT sale_id, product_id, quantity, unit_price_bob FROM sale_items`,
        ),
      ]);

      const porVenta = new Map<string, SaleItem[]>();
      for (const r of items.rows) {
        const lista = porVenta.get(r.sale_id) ?? [];
        lista.push({
          productId: r.product_id,
          quantity: Math.round(num(r.quantity)),
          unitPriceBob: num(r.unit_price_bob),
        });
        porVenta.set(r.sale_id, lista);
      }

      return ventas.rows.map((r): Sale => ({
        id: r.id,
        date: iso(r.date),
        customerId: r.customer_id ?? null,
        items: porVenta.get(r.id) ?? [],
        totalBob: num(r.total_bob),
        channel: r.channel,
      }));
    });
  }

  customers(): Promise<Customer[]> {
    return this.cached('customers', async () => {
      const { rows } = await this.pool.query(
        `SELECT id, name, phone, segment, first_purchase_date,
                last_purchase_date, total_spent_bob, purchase_count
           FROM customers`,
      );
      return rows.map((r): Customer => ({
        id: r.id,
        name: r.name,
        phone: r.phone ?? undefined,
        segment: r.segment,
        firstPurchaseDate: iso(r.first_purchase_date),
        lastPurchaseDate: iso(r.last_purchase_date),
        totalSpentBob: num(r.total_spent_bob),
        purchaseCount: Math.round(num(r.purchase_count)),
      }));
    });
  }

  expenses(): Promise<Expense[]> {
    return this.cached('expenses', async () => {
      const { rows } = await this.pool.query(
        `SELECT id, date, category, description, amount_bob, due_date, paid FROM expenses`,
      );
      return rows.map((r): Expense => ({
        id: r.id,
        date: iso(r.date),
        category: r.category,
        description: r.description,
        amountBob: num(r.amount_bob),
        dueDate: r.due_date ? iso(r.due_date) : null,
        paid: Boolean(r.paid),
      }));
    });
  }

  fxHistory(): Promise<FxRate[]> {
    return this.cached('fx', async () => {
      const { rows } = await this.pool.query(
        `SELECT date, rate, regimen, source FROM fx_rates ORDER BY date ASC`,
      );
      return rows.map((r): FxRate => ({
        date: iso(r.date),
        rate: num(r.rate),
        regimen: r.regimen === 'fijo' ? 'fijo' : 'flexible',
        source: r.source,
      }));
    });
  }

  /** Reemplaza por completo una entidad comercial. Transaccional. */
  async replace(entity: Entity, rows: unknown[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.clearWithClient(client, entity);

      if (entity === 'products') {
        for (const raw of rows as Product[]) {
          await client.query(
            `INSERT INTO products (
               id, sku, name, category, cost_usd, purchase_fx_rate,
               price_bob, stock, reorder_point, imported, supplier
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              raw.id,
              raw.sku,
              raw.name,
              raw.category,
              raw.costUsd,
              raw.purchaseFxRate,
              raw.priceBob,
              raw.stock,
              raw.reorderPoint,
              raw.imported,
              raw.supplier ?? null,
            ],
          );
        }
      } else if (entity === 'customers') {
        for (const raw of rows as Customer[]) {
          await client.query(
            `INSERT INTO customers (
               id, name, phone, segment, first_purchase_date,
               last_purchase_date, total_spent_bob, purchase_count
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              raw.id,
              raw.name,
              raw.phone ?? null,
              raw.segment,
              raw.firstPurchaseDate,
              raw.lastPurchaseDate,
              raw.totalSpentBob,
              raw.purchaseCount,
            ],
          );
        }
      } else if (entity === 'expenses') {
        for (const raw of rows as Expense[]) {
          await client.query(
            `INSERT INTO expenses (
               id, date, category, description, amount_bob, due_date, paid
             ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              raw.id,
              raw.date,
              raw.category,
              raw.description,
              raw.amountBob,
              raw.dueDate ?? null,
              raw.paid,
            ],
          );
        }
      } else {
        const idsCliente = new Set(
          (
            await client.query<{ id: string }>(`SELECT id FROM customers`)
          ).rows.map((r) => r.id),
        );
        for (const raw of rows as Sale[]) {
          const customerId =
            raw.customerId && idsCliente.has(raw.customerId) ? raw.customerId : null;
          await client.query(
            `INSERT INTO sales (id, date, customer_id, total_bob, channel)
             VALUES ($1,$2,$3,$4,$5)`,
            [raw.id, raw.date, customerId, raw.totalBob, raw.channel],
          );
          for (const item of raw.items) {
            await client.query(
              `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_bob)
               VALUES ($1,$2,$3,$4)`,
              [raw.id, item.productId, item.quantity, item.unitPriceBob],
            );
          }
        }
      }

      await client.query('COMMIT');
      this.invalidate();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Vacía una entidad comercial (o las cuatro). No toca fx_rates. */
  async clear(entity?: Entity): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (entity) await this.clearWithClient(client, entity);
      else {
        await client.query('TRUNCATE sale_items, sales, expenses, customers, products');
      }
      await client.query('COMMIT');
      this.invalidate();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async clearWithClient(client: pg.PoolClient, entity: Entity): Promise<void> {
    if (entity === 'sales') {
      await client.query('DELETE FROM sale_items');
      await client.query('DELETE FROM sales');
      return;
    }
    if (entity === 'customers') {
      // Conservar ventas históricas aunque se borre el cliente.
      await client.query('UPDATE sales SET customer_id = NULL');
      await client.query('DELETE FROM customers');
      return;
    }
    if (entity === 'products') {
      await client.query('DELETE FROM products');
      return;
    }
    await client.query('DELETE FROM expenses');
  }
}
