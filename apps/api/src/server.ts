import { serve } from '@hono/node-server';
import { AGENTS, buildDashboard, createContext, createLlmProvider, runAgent } from '@pyme/core';
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

app.get('/health', (c) => {
  // Se resuelve el proveedor acá, no al arrancar: /health tiene que responder
  // igual aunque falte la clave, para poder diagnosticar el problema.
  let llm: { provider: string; model: string } | { error: string };
  try {
    const p = createLlmProvider();
    llm = { provider: p.name, model: p.model };
  } catch (e) {
    llm = { error: e instanceof Error ? e.message : 'proveedor no disponible' };
  }

  return c.json({
    ok: true,
    dataSource: ctx.data.name,
    fxSource: ctx.fx.name,
    llm,
    agents: AGENTS.length,
  });
});

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
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'El servidor no tiene ninguna API key de modelo configurada.' }, 500);
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
  console.log(`PyME AI API escuchando en http://localhost:${info.port}`);
  console.log(`  datos: ${ctx.data.name} · tipo de cambio: ${ctx.fx.name}`);
  try {
    const p = createLlmProvider();
    console.log(`  modelo: ${p.name} · ${p.model}`);
  } catch (e) {
    console.warn(`  ⚠ ${e instanceof Error ? e.message : e}: /api/chat devolverá 500.`);
  }
});
