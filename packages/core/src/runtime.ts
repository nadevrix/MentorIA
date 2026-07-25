import Anthropic from '@anthropic-ai/sdk';
import { getAgent } from './agents/index.js';
import { toolsFor, type ToolContext } from './tools/index.js';
import type { AgentEvent } from './types.js';

/**
 * Modelo por defecto. Opus 5 razona por defecto (adaptive thinking) y es el más
 * capaz para decidir qué herramienta llamar y en qué orden.
 */
export const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Nivel de esfuerzo. `medium` mantiene la demo ágil sin perder calidad de decisión;
 * subilo a `high` si notás que el agente se salta herramientas.
 */
export const DEFAULT_EFFORT = 'medium';

/** Tope de vueltas del loop de herramientas: evita que un agente se cuelgue en vivo. */
const MAX_ITERATIONS = 8;

export interface RunAgentOptions {
  agentId: string;
  messages: Anthropic.MessageParam[];
  ctx: ToolContext;
  client?: Anthropic;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Loop de agente: el modelo percibe (herramientas), decide (qué llamar), ejecuta
 * y produce un resultado accionable. Emite eventos para que la UI muestre el
 * razonamiento en vivo en lugar de una barra de carga.
 */
export async function* runAgent(options: RunAgentOptions): AsyncGenerator<AgentEvent> {
  const { agentId, ctx, signal } = options;
  const client = options.client ?? new Anthropic();
  const agent = getAgent(agentId);
  const tools = toolsFor(agent.tools);

  const apiTools: Anthropic.ToolUnion[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [...options.messages];
  let usageIn = 0;
  let usageOut = 0;

  yield { type: 'start', agentId };

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (signal?.aborted) throw new Error('Solicitud cancelada');

      const params = {
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: 8000,
        system: [
          {
            type: 'text' as const,
            text: agent.systemPrompt,
            // El prompt de sistema y las tools son idénticos entre turnos:
            // cachearlos abarata mucho una conversación larga.
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        tools: apiTools,
        messages,
        output_config: { effort: DEFAULT_EFFORT },
      } as unknown as Anthropic.MessageCreateParamsStreaming;

      const stream = client.messages.stream(params, { signal });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text };
        }
      }

      const message = await stream.finalMessage();
      usageIn += message.usage.input_tokens;
      usageOut += message.usage.output_tokens;
      messages.push({ role: 'assistant', content: message.content });

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUses.length === 0) {
        yield {
          type: 'done',
          stopReason: message.stop_reason,
          usage: { input: usageIn, output: usageOut },
        };
        return;
      }

      // Ejecutar todas las herramientas del turno en paralelo y devolver
      // TODOS los resultados en un solo mensaje de usuario.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        yield { type: 'tool_use', id: use.id, name: use.name, input: use.input };
      }

      const executed = await Promise.all(
        toolUses.map(async (use) => {
          const tool = tools.find((t) => t.name === use.name);
          if (!tool) {
            return { use, output: `Herramienta no disponible: ${use.name}`, isError: true };
          }
          try {
            const input = tool.parse.parse(use.input);
            const output = await tool.run(input as never, ctx);
            return { use, output, isError: false };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { use, output: `Error ejecutando ${use.name}: ${message}`, isError: true };
          }
        }),
      );

      for (const { use, output, isError } of executed) {
        yield { type: 'tool_result', id: use.id, name: use.name, output, isError };
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: typeof output === 'string' ? output : JSON.stringify(output),
          is_error: isError,
        });
      }

      messages.push({ role: 'user', content: results });
    }

    yield {
      type: 'error',
      message: `El agente superó el límite de ${MAX_ITERATIONS} pasos sin llegar a una respuesta.`,
    };
  } catch (error) {
    yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
