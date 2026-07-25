export * from './types.js';
export * from './data/source.js';
export * from './data/seed-source.js';
export * from './fx/provider.js';
export * from './tools/index.js';
export * from './agents/index.js';
export * from './llm/index.js';
export * from './runtime.js';
export * from './dashboard.js';

import { SeedDataSource } from './data/seed-source.js';
import { createFxProvider } from './fx/provider.js';
import type { DataSource } from './data/source.js';
import type { ToolContext } from './tools/registry.js';

/**
 * Arma el contexto de ejecución según variables de entorno.
 * Cuando exista SupabaseDataSource, se enchufa acá y nada más cambia.
 */
export function createContext(): ToolContext {
  let data: DataSource;
  switch (process.env.DATA_SOURCE) {
    case 'supabase':
      console.warn('[data] DATA_SOURCE=supabase aún no implementado; usando datos semilla.');
      data = new SeedDataSource();
      break;
    default:
      data = new SeedDataSource();
  }
  return { data, fx: createFxProvider(data) };
}
