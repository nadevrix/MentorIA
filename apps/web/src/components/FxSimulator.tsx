import { useState } from 'react';
import { bob } from '../lib/api';

interface ProductData {
  id: string;
  sku: string;
  nombre?: string;
  name?: string;
  importado?: boolean;
  imported?: boolean;
  costUsd?: number;
  costoAlComprarBob?: number;
  precioBob: number;
  margenAlComprarPct?: number;
  margenRealHoyPct?: number;
  pierdeDinero?: boolean;
  enRiesgo?: boolean;
}

interface FxSimulatorProps {
  products: ProductData[];
  currentParallelFx: number;
  officialFx: number;
  onAskAgent?: (prompt: string, agentId?: string) => void;
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export default function FxSimulator({
  products,
  currentParallelFx,
  officialFx,
  onAskAgent,
}: FxSimulatorProps) {
  const [simulatedFx, setSimulatedFx] = useState<number>(currentParallelFx || 14.76);
  const [targetMargin, setTargetMargin] = useState<number>(30);

  // Derivar datos de productos basados en el costo en USD o estimación del costo actual
  const simulatedProducts = products.map((p) => {
    const isImported = p.importado ?? p.imported ?? true;
    const name = p.nombre || p.name || p.sku;
    
    // Si tenemos costUsd directo, lo usamos; si no, lo estimamos dividiendo por el paralelo actual
    const estimatedCostUsd = p.costUsd ?? (p.costoAlComprarBob ? p.costoAlComprarBob / (currentParallelFx || 14.76) : 0);
    
    const costoSimuladoBob = isImported
      ? round(estimatedCostUsd * simulatedFx)
      : round(estimatedCostUsd * officialFx);

    const margenSimuladoPct = p.precioBob > 0
      ? round(((p.precioBob - costoSimuladoBob) / p.precioBob) * 100)
      : 0;

    const pierdeDinero = p.precioBob < costoSimuladoBob;
    const enRiesgo = margenSimuladoPct < 20;

    // Precio necesario para el margen objetivo
    const mFactor = Math.min(Math.max(targetMargin, 0), 95) / 100;
    const precioSugeridoBob = round(costoSimuladoBob / (1 - mFactor));
    const ajusteSugeridoPct = p.precioBob > 0 ? round(((precioSugeridoBob - p.precioBob) / p.precioBob) * 100) : 0;

    return {
      id: p.id,
      nombre: name,
      isImported,
      precioBob: p.precioBob,
      costoSimuladoBob,
      margenSimuladoPct,
      pierdeDinero,
      enRiesgo,
      precioSugeridoBob,
      ajusteSugeridoPct,
    };
  });

  const totalPerdiendo = simulatedProducts.filter((p) => p.pierdeDinero).length;
  const totalEnRiesgo = simulatedProducts.filter((p) => p.enRiesgo).length;
  const deltaFx = round(simulatedFx - currentParallelFx);
  const deltaPct = round(((simulatedFx - currentParallelFx) / currentParallelFx) * 100);

  const handleAskAgent = () => {
    if (!onAskAgent) return;
    const prompt = `¿Qué pasa si el dólar paralelo llega a ${simulatedFx.toFixed(2)} Bs? ¿Qué productos pasan a dar pérdida y cuáles deberían ser mis nuevos precios sugeridos para mantener un margen del ${targetMargin}%?`;
    onAskAgent(prompt, 'fx');
  };

  return (
    <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-line)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎛️</span>
            <h3 className="text-base font-bold text-white">Simulador Cambiario (Dólar Paralelo)</h3>
            <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
              Momento Escenario
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Proyecta cómo cambia el margen real y los precios de tu catálogo si sube el dólar en Bolivia.
          </p>
        </div>

        {onAskAgent && (
          <button
            onClick={handleAskAgent}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90 active:scale-95"
          >
            <span>💬 Preguntar al Agente Cambiario</span>
          </button>
        )}
      </div>

      {/* Control Slider y Accesos Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-xl border border-[var(--color-line)]">
        <div className="md:col-span-2 space-y-2">
          <div className="flex justify-between items-baseline text-sm">
            <span className="font-medium text-slate-300">Dólar Paralelo Simulado:</span>
            <span className="text-xl font-bold text-[var(--color-accent)] tabular-nums">
              {simulatedFx.toFixed(2)} Bs / USD
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({deltaFx >= 0 ? `+${deltaFx}` : deltaFx} Bs · {deltaPct >= 0 ? `+${deltaPct}` : deltaPct}%)
              </span>
            </span>
          </div>
          <input
            type="range"
            min="10.00"
            max="20.00"
            step="0.10"
            value={simulatedFx}
            onChange={(e) => setSimulatedFx(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>10.00 Bs</span>
            <span>12.50 Bs</span>
            <span>15.00 Bs</span>
            <span>17.50 Bs</span>
            <span>20.00 Bs</span>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-2">
          <span className="text-xs font-medium text-slate-400">Atajos de Escenario:</span>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => setSimulatedFx(currentParallelFx)}
              className={`rounded px-2 py-1 text-left transition border ${
                simulatedFx === currentParallelFx
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Hoy ({currentParallelFx} Bs)
            </button>
            <button
              onClick={() => setSimulatedFx(16.0)}
              className={`rounded px-2 py-1 text-left transition border ${
                simulatedFx === 16.0
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Dólar 16.00 Bs
            </button>
            <button
              onClick={() => setSimulatedFx(18.0)}
              className={`rounded px-2 py-1 text-left transition border ${
                simulatedFx === 18.0
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Dólar 18.00 Bs
            </button>
            <button
              onClick={() => setSimulatedFx(20.0)}
              className={`rounded px-2 py-1 text-left transition border ${
                simulatedFx === 20.0
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Dólar 20.00 Bs
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de Impacto */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[var(--color-line)] bg-slate-900/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Vendiéndose bajo costo</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${totalPerdiendo > 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-good)]'}`}>
            {totalPerdiendo} productos
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {totalPerdiendo > 0 ? 'Perdiendo dinero por unidad' : 'Ningún producto con pérdida'}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-line)] bg-slate-900/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">En margen crítico (&lt;20%)</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${totalEnRiesgo > 0 ? 'text-[var(--color-accent)]' : 'text-white'}`}>
            {totalEnRiesgo} productos
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Requieren ajuste de precio</div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-lg border border-[var(--color-line)] bg-slate-900/40 p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">Margen Objetivo</span>
            <select
              value={targetMargin}
              onChange={(e) => setTargetMargin(parseInt(e.target.value, 10))}
              className="bg-slate-800 text-xs text-white border border-slate-700 rounded px-1.5 py-0.5"
            >
              <option value={20}>20%</option>
              <option value={25}>25%</option>
              <option value={30}>30% (Recomendado)</option>
              <option value={35}>35%</option>
              <option value={40}>40%</option>
            </select>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Calcula el precio necesario para sostener un {targetMargin}% de utilidad.
          </div>
        </div>
      </div>

      {/* Tabla Simulada */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] text-xs">
          <thead className="text-left uppercase tracking-wider text-slate-400 border-b border-[var(--color-line)] pb-2">
            <tr>
              <th className="py-2">Producto</th>
              <th className="py-2 text-right">Precio Actual</th>
              <th className="py-2 text-right">Costo Rep. (Dólar {simulatedFx.toFixed(2)})</th>
              <th className="py-2 text-right">Margen Real Simulado</th>
              <th className="py-2 text-right">Precio Sugerido ({targetMargin}%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {simulatedProducts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition">
                <td className="py-2 pr-2 font-medium text-slate-200">
                  {p.nombre}
                  {p.isImported && <span className="ml-1 text-[10px] text-slate-500">🚢</span>}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-300">{bob(p.precioBob)}</td>
                <td className="py-2 text-right tabular-nums font-mono text-slate-300">{bob(p.costoSimuladoBob)}</td>
                <td
                  className={`py-2 text-right font-semibold tabular-nums ${
                    p.pierdeDinero
                      ? 'text-[var(--color-bad)]'
                      : p.enRiesgo
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-good)]'
                  }`}
                >
                  {p.margenSimuladoPct}%
                  {p.pierdeDinero && <span className="ml-1 text-[10px]">⚠️</span>}
                </td>
                <td className="py-2 text-right tabular-nums">
                  <span className="font-semibold text-white">{bob(p.precioSugeridoBob)}</span>
                  {p.ajusteSugeridoPct > 0 && (
                    <span className="ml-1 text-[10px] text-[var(--color-good)] font-mono">
                      (+{p.ajusteSugeridoPct}%)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
