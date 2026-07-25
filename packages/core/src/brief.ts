import Anthropic from '@anthropic-ai/sdk';
import { buildInsights, type Insight } from './insights.js';
import { DEFAULT_MODEL } from './runtime.js';
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
Sos el Director de Negocio de PyME AI, hablándole al dueño de un comercio importador boliviano
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
  client?: Anthropic;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Emite los mismos eventos que `runAgent`, así el frontend reutiliza el
 * plumbing de SSE que ya tiene para el chat.
 */
export async function* streamBrief(options: BriefOptions): AsyncGenerator<AgentEvent> {
  const { ctx, signal } = options;
  const client = options.client ?? new Anthropic();

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

    const stream = client.messages.stream(
      {
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: 1000,
        system: [
          {
            type: 'text' as const,
            text: SYSTEM,
            // El prompt es idéntico en cada corrida: cachearlo abarata el resumen diario.
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: [
          {
            role: 'user' as const,
            content:
              `Hallazgos de hoy (total en juego: Bs ${totalImpactoBob}):\n\n` +
              JSON.stringify(toPromptPayload(insights), null, 2),
          },
        ],
        // Redactar tres frases sobre datos ya calculados no requiere razonamiento
        // profundo, y este texto es lo primero que se ve al abrir la app.
        output_config: { effort: 'low' },
      } as unknown as Anthropic.MessageCreateParamsStreaming,
      { signal },
    );

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
    }

    const message = await stream.finalMessage();
    yield {
      type: 'done',
      stopReason: message.stop_reason,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  } catch (error) {
    yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
