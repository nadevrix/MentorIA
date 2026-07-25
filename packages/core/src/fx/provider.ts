import type { DataSource } from '../data/source.js';
import type { FxRate } from '../types.js';

/**
 * Proveedor de tipo de cambio.
 *
 * El diferencial del producto: en Bolivia el dólar oficial (BCB) está fijo
 * pero el paralelo se mueve, y es el paralelo el que define el costo real
 * de reposición de un importador.
 */
export interface FxProvider {
  readonly name: string;
  current(): Promise<FxRate>;
  history(): Promise<FxRate[]>;
}

/** Lee el histórico de la fuente de datos y devuelve el último registro. */
export class SeedFxProvider implements FxProvider {
  readonly name = 'static';
  constructor(private readonly data: DataSource) {}

  async history(): Promise<FxRate[]> {
    return this.data.fxHistory();
  }

  async current(): Promise<FxRate> {
    const history = await this.history();
    const latest = history.at(-1);
    if (!latest) throw new Error('No hay datos de tipo de cambio en la fuente');
    return latest;
  }
}

/**
 * TODO (Persona 2): scrapear el paralelo en vivo con Firecrawl y cachear
 * en memoria ~15 min. Mantener el mismo contrato para no tocar los agentes.
 * Si el scraping falla, hacer fallback a SeedFxProvider — nunca romper la demo.
 */
export function createFxProvider(data: DataSource): FxProvider {
  switch (process.env.FX_SOURCE) {
    case 'firecrawl':
      console.warn('[fx] FX_SOURCE=firecrawl aún no implementado; usando fuente estática.');
      return new SeedFxProvider(data);
    default:
      return new SeedFxProvider(data);
  }
}
