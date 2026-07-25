import { serve } from '@hono/node-server';
import {
  AGENTS,
  buildDashboard,
  buildInsights,
  createContext,
  runAgent,
  simulateScenario,
  streamBrief,
} from '@pyme/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

const app = new Hono();
const ctx = createContext();

const origin = process.env.CORS_ORIGIN ?? '*';
app.use(
  '/api/*',
  cors({ origin: origin === '*' ? '*' : origin.split(',').map((o) => o.trim()) }),
);

app.get('/health', (c) =>
  c.json({
    ok: true,
    dataSource: ctx.data.name,
    fxSource: ctx.fx.name,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    agents: AGENTS.length,
  }),
);

app.get('/api/agents', (c) =>
  c.json(
    AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      tagline: a.tagline,
      tools: a.tools,
      examples: a.examples,
    })),
  ),
);

app.get('/api/dashboard', async (c) => {
  try {
    return c.json(await buildDashboard(ctx));
  } catch (error) {
    console.error('[dashboard]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});

/**
 * Hallazgos proactivos, ordenados por plata en juego. Sin modelo: es detección
 * determinista, así que responde en milisegundos y no gasta tokens.
 */
app.get('/api/insights', async (c) => {
  try {
    return c.json(await buildInsights(ctx));
  } catch (error) {
    console.error('[insights]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});

const SimulateRequest = z.object({
  tipoCambioSimulado: z.number().positive().max(1000),
  margenObjetivoPct: z.number().min(0).max(95).optional(),
  limite: z.number().int().positive().max(200).optional(),
});

/** "¿Qué pasa si el dólar llega a X?" sobre el catálogo completo. */
app.post('/api/simulate', async (c) => {
  const parsed = SimulateRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Petición inválida', detalle: parsed.error.flatten() }, 400);
  }
  try {
    return c.json(await simulateScenario(ctx, parsed.data));
  } catch (error) {
    console.error('[simulate]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});

/**
 * El resumen del día: los hallazgos deterministas, redactados por el Director.
 * Va por SSE porque son las primeras frases que se ven al abrir la app y no
 * queremos que el usuario mire una pantalla en blanco mientras el modelo escribe.
 */
app.get('/api/brief', async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' }, 500);
  }

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    try {
      for await (const event of streamBrief({ ctx, signal: controller.signal })) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      }
    } catch (error) {
      console.error('[brief]', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Error desconocido',
        }),
      });
    }
  });
});

const ChatRequest = z.object({
  agentId: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(40),
});

/**
 * Chat con un agente. Responde Server-Sent Events: cada evento del loop
 * (texto, uso de herramienta, resultado) llega al frontend en vivo.
 */
app.post('/api/chat', async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' }, 500);
  }

  const parsed = ChatRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Petición inválida', detalle: parsed.error.flatten() }, 400);
  }

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    try {
      for await (const event of runAgent({
        agentId: parsed.data.agentId,
        messages: parsed.data.messages,
        ctx,
        signal: controller.signal,
      })) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      }
    } catch (error) {
      console.error('[chat]', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Error desconocido',
        }),
      });
    }
  });
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Mentor IA API escuchando en http://localhost:${info.port}`);
  console.log(`  datos: ${ctx.data.name} · tipo de cambio: ${ctx.fx.name}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ⚠ ANTHROPIC_API_KEY no está configurada: /api/chat devolverá 500.');
  }
});
