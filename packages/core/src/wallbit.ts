import { z } from 'zod';
import { round } from './tools/helpers.js';

const WALLBIT_API_URL = 'https://api.wallbit.io';
const WALLBIT_TIMEOUT_MS = 10_000;

const CheckingBalanceSchema = z.object({
  data: z.array(
    z.object({
      currency: z.string(),
      balance: z.number().finite().nonnegative(),
    }),
  ),
});

const ExchangeRateSchema = z.object({
  data: z.object({
    source_currency: z.string(),
    dest_currency: z.string(),
    pair: z.string(),
    rate: z.number().finite().positive(),
    updated_at: z.string().nullable(),
  }),
});

export interface WallbitCoverage {
  configured: boolean;
  capitalAdicionalBob: number;
  capitalAdicionalUsd: number;
  saldoUsd: number;
  coberturaPct: number;
  saldoSuficiente: boolean;
  tipoCambioWallbitBob?: number;
  tipoCambioActualizadoEn?: string;
  message: string;
}

class WallbitRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function apiKey(): string | undefined {
  return process.env.WALLBIT_API_KEY?.trim() || undefined;
}

/** Estado seguro para /health: no consulta ni expone la cuenta. */
export function wallbitConfigured(): boolean {
  return Boolean(apiKey());
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { message?: unknown; error?: unknown }
    | null;
  const detail =
    typeof body?.message === 'string'
      ? body.message
      : typeof body?.error === 'string'
        ? body.error
        : undefined;

  if (response.status === 401) return 'La clave de Wallbit no es válida.';
  if (response.status === 403) return 'La clave de Wallbit necesita permiso read.';
  if (response.status === 412) return 'Wallbit requiere completar la verificación de la cuenta.';
  if (response.status === 429) return 'Wallbit alcanzó temporalmente su límite de consultas.';
  return detail?.slice(0, 240) || `Wallbit respondió con estado ${response.status}.`;
}

async function wallbitGet(path: string): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new Error('Falta WALLBIT_API_KEY.');

  let response: Response;
  try {
    response = await fetch(`${WALLBIT_API_URL}${path}`, {
      headers: { 'X-API-Key': key },
      signal: AbortSignal.timeout(WALLBIT_TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === 'TimeoutError';
    throw new Error(timeout ? 'Wallbit tardó demasiado en responder.' : 'No se pudo conectar con Wallbit.');
  }

  if (!response.ok) throw new WallbitRequestError(await errorMessage(response), response.status);
  return response.json();
}

async function checkingUsdBalance(): Promise<number> {
  const parsed = CheckingBalanceSchema.safeParse(
    await wallbitGet('/api/public/v1/balance/checking'),
  );
  if (!parsed.success) throw new Error('Wallbit devolvió un saldo con formato inesperado.');

  return round(
    parsed.data.data
      .filter((balance) => balance.currency.toUpperCase() === 'USD')
      .reduce((total, balance) => total + balance.balance, 0),
  );
}

/**
 * Esta cotización es contexto financiero, no reemplaza el FxProvider operativo.
 * Algunas cuentas pueden no tener el par USD/BOB habilitado; en ese caso se omite.
 */
async function usdBobRate(): Promise<
  { rate: number; updatedAt?: string } | undefined
> {
  try {
    const parsed = ExchangeRateSchema.safeParse(
      await wallbitGet('/api/public/v1/rates?source_currency=USD&dest_currency=BOB'),
    );
    if (!parsed.success) return undefined;
    return {
      rate: parsed.data.data.rate,
      updatedAt: parsed.data.data.updated_at ?? undefined,
    };
  } catch (error) {
    if (error instanceof WallbitRequestError && error.status === 404) return undefined;
    return undefined;
  }
}

/**
 * Compara el capital adicional que exige un escenario con el saldo USD real.
 * El requerimiento se convierte con el tipo del escenario de Mentor IA; la tasa
 * de Wallbit sólo se presenta como referencia para no alterar los márgenes.
 */
export async function getWallbitCoverage(input: {
  capitalAdicionalBob: number;
  tipoCambioEscenario: number;
}): Promise<WallbitCoverage> {
  const capitalBob = round(Math.max(0, input.capitalAdicionalBob));
  const capitalUsd =
    input.tipoCambioEscenario > 0 ? round(capitalBob / input.tipoCambioEscenario) : 0;

  if (!wallbitConfigured()) {
    return {
      configured: false,
      capitalAdicionalBob: capitalBob,
      capitalAdicionalUsd: capitalUsd,
      saldoUsd: 0,
      coberturaPct: 0,
      saldoSuficiente: false,
      message: 'Configura WALLBIT_API_KEY con permiso read.',
    };
  }

  const [saldoUsd, rate] = await Promise.all([checkingUsdBalance(), usdBobRate()]);
  const coverage = capitalUsd === 0 ? 100 : round(Math.min(100, (saldoUsd / capitalUsd) * 100), 1);

  return {
    configured: true,
    capitalAdicionalBob: capitalBob,
    capitalAdicionalUsd: capitalUsd,
    saldoUsd,
    coberturaPct: coverage,
    saldoSuficiente: saldoUsd >= capitalUsd,
    tipoCambioWallbitBob: rate?.rate,
    tipoCambioActualizadoEn: rate?.updatedAt,
    message:
      capitalUsd === 0
        ? 'Este escenario no exige capital adicional para reponer.'
        : saldoUsd >= capitalUsd
          ? 'El saldo USD cubre el capital adicional del escenario.'
          : 'El saldo USD cubre sólo una parte del capital adicional.',
  };
}
