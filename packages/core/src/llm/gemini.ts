import type {
  LlmMessage,
  LlmProvider,
  LlmStreamEvent,
  LlmStreamParams,
  LlmToolCall,
  LlmToolSchema,
} from './types.js';

/**
 * Adaptador de Google Gemini.
 *
 * Usa la API REST directamente (no el SDK) por dos razones: una dependencia
 * menos que instalar, y control total sobre el parseo del SSE, que es donde
 * suelen aparecer las sorpresas.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Tipos de JSON Schema → tipos de la variante de OpenAPI que acepta Gemini. */
const TYPE_MAP: Record<string, string> = {
  object: 'OBJECT',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
};

/**
 * Traduce un JSON Schema al dialecto de Gemini: tipos en mayúsculas y solo las
 * claves que soporta. Cualquier otra clave se descarta — mandarlas provoca un 400.
 */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const rawType = schema.type;
  if (typeof rawType === 'string') {
    out.type = TYPE_MAP[rawType] ?? rawType.toUpperCase();
  }
  if (typeof schema.description === 'string') out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;

  if (schema.properties && typeof schema.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      props[key] = toGeminiSchema(value as Record<string, unknown>);
    }
    out.properties = props;
  }
  if (Array.isArray(schema.required) && schema.required.length > 0) {
    out.required = schema.required;
  }
  if (schema.items && typeof schema.items === 'object') {
    out.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }

  return out;
}

function toFunctionDeclaration(tool: LlmToolSchema): Record<string, unknown> {
  const params = toGeminiSchema(tool.inputSchema);
  const props = (params.properties ?? {}) as Record<string, unknown>;

  const decl: Record<string, unknown> = {
    name: tool.name,
    description: tool.description,
  };
  // Gemini rechaza una declaración con `parameters` vacío: hay que omitirlo.
  if (Object.keys(props).length > 0) decl.parameters = params;
  return decl;
}

/** Historial neutral → `contents` de Gemini (solo conoce los roles user y model). */
function toContents(messages: LlmMessage[]): Record<string, unknown>[] {
  const contents: Record<string, unknown>[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.text }] });
      continue;
    }

    if (msg.role === 'assistant') {
      const parts: Record<string, unknown>[] = [];
      if (msg.text.trim()) parts.push({ text: msg.text });
      for (const call of msg.toolCalls) {
        parts.push({
          functionCall: { name: call.name, args: (call.input ?? {}) as Record<string, unknown> },
          // Gemini 3.x devuelve un thought_signature junto a cada functionCall y
          // exige recibirlo de vuelta intacto: sin él responde 400.
          ...(call.signature ? { thoughtSignature: call.signature } : {}),
        });
      }
      if (parts.length > 0) contents.push({ role: 'model', parts });
      continue;
    }

    // Los resultados de herramientas viajan como turno de usuario en Gemini.
    contents.push({
      role: 'user',
      parts: msg.results.map((r) => ({
        functionResponse: {
          name: r.name,
          // `response` debe ser un objeto sí o sí; el contenido viene serializado.
          response: r.isError ? { error: r.content } : { result: r.content },
        },
      })),
    });
  }

  return contents;
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  readonly model: string;

  constructor(
    private readonly apiKey: string = process.env.GEMINI_API_KEY ?? '',
    model: string = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  ) {
    if (!this.apiKey) throw new Error('Falta GEMINI_API_KEY');
    this.model = model;
  }

  async *stream(params: LlmStreamParams): AsyncGenerator<LlmStreamEvent> {
    const body = {
      systemInstruction: { parts: [{ text: params.system }] },
      contents: toContents(params.messages),
      ...(params.tools.length > 0
        ? { tools: [{ functionDeclarations: params.tools.map(toFunctionDeclaration) }] }
        : {}),
      generationConfig: { maxOutputTokens: params.maxTokens },
    };

    const url = `${ENDPOINT}/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini respondió ${res.status}: ${detail.slice(0, 400)}`);
    }

    let text = '';
    const toolCalls: LlmToolCall[] = [];
    let usageIn = 0;
    let usageOut = 0;
    let stopReason: string | null = null;

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;

      // Gemini separa los eventos con CRLF (\r\n\r\n), no con \n\n como la mayoría
      // de las implementaciones de SSE. Contemplar los dos.
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        const line = chunk.split(/\r?\n/).find((l) => l.startsWith('data:'));
        if (!line) continue;

        let payload: any;
        try {
          payload = JSON.parse(line.slice(5).trim());
        } catch {
          continue; // fragmento incompleto o keep-alive
        }

        const usage = payload.usageMetadata;
        if (usage) {
          usageIn = usage.promptTokenCount ?? usageIn;
          usageOut = usage.candidatesTokenCount ?? usageOut;
        }

        const candidate = payload.candidates?.[0];
        if (!candidate) continue;
        if (candidate.finishReason) stopReason = candidate.finishReason;

        for (const part of candidate.content?.parts ?? []) {
          // Los modelos 2.5+ emiten partes de razonamiento marcadas con `thought`.
          // No son respuesta al usuario: no se muestran.
          if (part.thought) continue;

          if (typeof part.text === 'string' && part.text) {
            text += part.text;
            yield { type: 'text', text: part.text };
          }

          if (part.functionCall) {
            toolCalls.push({
              // Gemini no manda id: lo sintetizamos para poder aparear el resultado.
              id: `gem_${toolCalls.length}_${part.functionCall.name}`,
              name: part.functionCall.name,
              input: part.functionCall.args ?? {},
              signature: part.thoughtSignature,
            });
          }
        }
      }
    }

    yield {
      type: 'turn',
      turn: { text, toolCalls, usage: { input: usageIn, output: usageOut }, stopReason },
    };
  }
}
