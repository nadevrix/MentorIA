/**
 * Lector de CSV y mapeo de columnas.
 *
 * El comercio no exporta con nuestros nombres de campo: exporta lo que le da su
 * sistema, en español, con tildes y mayúsculas al azar. El mapeo acepta los
 * alias más comunes y, cuando no reconoce una columna obligatoria, lo dice con
 * el nombre exacto que vio — un "faltan datos" genérico no le sirve a nadie.
 */

/** Parser de CSV con soporte de comillas y comas dentro del campo. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];

  const keys = header.map((h) => normalize(h));
  return body.map((cells) => {
    const obj: Record<string, string> = {};
    keys.forEach((k, i) => {
      obj[k] = (cells[i] ?? '').trim();
    });
    return obj;
  });
}

/** "Costo $us " → "costo_us" — sin tildes, sin símbolos, comparable. */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Primer alias presente en la fila. */
function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

/** Acepta "1.234,56" y "1,234.56"; devuelve NaN si no hay número. */
function num(v: string | undefined): number {
  if (v === undefined) return NaN;
  const s = v.replace(/[^\d.,-]/g, '');
  if (s === '') return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  // El separador decimal es el que aparece más a la derecha.
  const decimal = lastComma > lastDot ? ',' : '.';
  const cleaned =
    decimal === ','
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  return Number(cleaned);
}

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return /^(1|s[ií]|si|true|verdadero|x)$/i.test(v.trim());
}

