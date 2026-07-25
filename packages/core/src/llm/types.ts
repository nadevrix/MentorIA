/**
 * Capa neutral de proveedor de modelo.
 *
 * El runtime de agentes habla SOLO con estos tipos, nunca con el SDK de un
 * proveedor concreto. Cambiar de Gemini a Claude (o al revés) es cambiar una
 * variable de entorno: no se toca ni una herramienta, ni un prompt, ni el loop.
 *
 * Esto existe por una razón práctica de demo: si el proveedor elegido falla o
 * rate-limitea en vivo, se cambia `LLM_PROVIDER` y el producto sigue andando.
 */

/** Definición de una herramienta tal como la ve el modelo. */
export interface LlmToolSchema {
  name: string;
  description: string;
  /** JSON Schema del input. Cada adaptador lo traduce a su formato. */
  inputSchema: Record<string, unknown>;
}

/** El modelo pidió ejecutar una herramienta. */
export interface LlmToolCall {
  /** Identificador del llamado. Gemini no los emite: el adaptador los sintetiza. */
  id: string;
  name: string;
  input: unknown;
  /**
   * Dato opaco del proveedor que hay que devolverle intacto al continuar la
   * conversación. Gemini 3.x rechaza el turno con un 400 si falta
   * (`thought_signature`). Los proveedores que no lo usan lo ignoran.
   */
  signature?: string;
}

/** Lo que devolvió la herramienta, listo para mandárselo de vuelta al modelo. */
export interface LlmToolResult {
  id: string;
  name: string;
  content: string;
  isError: boolean;
}

/** Historial de conversación, en formato neutral. */
export type LlmMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: LlmToolCall[] }
  | { role: 'tool'; results: LlmToolResult[] };

/** Resultado completo de un turno del modelo. */
export interface LlmTurn {
  text: string;
  toolCalls: LlmToolCall[];
  usage: { input: number; output: number };
  /** Motivo de corte informado por el proveedor, para diagnóstico. */
  stopReason: string | null;
}

/** Eventos que emite un turno mientras se genera. */
export type LlmStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'turn'; turn: LlmTurn };

export interface LlmStreamParams {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolSchema[];
  maxTokens: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  /** Nombre del proveedor: aparece en /health para saber qué está corriendo. */
  readonly name: string;
  readonly model: string;
  /**
   * Ejecuta un turno. Emite `text` mientras genera y termina SIEMPRE con un
   * único evento `turn` que trae el resultado completo.
   */
  stream(params: LlmStreamParams): AsyncGenerator<LlmStreamEvent>;
}
