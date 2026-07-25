import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import type { LlmProvider } from './types.js';

export * from './types.js';
export { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.js';
export { GeminiProvider, DEFAULT_GEMINI_MODEL } from './gemini.js';

/**
 * Elige el proveedor de modelo según el entorno.
 *
 *   LLM_PROVIDER=gemini     (por defecto) → GEMINI_API_KEY + GEMINI_MODEL
 *   LLM_PROVIDER=anthropic               → ANTHROPIC_API_KEY + ANTHROPIC_MODEL
 *
 * Si el proveedor pedido no tiene su clave configurada, cae al otro en vez de
 * romper: durante una demo, degradar es mejor que caerse.
 */
export function createLlmProvider(): LlmProvider {
  const requested = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (requested === 'anthropic') {
    if (hasAnthropic) return new AnthropicProvider();
    if (hasGemini) {
      console.warn('[llm] LLM_PROVIDER=anthropic pero falta ANTHROPIC_API_KEY; uso Gemini.');
      return new GeminiProvider();
    }
    throw new Error('No hay ninguna API key de modelo configurada (ANTHROPIC_API_KEY o GEMINI_API_KEY).');
  }

  if (hasGemini) return new GeminiProvider();
  if (hasAnthropic) {
    console.warn('[llm] Falta GEMINI_API_KEY; uso Claude como respaldo.');
    return new AnthropicProvider();
  }
  throw new Error('No hay ninguna API key de modelo configurada (GEMINI_API_KEY o ANTHROPIC_API_KEY).');
}
