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
 * Proveedor en vivo que obtiene el tipo de cambio del dólar paralelo mediante la API de Firecrawl.
 * Mantiene un caché en memoria de 15 minutos (900,000 ms). Si el scraping falla o no hay API key,
 * realiza un fallback transparente a SeedFxProvider para garantizar estabilidad durante las demos.
 */
export class FirecrawlFxProvider implements FxProvider {
  readonly name = 'firecrawl';
  private readonly fallback: SeedFxProvider;
  private cachedRate: FxRate | null = null;
  private lastFetch = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

  constructor(
    data: DataSource,
    private readonly apiKey: string | undefined = process.env.FIRECRAWL_API_KEY,
  ) {
    this.fallback = new SeedFxProvider(data);
  }

  private async fetchLiveParallelRate(): Promise<number | null> {
    if (!this.apiKey) {
      throw new Error('FIRECRAWL_API_KEY no está configurada');
    }

    // URL de referencia pública del dólar paralelo en Bolivia
    const targetUrl = 'https://boliviabolivar.com';

    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['markdown'],
      }),
    });

    if (!res.ok) {
      throw new Error(`Firecrawl API respondió con estado ${res.status}`);
    }

    const payload = (await res.json()) as { data?: { markdown?: string } };
    const markdown = payload.data?.markdown ?? '';

    // Buscar patrones comunes de tipo de cambio (ej. "14.75", "14,80", "Bs 14.50")
    const match = markdown.match(/(\d{2}[.,]\d{1,2})/);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(val) && val >= 6.96 && val <= 30.0) {
        return val;
      }
    }

    throw new Error('No se pudo extraer una cotización válida del contenido obtenido');
  }

  async current(): Promise<FxRate> {
    const now = Date.now();
    if (this.cachedRate && now - this.lastFetch < this.CACHE_TTL_MS) {
      return this.cachedRate;
    }

    try {
      const liveParallel = await this.fetchLiveParallelRate();
      if (liveParallel !== null) {
        const fallbackRate = await this.fallback.current();
        const todayIso = new Date().toISOString().slice(0, 10);

        this.cachedRate = {
          official: fallbackRate.official || 6.96,
          parallel: liveParallel,
          date: todayIso,
          source: 'firecrawl (boliviabolivar.com)',
        };
        this.lastFetch = now;
        console.log(`[fx] Dólar paralelo actualizado vía Firecrawl: ${liveParallel} Bs`);
        return this.cachedRate;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[fx] Firecrawl falló (${msg}); usando fuente de datos de reserva.`);
    }

    return this.fallback.current();
  }

  async history(): Promise<FxRate[]> {
    const baseHistory = await this.fallback.history();
    try {
      const latestLive = await this.current();
      if (latestLive.source.includes('firecrawl')) {
        return [...baseHistory.filter((r) => r.date !== latestLive.date), latestLive];
      }
    } catch {
      // Usar base sin modificar ante error
    }
    return baseHistory;
  }
}

/**
 * Crea el proveedor de tipo de cambio según las variables de entorno.
 */
export function createFxProvider(data: DataSource): FxProvider {
  const fxSource = process.env.FX_SOURCE;
  const hasKey = Boolean(process.env.FIRECRAWL_API_KEY);

  if (fxSource === 'firecrawl' || hasKey) {
    return new FirecrawlFxProvider(data);
  }

  return new SeedFxProvider(data);
}
