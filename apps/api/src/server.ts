import { serve } from '@hono/node-server';
import {
  AGENTS,
  buildDashboard,
  buildInsights,
  buildTaxes,
  createContext,
  generateImage,
  imageProviderConfigured,
  overlayOf,
  runAgent,
  simulateScenario,
  streamBrief,
  TOOLS_BY_NAME,
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
    // Sin esto, /health siempre dice "overlay" y esconde si abajo hay Postgres
    // o los JSON de ejemplo — justo lo que uno necesita saber al depurar.
    baseSource: overlayOf(ctx)?.baseName ?? ctx.data.name,
    fxSource: ctx.fx.name,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    imageProvider: imageProviderConfigured(),
    agents: AGENTS.length,
  }),
);

/** Qué conviene promocionar, calculado sin modelo. */
app.get('/api/marketing', async (c) => {
  try {
    const tool = TOOLS_BY_NAME.get('marketing_candidates');
    if (!tool) throw new Error('Herramienta marketing_candidates no registrada');
    return c.json(await tool.run(tool.parse.parse({ limite: 8 }) as never, ctx));
  } catch (error) {
    console.error('[marketing]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
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

/**
 * Obligaciones tributarias estimadas.
 *
 * El día de vencimiento depende del último dígito del NIT, así que viaja como
 * parámetro: no guardamos el NIT del comercio en ningún lado.
 */
app.get('/api/taxes', async (c) => {
  const digito = Number(c.req.query('digitoNit') ?? 0);
  const regimen = c.req.query('regimen') === 'simplificado' ? 'simplificado' : 'general';
  try {
    return c.json(
      await buildTaxes(ctx, {
        digitoNit: Number.isInteger(digito) && digito >= 0 && digito <= 9 ? digito : 0,
        regimen,
      }),
    );
  } catch (error) {
    console.error('[taxes]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});

const ENTIDADES = ['products', 'sales', 'customers', 'expenses'] as const;
const overlay = overlayOf(ctx);

/** Qué datos está usando el sistema: los del comercio o los de ejemplo. */
app.get('/api/data', async (c) => {
  if (!overlay) return c.json({ error: 'La fuente de datos no admite superposición' }, 400);
  return c.json({ entidades: await overlay.status() });
});

/**
 * Importa un CSV para una entidad. El cuerpo es el CSV crudo, no JSON:
 * evita tener que escapar comillas y saltos de línea de un archivo real.
 */
app.post('/api/data/:entidad', async (c) => {
  if (!overlay) return c.json({ error: 'La fuente de datos no admite superposición' }, 400);

  const entidad = c.req.param('entidad');
  if (!(ENTIDADES as readonly string[]).includes(entidad)) {
    return c.json({ error: `Entidad desconocida. Válidas: ${ENTIDADES.join(', ')}` }, 400);
  }

  const csv = await c.req.text();
  if (!csv.trim()) return c.json({ error: 'El archivo llegó vacío' }, 400);

  try {
    return c.json(overlay.importCsv(entidad as (typeof ENTIDADES)[number], csv));
  } catch (error) {
    console.error('[data]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error al importar' }, 500);
  }
});

/** Vuelve a los datos de ejemplo. */
app.delete('/api/data/:entidad', async (c) => {
  if (!overlay) return c.json({ error: 'La fuente de datos no admite superposición' }, 400);
  const entidad = c.req.param('entidad');
  overlay.reset(
    entidad === 'todo' ? undefined : (entidad as (typeof ENTIDADES)[number]),
  );
  return c.json({ entidades: await overlay.status() });
});

const ImageRequest = z.object({ prompt: z.string().min(3).max(4000) });

/**
 * Convierte en imagen un prompt escrito por el agente.
 *
 * Devuelve 200 aunque no haya proveedor configurado: no tener generador no es
 * un error del cliente, y el prompt por sí solo ya sirve. El frontend decide
 * si muestra la imagen o el prompt para copiar.
 */
app.post('/api/image', async (c) => {
  const parsed = ImageRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Petición inválida', detalle: parsed.error.flatten() }, 400);
  }
  return c.json(await generateImage(parsed.data.prompt));
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
