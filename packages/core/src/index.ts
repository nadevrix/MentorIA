export * from './types.js';
export * from './data/source.js';
export * from './data/seed-source.js';
export * from './fx/provider.js';
export * from './tools/index.js';
export * from './agents/index.js';
export * from './llm/index.js';
export * from './runtime.js';
export * from './dashboard.js';
export * from './insights.js';
export * from './simulate.js';
export * from './brief.js';
export * from './image.js';
export * from './taxes.js';
export * from './tax-forms.js';
export * from './formalizacion.js';

import { SeedDataSource } from './data/seed-source.js';
import { OverlayDataSource } from './data/overlay-source.js';
import { PostgresDataSource } from './data/postgres-source.js';
import { createFxProvider } from './fx/provider.js';
import type { DataSource } from './data/source.js';
import type { ToolContext } from './tools/registry.js';

export * from './data/csv.js';
export * from './data/overlay-source.js';
export * from './data/postgres-source.js';

/**
 * Arma el contexto de ejecución según variables de entorno.
 * Cuando exista SupabaseDataSource, se enchufa acá y nada más cambia.
 *
 * La fuente base siempre va envuelta en OverlayDataSource, así el comercio
 * puede superponer sus propios datos sin que nada más del sistema se entere.
 */
export function createContext(): ToolContext {
  let base: DataSource;
  switch (process.env.DATA_SOURCE) {
    case 'postgres':
    case 'neon': {
      const url = process.env.DATABASE_URL;
      if (url) {
        base = new PostgresDataSource(url);
      } else {
        // Caer a semilla y no reventar: una demo no se cae porque falte una
        // variable de entorno, pero el aviso tiene que ser imposible de ignorar.
        console.warn('[data] DATA_SOURCE=postgres pero falta DATABASE_URL; usando datos semilla.');
        base = new SeedDataSource();
      }
      break;
    }
    case 'supabase':
      console.warn('[data] DATA_SOURCE=supabase aún no implementado; usando datos semilla.');
      base = new SeedDataSource();
      break;
    default:
      base = new SeedDataSource();
  }
  const data = new OverlayDataSource(base);
  return { data, fx: createFxProvider(data) };
}

/**
 * La superposición del contexto, para que la API pueda importar CSV.
 * Devuelve null si la fuente no es superponible (p. ej. una futura fuente real).
 */
export function overlayOf(ctx: ToolContext): OverlayDataSource | null {
  return ctx.data instanceof OverlayDataSource ? ctx.data : null;
}
