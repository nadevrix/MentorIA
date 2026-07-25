#!/usr/bin/env node
/**
 * Genera los datos semilla en data/seed/ con fechas relativas a HOY,
 * para que la demo siempre muestre "últimos 30 días" con datos vivos.
 *
 *   node data/generate.mjs
 *
 * Es determinista (PRNG con semilla fija): dos corridas el mismo día
 * producen exactamente el mismo dataset.
 *
 * Negocio modelado: "Importadora Ñuflo" — electrónica y accesorios en
 * Santa Cruz de la Sierra. Compra en dólares, vende en bolivianos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'seed');
mkdirSync(OUT, { recursive: true });

let seed = 20260725;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const intBetween = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const round2 = (n) => Math.round(n * 100) / 100;

const TODAY = new Date();
const iso = (daysBack) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
};

// --- Tipo de cambio: oficial fijo, paralelo con tendencia alcista ---------
const OFFICIAL = 6.96;
const fx = [];
for (let i = 180; i >= 0; i -= 3) {
  const t = (180 - i) / 180;
  const parallel = round2(11.4 + t * 3.3 + (rnd() - 0.5) * 0.25);
  fx.push({ date: iso(i), official: OFFICIAL, parallel, source: 'promedio mercado paralelo (dato de referencia)' });
}

const currentParallel = fx.at(-1).parallel;

// --- Productos ------------------------------------------------------------
const catalog = [
  ['Audífonos Bluetooth TWS', 'audio', 11, true, 45, 10.9],
  ['Parlante portátil 20W', 'audio', 26, true, 30, 11.2],
  ['Cargador rápido 65W USB-C', 'accesorios', 9, true, 60, 10.6],
  ['Cable USB-C trenzado 2m', 'accesorios', 2.4, true, 140, 10.4],
  ['Power bank 20.000 mAh', 'accesorios', 17, true, 25, 12.9],
  ['Mouse inalámbrico ergonómico', 'computo', 8.5, true, 40, 11.0],
  ['Teclado mecánico compacto', 'computo', 34, true, 12, 13.4],
  ['Webcam 1080p', 'computo', 21, true, 8, 13.1],
  ['Soporte de laptop aluminio', 'computo', 13, true, 18, 12.7],
  ['Funda para celular (varios)', 'accesorios', 1.8, true, 200, 10.3],
  ['Protector de pantalla vidrio', 'accesorios', 0.9, true, 260, 10.3],
  ['Reloj inteligente serie 8', 'wearables', 41, true, 10, 13.8],
  ['Bolsa de regalo impresa', 'insumos', 0.35, false, 400, OFFICIAL],
  ['Etiquetas térmicas rollo', 'insumos', 4.2, false, 30, OFFICIAL],
];

const products = catalog.map(([name, category, costUsd, imported, stock, purchaseFxRate], i) => {
  // Precio fijado cuando el dólar estaba en purchaseFxRate, con margen ~32%.
  const costAtPurchase = costUsd * purchaseFxRate;
  const priceBob = Math.round((costAtPurchase / (1 - 0.32)) / 5) * 5;
  return {
    id: `prod-${String(i + 1).padStart(3, '0')}`,
    sku: `NUF-${String(i + 1).padStart(4, '0')}`,
    name,
    category,
    costUsd,
    purchaseFxRate,
    priceBob,
    stock,
    reorderPoint: Math.max(3, Math.round(stock * 0.25)),
    imported,
    supplier: imported ? pick(['Importadora Iquique', 'Shenzhen Direct', 'Proveedor Arica']) : 'Proveedor local SCZ',
  };
});

// Tres productos quedan por debajo del punto de reorden: el Agente de
// Inventario tiene que detectarlos y cruzarlos con su rotación.
for (const idx of [1, 7, 11]) {
  const p = products[idx];
  p.stock = Math.max(1, p.reorderPoint - 2);
}

// --- Clientes -------------------------------------------------------------
const names = [
  'Multitienda La Ramada', 'Celulares Don Beto', 'Tecno Equipetrol', 'Juana Vargas',
  'Marco Antonio Suárez', 'Kiosko Universitario', 'Distribuidora Plan 3000',
  'Ana Claros', 'Import Center Norte', 'Rodrigo Áñez', 'Café Los Tajibos',
  'Papelería El Trompillo',
];
const customers = names.map((name, i) => {
  const lastBack = intBetween(0, 95);
  const purchaseCount = intBetween(1, 24);
  const segment = purchaseCount > 12 ? 'mayorista' : purchaseCount > 5 ? 'corporativo' : 'minorista';
  return {
    id: `cli-${String(i + 1).padStart(3, '0')}`,
    name,
    phone: `+591 7${intBetween(1000000, 9999999)}`,
    segment,
    firstPurchaseDate: iso(intBetween(120, 400)),
    lastPurchaseDate: iso(lastBack),
    totalSpentBob: round2(purchaseCount * intBetween(180, 1400)),
    purchaseCount,
  };
});

// --- Ventas ---------------------------------------------------------------
const channels = ['tienda', 'whatsapp', 'facebook', 'tiktok', 'mayoreo'];
const sales = [];
let saleN = 0;
for (let back = 120; back >= 0; back--) {
  // Menos ventas los domingos, más en los últimos 30 días (negocio creciendo).
  const dow = new Date(iso(back)).getUTCDay();
  const base = dow === 0 ? 0 : back < 30 ? 4 : 3;
  const count = Math.max(0, base + intBetween(-2, 2));

  for (let k = 0; k < count; k++) {
    const lineCount = intBetween(1, 3);
    const items = [];
    for (let l = 0; l < lineCount; l++) {
      const p = pick(products);
      if (items.some((it) => it.productId === p.id)) continue;
      items.push({ productId: p.id, quantity: intBetween(1, 4), unitPriceBob: p.priceBob });
    }
    if (!items.length) continue;

    const totalBob = round2(items.reduce((s, it) => s + it.quantity * it.unitPriceBob, 0));
    sales.push({
      id: `vta-${String(++saleN).padStart(4, '0')}`,
      date: iso(back),
      customerId: rnd() > 0.45 ? pick(customers).id : null,
      items,
      totalBob,
      channel: pick(channels),
    });
  }
}

// --- Gastos ---------------------------------------------------------------
const expenses = [];
let expN = 0;
const addExpense = (e) => expenses.push({ id: `gto-${String(++expN).padStart(4, '0')}`, ...e });

for (let m = 0; m < 4; m++) {
  const back = m * 30 + 5;
  addExpense({ date: iso(back), category: 'alquiler', description: 'Alquiler local Av. Cristo Redentor', amountBob: 4500, dueDate: null, paid: true });
  addExpense({ date: iso(back), category: 'sueldos', description: 'Planilla (2 empleados)', amountBob: 6400, dueDate: null, paid: true });
  addExpense({ date: iso(back + 2), category: 'servicios', description: 'Luz, agua e internet', amountBob: round2(680 + rnd() * 200), dueDate: null, paid: true });
  addExpense({ date: iso(back + 8), category: 'marketing', description: 'Pauta en Facebook e Instagram', amountBob: round2(400 + rnd() * 500), dueDate: null, paid: true });
}
addExpense({ date: iso(20), category: 'mercaderia', description: 'Lote importado desde Iquique', amountBob: 38500, dueDate: null, paid: true });

// Cuentas por pagar pendientes (una ya vencida: el agente debe detectarla).
addExpense({ date: iso(12), category: 'mercaderia', description: 'Saldo proveedor Shenzhen Direct', amountBob: 14200, dueDate: iso(-3), paid: false });
addExpense({ date: iso(10), category: 'impuestos', description: 'IVA/IT del mes', amountBob: 3120, dueDate: iso(-5), paid: false });
addExpense({ date: iso(25), category: 'servicios', description: 'Factura de energía eléctrica', amountBob: 742, dueDate: iso(2), paid: false });

const files = {
  'products.json': products,
  'customers.json': customers,
  'sales.json': sales,
  'expenses.json': expenses,
  'fx.json': fx,
};

for (const [file, contents] of Object.entries(files)) {
  writeFileSync(join(OUT, file), `${JSON.stringify(contents, null, 2)}\n`);
  console.log(`✓ ${file} (${contents.length} registros)`);
}
console.log(`\nDólar paralelo actual del dataset: ${currentParallel} Bs`);
