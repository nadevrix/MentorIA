import { getAgent } from './agents/index.js';
import {
  createLlmProvider,
  type LlmMessage,
  type LlmProvider,
  type LlmToolResult,
  type LlmTurn,
} from './llm/index.js';
import { toolsFor, type ToolContext } from './tools/index.js';
import type { AgentEvent } from './types.js';

/** Tope de vueltas del loop de herramientas: evita que un agente se cuelgue en vivo. */
const MAX_ITERATIONS = 8;

/** Techo de salida por turno. Deja lugar al razonamiento más la respuesta. */
const MAX_TOKENS = 8000;

/** Mensaje de entrada del usuario, tal como lo manda la API. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunAgentOptions {
  agentId: string;
  messages: ChatMessage[];
  ctx: ToolContext;
  /** Proveedor a usar. Si se omite, se resuelve desde el entorno. */
  provider?: LlmProvider;
  signal?: AbortSignal;
}

/**
 * Loop de agente: el modelo percibe (herramientas), decide (cuáles llamar),
 * ejecuta y produce un resultado accionable. Emite eventos para que la UI
 * muestre el razonamiento en vivo en lugar de una barra de carga.
 *
 * Es agnóstico del proveedor: habla con la interfaz `LlmProvider`, así que
 * funciona igual con Gemini o con Claude.
 */
export async function* runAgent(options: RunAgentOptions): AsyncGenerator<AgentEvent> {
  const { agentId, ctx, signal } = options;
  const agent = getAgent(agentId);
  const tools = toolsFor(agent.tools);

  const toolSchemas = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  const messages: LlmMessage[] = options.messages.map((m) =>
    m.role === 'user'
      ? { role: 'user' as const, text: m.content }
      : { role: 'assistant' as const, text: m.content, toolCalls: [] },
  );

  let usageIn = 0;
  let usageOut = 0;

  yield { type: 'start', agentId };

  try {
    const provider = options.provider ?? createLlmProvider();

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (signal?.aborted) throw new Error('Solicitud cancelada');

      let turn: LlmTurn | null = null;

      for await (const event of provider.stream({
        system: agent.systemPrompt,
        messages,
        tools: toolSchemas,
        maxTokens: MAX_TOKENS,
        signal,
      })) {
        if (event.type === 'text') {
          yield { type: 'text', text: event.text };
        } else {
          turn = event.turn;
        }
      }

      if (!turn) throw new Error(`El proveedor ${provider.name} no devolvió un turno completo.`);

      usageIn += turn.usage.input;
      usageOut += turn.usage.output;
      messages.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls });

      if (turn.toolCalls.length === 0) {
        yield {
          type: 'done',
          stopReason: turn.stopReason,
          usage: { input: usageIn, output: usageOut },
        };
        return;
      }

      for (const call of turn.toolCalls) {
        yield { type: 'tool_use', id: call.id, name: call.name, input: call.input };
      }

      // Todas las herramientas del turno se ejecutan en paralelo y sus
      // resultados vuelven juntos en un solo mensaje.
      const executed = await Promise.all(
        turn.toolCalls.map(async (call) => {
          const tool = tools.find((t) => t.name === call.name);
          if (!tool) {
            return { call, output: `Herramienta no disponible: ${call.name}`, isError: true };
          }
          try {
            const input = tool.parse.parse(call.input);
            const output = await tool.run(input as never, ctx);
            return { call, output, isError: false };
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            return { call, output: `Error ejecutando ${call.name}: ${detail}`, isError: true };
          }
        }),
      );

      const results: LlmToolResult[] = [];
      for (const { call, output, isError } of executed) {
        yield { type: 'tool_result', id: call.id, name: call.name, output, isError };
        results.push({
          id: call.id,
          name: call.name,
          content: typeof output === 'string' ? output : JSON.stringify(output),
          isError,
        });
      }

      messages.push({ role: 'tool', results });
    }

    yield {
      type: 'error',
      message: `El agente superó el límite de ${MAX_ITERATIONS} pasos sin llegar a una respuesta.`,
    };
  } catch (error) {
    yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
