import { z } from 'zod';

/**
 * Modelo de dominio de una PyME importadora/comercial boliviana.
 *
 * Convención de moneda, importante para todo el sistema:
 *  - `costUsd`  -> costo de reposición del producto en dólares (lo que paga al proveedor).
 *  - `priceBob` -> precio de venta al público en bolivianos.
 *  - Todo monto en bolivianos lleva sufijo `Bob`; en dólares, `Usd`.
 * El margen real depende del tipo de cambio al que HOY podría reponer, no al que compró.
 */

export const ProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  /** Costo de reposición unitario en USD. */
  costUsd: z.number().nonnegative(),
  /** Tipo de cambio (Bs/USD) al que se compró el lote actual. */
  purchaseFxRate: z.number().positive(),
  /** Precio de venta vigente en Bs. */
  priceBob: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  /** Punto de reorden: por debajo de esto hay que reponer. */
  reorderPoint: z.number().int().nonnegative(),
  /** Si es importado, el costo depende del dólar paralelo. */
  imported: z.boolean(),
  supplier: z.string().optional(),
});
export type Product = z.infer<typeof ProductSchema>;

export const SaleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPriceBob: z.number().nonnegative(),
});
export type SaleItem = z.infer<typeof SaleItemSchema>;

export const SaleSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO 8601 (YYYY-MM-DD)
  customerId: z.string().nullable(),
  items: z.array(SaleItemSchema),
  totalBob: z.number().nonnegative(),
  channel: z.enum(['tienda', 'whatsapp', 'facebook', 'tiktok', 'mayoreo']),
});
export type Sale = z.infer<typeof SaleSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  segment: z.enum(['minorista', 'mayorista', 'corporativo']),
  firstPurchaseDate: z.string(),
  lastPurchaseDate: z.string(),
  totalSpentBob: z.number().nonnegative(),
  purchaseCount: z.number().int().nonnegative(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const ExpenseSchema = z.object({
  id: z.string(),
  date: z.string(),
  category: z.enum(['alquiler', 'sueldos', 'servicios', 'mercaderia', 'impuestos', 'marketing', 'otros']),
  description: z.string(),
  amountBob: z.number().nonnegative(),
  /** Cuentas por pagar: si tiene fecha de vencimiento y no está pagada. */
  dueDate: z.string().nullable().optional(),
  paid: z.boolean(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

/**
 * Régimen cambiario del punto.
 *
 * Hasta el 28/06/2026 Bolivia tenía un tipo oficial intervenido y un paralelo
 * que se movía aparte. Desde el 29/06/2026 el BCB unificó el régimen: hay un
 * solo tipo y flota. Guardamos la marca para que el gráfico muestre el quiebre
 * y para no comparar peras con manzanas al calcular variaciones.
 */
export const RegimenSchema = z.enum(['fijo', 'flexible']);
export type Regimen = z.infer<typeof RegimenSchema>;

export const FxRateSchema = z.object({
  date: z.string(),
  /** Bs por USD vigente. Único tipo desde la unificación. */
  rate: z.number().positive(),
  /* Sin default a propósito: que el dato lo diga explícitamente evita que un
     punto del régimen viejo se cuele marcado como flexible. */
  regimen: RegimenSchema,
  source: z.string(),
});
export type FxRate = z.infer<typeof FxRateSchema>;

/** Periodo de análisis aceptado por las herramientas de los agentes. */
export const PeriodSchema = z.enum(['hoy', '7d', '30d', '90d', 'todo']);
export type Period = z.infer<typeof PeriodSchema>;

/** Eventos que el runtime del agente emite hacia el cliente vía SSE. */
export type AgentEvent =
  | { type: 'start'; agentId: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; output: unknown; isError: boolean }
  | { type: 'done'; stopReason: string | null; usage: { input: number; output: number } }
  | { type: 'error'; message: string };
