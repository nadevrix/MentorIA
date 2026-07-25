import type { Customer, Expense, FxRate, Product, Sale } from '../types.js';

/**
 * Contrato único de acceso a datos.
 *
 * El resto del sistema (tools, agentes, API) SOLO habla con esta interfaz.
 * Cambiar de JSON semilla a Supabase/Odoo es implementar esto de nuevo,
 * sin tocar ni un agente. Ese es el trabajo de la Persona 2.
 */
export interface DataSource {
  readonly name: string;
  products(): Promise<Product[]>;
  sales(): Promise<Sale[]>;
  customers(): Promise<Customer[]>;
  expenses(): Promise<Expense[]>;
  /** Historial de tipo de cambio, ordenado del más antiguo al más reciente. */
  fxHistory(): Promise<FxRate[]>;
}
