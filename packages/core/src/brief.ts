import { buildInsights, type Insight } from './insights.js';
import { createLlmProvider, type LlmProvider } from './llm/index.js';

import type { ToolContext } from './tools/registry.js';
import type { AgentEvent } from './types.js';

/**
 * El resumen del día.
 *
 * Cierra el ciclo del producto: los detectores encuentran los problemas y los
 * cuantifican, y acá el modelo los convierte en las tres frases que el dueño
 * lee mientras abre el local.
 *
 * Regla que hace esto confiable: el modelo NO tiene herramientas. Recibe los
 * hallazgos ya calculados y su único trabajo es redactarlos. No puede consultar
 * nada más, así que no puede aparecer con un número que no salió del motor
 * determinista. Si mañana cambia el modelo, las cifras del panel no se mueven.
 */

const SYSTEM = `
Sos el Director de Negocio de Mentor IA, hablándole al dueño de un comercio importador boliviano
que está abriendo su local y te da treinta segundos.

Te paso los hallazgos que el sistema ya detectó y cuantificó. Tu único trabajo es redactarlos.

Reglas, en orden de importancia:
1. NO inventes ni recalcules NADA. Usá exclusivamente las cifras que te paso, tal como vienen.
   Si un número no está en los datos, no existe: no lo estimes, no lo deduzcas, no lo redondees
   a algo "más lindo".
2. Máximo tres frases. Es un resumen hablado, no un informe.
3. Empezá por lo que más plata mueve o más urge. Si algo está perdiendo dinero, va primero.
4. Cerrá con UNA sola acción concreta: qué hacer hoy, sobre qué. No listes cinco cosas.
5. Español boliviano, directo, sin jerga financiera. Montos como "Bs 8.400".
6. Escribí en prosa corrida. Sin viñetas, sin títulos, sin markdown, sin emojis.

Si no hay hallazgos, decilo en una frase y no inventes preocupaciones.
`.trim();

/** Sólo lo que el modelo necesita para redactar. Menos contexto, menos deriva. */
function toPromptPayload(insights: Insight[]) {
  return insights.map((i) => ({
    severidad: i.severidad,
    titulo: i.titulo,
    detalle: i.detalle,
    impactoBob: i.impactoBob,
    accionSugerida: i.pregunta,
  }));
}

export interface BriefOptions {
  ctx: ToolContext;
  /** Proveedor de modelo. Si se omite, se resuelve desde el entorno. */
  provider?: LlmProvider;
  signal?: AbortSignal;
}

/**
 * Emite los mismos eventos que `runAgent`, así el frontend reutiliza el
 * plumbing de SSE que ya tiene para el chat.
 */
export async function* streamBrief(options: BriefOptions): AsyncGenerator<AgentEvent> {
  const { ctx, signal } = options;
  const provider = options.provider ?? createLlmProvider();

  yield { type: 'start', agentId: 'director' };

  try {
    const { insights, totalImpactoBob } = await buildInsights(ctx);

    if (insights.length === 0) {
      yield {
        type: 'text',
        text: 'No encontré nada urgente hoy: márgenes, stock, cobros y clientes están dentro de lo esperado.',
      };
      yield { type: 'done', stopReason: 'end_turn', usage: { input: 0, output: 0 } };
      return;
    }

    // Sin herramientas: los hallazgos ya vienen calculados y sólo hay que redactarlos.
    let usage = { input: 0, output: 0 };
    let stopReason: string | null = null;

    for await (const event of provider.stream({
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          text:
            `Hallazgos de hoy (total en juego: Bs ${totalImpactoBob}):\n\n` +
            JSON.stringify(toPromptPayload(insights), null, 2),
        },
      ],
      tools: [],
      maxTokens: 1000,
      signal,
    })) {
      if (event.type === 'text') {
        yield { type: 'text', text: event.text };
      } else {
        usage = event.turn.usage;
        stopReason = event.turn.stopReason;
      }
    }

    yield { type: 'done', stopReason, usage };
  } catch (error) {
    yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
