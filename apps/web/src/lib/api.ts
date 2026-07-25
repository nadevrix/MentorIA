export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

export interface Agent {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  tools: string[];
  examples: string[];
}

export type AgentEvent =
  | { type: 'start'; agentId: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; output: unknown; isError: boolean }
  | { type: 'done'; stopReason: string | null; usage: { input: number; output: number } }
  | { type: 'error'; message: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_URL}/api/agents`);
  if (!res.ok) throw new Error('No se pudieron cargar los agentes');
  return res.json();
}

export async function fetchDashboard(): Promise<Record<string, any>> {
  const res = await fetch(`${API_URL}/api/dashboard`);
  if (!res.ok) throw new Error('No se pudo cargar el panel');
  return res.json();
}

/**
 * Consume el stream SSE de /api/chat y entrega cada evento del agente.
 * Usamos fetch + ReadableStream (no EventSource) porque el endpoint es POST.
 */
export async function* streamChat(
  agentId: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`El servidor respondió ${res.status}. ${detail}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    // Los eventos SSE se separan por una línea en blanco.
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      try {
        yield JSON.parse(dataLine.slice(5).trim()) as AgentEvent;
      } catch {
        // Fragmento incompleto o keep-alive: ignorar.
      }
    }
  }
}

export const bob = (n: number): string =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
