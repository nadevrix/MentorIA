import type { Period, Sale } from '../types.js';

const DAYS_BY_PERIOD: Record<Period, number | null> = {
  hoy: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  todo: null,
};

/** "Hoy" del sistema. Sobrescribible con DEMO_TODAY para demos reproducibles. */
export function today(): Date {
  const override = process.env.DEMO_TODAY;
  return override ? new Date(`${override}T12:00:00Z`) : new Date();
}

export function daysAgo(iso: string): number {
  const then = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.floor((today().getTime() - then) / 86_400_000);
}

export function withinPeriod(iso: string, period: Period): boolean {
  const window = DAYS_BY_PERIOD[period];
  if (window === null) return true;
  const age = daysAgo(iso);
  return age >= 0 && age < window;
}

export function salesInPeriod(sales: Sale[], period: Period): Sale[] {
  return sales.filter((s) => withinPeriod(s.date, period));
}

/** Redondeo a 2 decimales, para no devolverle al modelo 47.30000000000001. */
export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Costo de reposición HOY, en bolivianos.
 * Un producto importado se repone al dólar paralelo; uno nacional, al oficial.
 */
export function replacementCostBob(
  costUsd: number,
  imported: boolean,
  fx: { official: number; parallel: number },
): number {
  return round(costUsd * (imported ? fx.parallel : fx.official));
}

export function marginPct(priceBob: number, costBob: number): number {
  if (priceBob <= 0) return 0;
  return round(((priceBob - costBob) / priceBob) * 100);
}

/** Precio necesario para alcanzar un margen objetivo sobre el precio de venta. */
export function priceForMargin(costBob: number, targetMarginPct: number): number {
  const m = Math.min(Math.max(targetMarginPct, 0), 95) / 100;
  return round(costBob / (1 - m));
}
