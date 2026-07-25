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

export const FxRateSchema = z.object({
  date: z.string(),
  /** Tipo de cambio oficial del BCB (históricamente fijo en 6.96). */
  official: z.number().positive(),
  /** Dólar paralelo/blue: el que realmente paga un importador. */
  parallel: z.number().positive(),
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
