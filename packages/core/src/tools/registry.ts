import type { z } from 'zod';
import type { DataSource } from '../data/source.js';
import type { FxProvider } from '../fx/provider.js';

/** Todo lo que una herramienta necesita para ejecutarse. */
export interface ToolContext {
  data: DataSource;
  fx: FxProvider;
}

export interface ToolDefinition<TInput = unknown> {
  name: string;
  /** Descripción que lee Claude para decidir CUÁNDO llamarla. Sé prescriptivo. */
  description: string;
  /** JSON Schema que se envía a la API. */
  inputSchema: Record<string, unknown>;
  /** Validación en runtime del input que devuelve el modelo. */
  parse: z.ZodType<TInput>;
  run(input: TInput, ctx: ToolContext): Promise<unknown>;
}

export function defineTool<TInput>(def: ToolDefinition<TInput>): ToolDefinition<TInput> {
  return def;
}

/** Azúcar para escribir JSON Schemas de objetos sin repetirse. */
export function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required };
}
