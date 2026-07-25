import Anthropic from '@anthropic-ai/sdk';
import type {
  LlmMessage,
  LlmProvider,
  LlmStreamEvent,
  LlmStreamParams,
  LlmToolCall,
} from './types.js';

/**
 * Adaptador de Claude (Anthropic).
 *
 * Se mantiene como alternativa al proveedor principal: si Gemini falla o
 * rate-limitea durante la demo, `LLM_PROVIDER=anthropic` devuelve el producto
 * a funcionar sin tocar código.
 */

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5';

/** Historial neutral → formato de bloques de la Messages API. */
function toMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
  return messages.map((msg): Anthropic.MessageParam => {
    if (msg.role === 'user') {
      return { role: 'user', content: msg.text };
    }

    if (msg.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = [];
      if (msg.text.trim()) content.push({ type: 'text', text: msg.text });
      for (const call of msg.toolCalls) {
        content.push({
          type: 'tool_use',
          id: call.id,
          name: call.name,
          input: (call.input ?? {}) as Record<string, unknown>,
        });
      }
      return { role: 'assistant', content };
    }

    return {
      role: 'user',
      content: msg.results.map(
        (r): Anthropic.ToolResultBlockParam => ({
          type: 'tool_result',
          tool_use_id: r.id,
          content: r.content,
          is_error: r.isError,
        }),
      ),
    };
  });
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly client: Anthropic;

  constructor(client?: Anthropic, model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL) {
    this.client = client ?? new Anthropic();
    this.model = model;
  }

  async *stream(params: LlmStreamParams): AsyncGenerator<LlmStreamEvent> {
    const request = {
      model: this.model,
      max_tokens: params.maxTokens,
      system: [
        {
          type: 'text' as const,
          text: params.system,
          // Prompt y herramientas son idénticos entre turnos: cachearlos abarata
          // mucho una conversación larga.
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      messages: toMessages(params.messages),
      output_config: { effort: process.env.ANTHROPIC_EFFORT ?? 'medium' },
    } as unknown as Anthropic.MessageCreateParamsStreaming;

    const stream = this.client.messages.stream(request, { signal: params.signal });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
    }

    const message = await stream.finalMessage();

    let text = '';
    const toolCalls: LlmToolCall[] = [];
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    yield {
      type: 'turn',
      turn: {
        text,
        toolCalls,
        usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
        stopReason: message.stop_reason,
      },
    };
  }
}