/** Fecha en ISO corto; acepta dd/mm/yyyy y yyyy-mm-dd. */
function date(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y!.length === 2 ? `20${y}` : y!;
    return `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  return null;
}

export interface ImportResult<T> {
  ok: T[];
  /** Filas rechazadas, con el motivo. Se le devuelven al usuario para corregir. */
  errores: { fila: number; motivo: string }[];
  /** Cabeceras que se vieron, para poder explicar un mapeo fallido. */
  columnas: string[];
}

export type Entity = 'products' | 'sales' | 'customers' | 'expenses';

const ALIASES = {
  sku: ['sku', 'codigo', 'cod', 'clave', 'id_producto'],
  nombre: ['nombre', 'descripcion', 'producto', 'detalle', 'articulo'],
  categoria: ['categoria', 'rubro', 'linea', 'familia'],
  costoUsd: ['costo_usd', 'costo_us', 'costo_dolares', 'costo_en_usd', 'costo_u', 'costousd', 'costo'],
  tc: ['tipo_de_cambio', 'tipo_cambio', 'tc', 'tc_compra', 'dolar_compra'],
  precio: ['precio', 'precio_venta', 'p_u', 'pu', 'precio_bs', 'precio_unitario'],
  stock: ['stock', 'existencia', 'saldo', 'cantidad', 'inventario'],
  reorden: ['punto_reorden', 'reorden', 'stock_minimo', 'minimo'],
  importado: ['importado', 'es_importado', 'import'],
  proveedor: ['proveedor', 'supplier'],
  fecha: ['fecha', 'date', 'dia'],
  cliente: ['cliente', 'cliente_id', 'id_cliente', 'customer'],
  cantidad: ['cantidad', 'unidades', 'qty', 'cant'],
  total: ['total', 'total_bs', 'importe', 'monto', 'monto_bs'],
  canal: ['canal', 'channel', 'via'],
  telefono: ['telefono', 'celular', 'whatsapp', 'phone'],
  segmento: ['segmento', 'tipo', 'segment'],
  gastado: ['total_gastado', 'gastado', 'total_compras', 'monto_total'],
  compras: ['compras', 'n_compras', 'cantidad_compras', 'purchase_count'],
  primera: ['primera_compra', 'fecha_alta', 'first_purchase'],
  ultima: ['ultima_compra', 'ultima_venta', 'last_purchase'],
  monto: ['monto', 'importe', 'total', 'monto_bs'],
  vence: ['vencimiento', 'vence', 'fecha_vencimiento', 'due_date'],
  pagado: ['pagado', 'paid', 'cancelado'],
};

/**
 * Convierte filas crudas al modelo de dominio.
 *
 * Devuelve las filas buenas y las malas por separado: una fila inválida no debe
 * abortar la importación entera, porque un catálogo de 800 productos casi
 * siempre trae dos o tres filas sucias.
 */
export function mapRows(entity: Entity, rows: Record<string, string>[]): ImportResult<unknown> {
  const columnas = rows[0] ? Object.keys(rows[0]) : [];
  const ok: unknown[] = [];
  const errores: { fila: number; motivo: string }[] = [];
  const push = (i: number, motivo: string) => errores.push({ fila: i + 2, motivo });

  rows.forEach((r, i) => {
    if (entity === 'products') {
      const nombre = pick(r, ALIASES.nombre);
      const precio = num(pick(r, ALIASES.precio));
      if (!nombre) return push(i, 'falta el nombre del producto');
      if (!Number.isFinite(precio)) return push(i, 'precio de venta ausente o no numérico');
      const costoUsd = num(pick(r, ALIASES.costoUsd));
      const tc = num(pick(r, ALIASES.tc));
      ok.push({
        id: pick(r, ALIASES.sku) ?? `p-${i + 1}`,
        sku: pick(r, ALIASES.sku) ?? `SKU-${i + 1}`,
        name: nombre,
        category: pick(r, ALIASES.categoria) ?? 'general',
        costUsd: Number.isFinite(costoUsd) ? costoUsd : 0,
        // Sin tipo de cambio de compra no se puede valuar un producto nacional;
        // 1 deja el costo en Bs tal cual vino, que es el supuesto menos dañino.
        purchaseFxRate: Number.isFinite(tc) && tc > 0 ? tc : 1,
        priceBob: precio,
        stock: Math.max(0, Math.round(num(pick(r, ALIASES.stock)) || 0)),
        reorderPoint: Math.max(0, Math.round(num(pick(r, ALIASES.reorden)) || 0)),
        imported: bool(pick(r, ALIASES.importado), Number.isFinite(costoUsd) && costoUsd > 0),
        supplier: pick(r, ALIASES.proveedor),
      });
    } else if (entity === 'sales') {
      const f = date(pick(r, ALIASES.fecha));
      const total = num(pick(r, ALIASES.total));
      if (!f) return push(i, 'fecha ausente o en formato no reconocido');
      if (!Number.isFinite(total)) return push(i, 'total ausente o no numérico');
      const cantidad = Math.max(1, Math.round(num(pick(r, ALIASES.cantidad)) || 1));
      const productId = pick(r, ALIASES.sku) ?? pick(r, ALIASES.nombre);
      ok.push({
        id: `v-${i + 1}`,
        date: f,
        customerId: pick(r, ALIASES.cliente) ?? null,
        items: productId
          ? [{ productId, quantity: cantidad, unitPriceBob: total / cantidad }]
          : [],
        totalBob: total,
        channel: (pick(r, ALIASES.canal) ?? 'tienda').toLowerCase(),
      });
    } else if (entity === 'customers') {
      const nombre = pick(r, ALIASES.nombre) ?? pick(r, ALIASES.cliente);
      if (!nombre) return push(i, 'falta el nombre del cliente');
      const ultima = date(pick(r, ALIASES.ultima));
      ok.push({
        id: pick(r, ALIASES.cliente) ?? `c-${i + 1}`,
        name: nombre,
        phone: pick(r, ALIASES.telefono),
        segment: (pick(r, ALIASES.segmento) ?? 'minorista').toLowerCase(),
        firstPurchaseDate: date(pick(r, ALIASES.primera)) ?? ultima ?? '2026-01-01',
        lastPurchaseDate: ultima ?? '2026-01-01',
        totalSpentBob: Math.max(0, num(pick(r, ALIASES.gastado)) || 0),
        purchaseCount: Math.max(0, Math.round(num(pick(r, ALIASES.compras)) || 0)),
      });
    } else {
      const f = date(pick(r, ALIASES.fecha));
      const monto = num(pick(r, ALIASES.monto));
      if (!f) return push(i, 'fecha ausente o en formato no reconocido');
      if (!Number.isFinite(monto)) return push(i, 'monto ausente o no numérico');
      ok.push({
        id: `g-${i + 1}`,
        date: f,
        category: (pick(r, ALIASES.categoria) ?? 'otros').toLowerCase(),
        description: pick(r, ALIASES.nombre) ?? 'gasto',
        amountBob: monto,
        dueDate: date(pick(r, ALIASES.vence)),
        paid: bool(pick(r, ALIASES.pagado), true),
      });
    }
  });

  return { ok, errores, columnas };
}
