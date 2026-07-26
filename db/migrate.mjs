/**
 * Aplica el esquema de Postgres. Por defecto deja el negocio vacío.
 *
 *   node --env-file=.env db/migrate.mjs              # esquema + FX de mercado si falta
 *   node --env-file=.env db/migrate.mjs --seed        # además carga demo comercial
 *   node --env-file=.env db/migrate.mjs --reset       # vacía tablas del negocio
 *   node --env-file=.env db/migrate.mjs --reset --seed
 *
 * El histórico de tipo de cambio NO es mock del comercio: es dato de mercado
 * versionado en `data/seed/fx.json` y se carga solo si `fx_rates` está vacío,
 * para que el fallback del proveedor en vivo no se quede sin respaldo.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(HERE, '..', 'data', 'seed');
const RESET = process.argv.includes('--reset');
const SEED = process.argv.includes('--seed');

async function json(file) {
  return JSON.parse(await readFile(join(SEED_DIR, file), 'utf8'));
}

/** Inserta en lotes: un INSERT por fila contra Postgres remoto es lentísimo. */
async function insertBatch(client, table, columns, rows, toValues) {
  if (rows.length === 0) return 0;
  const CHUNK = 200;
  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = [];
    const tuples = slice.map((row) => {
      const vals = toValues(row);
      const marks = vals.map((_, j) => `$${values.length + j + 1}`);
      values.push(...vals);
      return `(${marks.join(',')})`;
    });

    const { rowCount } = await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}
       ON CONFLICT DO NOTHING`,
      values,
    );
    total += rowCount ?? 0;
  }
  return total;
}

async function ensureFx(client) {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM fx_rates');
  if (rows[0].n > 0) {
    console.log(`[db] fx_rates ya tiene ${rows[0].n} filas; se conserva.`);
    return 0;
  }

  const fx = await json('fx.json');
  const nFx = await insertBatch(
    client,
    'fx_rates',
    ['date', 'rate', 'regimen', 'source'],
    fx,
    (r) => [r.date, r.rate, r.regimen ?? 'flexible', r.source ?? 'bcb'],
  );
  console.log(`[db] histórico de mercado: ${nFx} tipos de cambio`);
  return nFx;
}

async function seedCommercial(client) {
  const { rows: yaHay } = await client.query('SELECT count(*)::int AS n FROM products');
  if (yaHay[0].n > 0 && !RESET) {
    console.log(
      `[db] ya hay ${yaHay[0].n} productos; no se carga demo. Usá --reset --seed para recargar.`,
    );
    return;
  }

  const [products, sales, customers, expenses] = await Promise.all([
    json('products.json'),
    json('sales.json'),
    json('customers.json'),
    json('expenses.json'),
  ]);

  // Clientes antes que ventas: sales.customer_id los referencia.
  const nCust = await insertBatch(
    client,
    'customers',
    [
      'id',
      'name',
      'phone',
      'segment',
      'first_purchase_date',
      'last_purchase_date',
      'total_spent_bob',
      'purchase_count',
    ],
    customers,
    (c) => [
      c.id,
      c.name,
      c.phone ?? null,
      c.segment,
      c.firstPurchaseDate,
      c.lastPurchaseDate,
      c.totalSpentBob,
      c.purchaseCount,
    ],
  );

  const nProd = await insertBatch(
    client,
    'products',
    [
      'id',
      'sku',
      'name',
      'category',
      'cost_usd',
      'purchase_fx_rate',
      'price_bob',
      'stock',
      'reorder_point',
      'imported',
      'supplier',
    ],
    products,
    (p) => [
      p.id,
      p.sku,
      p.name,
      p.category,
      p.costUsd,
      p.purchaseFxRate,
      p.priceBob,
      p.stock,
      p.reorderPoint,
      p.imported,
      p.supplier ?? null,
    ],
  );

  const idsCliente = new Set(customers.map((c) => c.id));
  const nSales = await insertBatch(
    client,
    'sales',
    ['id', 'date', 'customer_id', 'total_bob', 'channel'],
    sales,
    (s) => [
      s.id,
      s.date,
      s.customerId && idsCliente.has(s.customerId) ? s.customerId : null,
      s.totalBob,
      s.channel,
    ],
  );

  const items = sales.flatMap((s) => s.items.map((i) => ({ ...i, saleId: s.id })));
  const nItems = await insertBatch(
    client,
    'sale_items',
    ['sale_id', 'product_id', 'quantity', 'unit_price_bob'],
    items,
    (i) => [i.saleId, i.productId, i.quantity, i.unitPriceBob],
  );

  const nExp = await insertBatch(
    client,
    'expenses',
    ['id', 'date', 'category', 'description', 'amount_bob', 'due_date', 'paid'],
    expenses,
    (e) => [e.id, e.date, e.category, e.description, e.amountBob, e.dueDate ?? null, e.paid],
  );

  console.log(
    `[db] demo comercial: ${nProd} productos · ${nCust} clientes · ${nSales} ventas ` +
      `(${nItems} ítems) · ${nExp} gastos`,
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('falta DATABASE_URL (¿corriste con --env-file=.env?)');

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    console.log('[db] aplicando esquema…');
    await client.query(await readFile(join(HERE, 'schema.sql'), 'utf8'));

    if (RESET) {
      console.log('[db] --reset: vaciando tablas del negocio (no toca fx_rates)');
      // El orden importa por las claves foráneas.
      await client.query('TRUNCATE sale_items, sales, expenses, customers, products');
    }

    await ensureFx(client);

    if (SEED) {
      await seedCommercial(client);
    } else {
      console.log('[db] negocio vacío listo. Para demo local: npm run db:seed');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[db] falló: ${err.message}`);
  process.exitCode = 1;
});
