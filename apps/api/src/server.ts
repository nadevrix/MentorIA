import { serve } from '@hono/node-server';
import { timingSafeEqual } from 'node:crypto';
import {
  AGENTS,
  buildDashboard,
  buildInsights,
  buildTaxes,
  ComplianceStore,
  resumenFormalizacion,
  createContext,
  generateImage,
  imageProviderConfigured,
  overlayOf,
  runAgent,
  simulateScenario,
  streamBrief,
  taxForms,
  formulariosDelRegimen,
  TOOLS_BY_NAME,
  createLlmProvider,
  dispatchZavuAlerts,
  getWallbitCoverage,
  wallbitConfigured,
  zavuIntegrationStatus,
} from '@pyme/core';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

const app = new Hono();
const ctx = createContext();

const origin = process.env.CORS_ORIGIN ?? '*';
const corsOptions = {
  origin: origin === '*' ? '*' : origin.split(',').map((o) => o.trim()),
};
app.use('/health', cors(corsOptions));
app.use('/api/*', cors(corsOptions));

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const ZAVU_ALERTS_AUTO = process.env.ZAVU_ALERTS_AUTO?.toLowerCase() === 'true';
const configuredAlertHour = Number(process.env.ZAVU_ALERT_HOUR);
const ZAVU_ALERT_HOUR =
  Number.isInteger(configuredAlertHour) && configuredAlertHour >= 0 && configuredAlertHour <= 23
    ? configuredAlertHour
    : 8;
const ZAVU_ALERT_TIMEZONE = 'America/La_Paz';
let lastScheduledAlertDate: string | null = null;
let scheduledAlertRunning = false;

function alertLocalClock(now = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZAVU_ALERT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
  };
}

/**
 * En una sola instancia Starter alcanza con un reloj local. La clave de
 * idempotencia diaria evita duplicados incluso si Render reinicia el proceso.
 */
async function maybeDispatchScheduledAlert(now = new Date()): Promise<void> {
  if (!ZAVU_ALERTS_AUTO || scheduledAlertRunning) return;
  const clock = alertLocalClock(now);
  if (clock.hour < ZAVU_ALERT_HOUR || lastScheduledAlertDate === clock.date) return;

  scheduledAlertRunning = true;
  lastScheduledAlertDate = clock.date;
  try {
    const result = await dispatchZavuAlerts(ctx, {
      idempotencyKeyPrefix: `daily-${clock.date}`,
    });
    const log = result.ok ? console.log : console.warn;
    log(`[zavu-scheduler] ${result.message}`);
  } catch (error) {
    console.error(
      '[zavu-scheduler]',
      error instanceof Error ? error.message : 'No se pudo ejecutar la alerta diaria.',
    );
  } finally {
    scheduledAlertRunning = false;
  }
}

function startZavuAlertScheduler(): void {
  if (!ZAVU_ALERTS_AUTO) return;
  console.log(
    `  alertas Zavu: todos los días a las ${String(ZAVU_ALERT_HOUR).padStart(2, '0')}:00 (${ZAVU_ALERT_TIMEZONE})`,
  );
  const initial = setTimeout(() => void maybeDispatchScheduledAlert(), 3_000);
  const interval = setInterval(() => void maybeDispatchScheduledAlert(), 60_000);
  initial.unref();
  interval.unref();
}

const AI_RATE_LIMIT_MAX = positiveInteger('AI_RATE_LIMIT_MAX', 6);
const AI_RATE_LIMIT_WINDOW_MS = positiveInteger('AI_RATE_LIMIT_WINDOW_MS', 60_000);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
let nextRateSweepAt = Date.now() + AI_RATE_LIMIT_WINDOW_MS;

/** Límite simple por IP: suficiente para una sola instancia de demo en Render. */
const limitAiRequests: MiddlewareHandler = async (c, next) => {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || c.req.header('x-real-ip') || 'local';
  const key = `${ip}:${c.req.path}`;
  const now = Date.now();

  if (now >= nextRateSweepAt) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    nextRateSweepAt = now + AI_RATE_LIMIT_WINDOW_MS;
  }

  const current = rateBuckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + AI_RATE_LIMIT_WINDOW_MS };

  bucket.count++;
  rateBuckets.set(key, bucket);

  if (bucket.count > AI_RATE_LIMIT_MAX) {
    c.header('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return c.json({ error: 'Demasiadas solicitudes. Esperá un momento y volvé a intentar.' }, 429);
  }

  await next();
};

/**
 * Las integraciones sponsor usan credenciales financieras o pueden generar
 * costos. La interfaz pide esta clave en cada sesión; nunca va en el bundle.
 */
const requireSponsorSecret: MiddlewareHandler = async (c, next) => {
  const expected = process.env.SPONSOR_DEMO_SECRET?.trim();
  if (!expected) {
    return c.json({ error: 'Falta configurar SPONSOR_DEMO_SECRET en el servidor.' }, 503);
  }

  const provided = c.req.header('x-sponsor-demo-secret')?.trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided ?? '');
  const valid =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  if (!valid) return c.json({ error: 'Clave de demostración incorrecta.' }, 401);
  await next();
};

const jsonBodyLimit = bodyLimit({
  maxSize: positiveInteger('MAX_JSON_BODY_BYTES', 128 * 1024),
  onError: (c) => c.json({ error: 'El cuerpo de la petición es demasiado grande.' }, 413),
});
const csvBodyLimit = bodyLimit({
  maxSize: positiveInteger('MAX_CSV_BODY_BYTES', 2 * 1024 * 1024),
  onError: (c) => c.json({ error: 'El CSV supera el límite permitido.' }, 413),
});

app.use('/api/brief', limitAiRequests);
app.use('/api/chat', limitAiRequests, jsonBodyLimit);
// Límite propio: el cuerpo lleva hasta dos fotos en base64, que no entran en
// los 128 KiB del JSON común.
const imageBodyLimit = bodyLimit({
  maxSize: positiveInteger('MAX_IMAGE_BODY_BYTES', 8 * 1024 * 1024),
  onError: (c) => c.json({ error: 'Las imágenes superan el límite permitido.' }, 413),
});
app.use('/api/image', limitAiRequests, imageBodyLimit);
app.use('/api/simulate', jsonBodyLimit);
app.use('/api/alerts/dispatch', limitAiRequests, jsonBodyLimit, requireSponsorSecret);
app.use('/api/wallbit/coverage', limitAiRequests, jsonBodyLimit, requireSponsorSecret);
app.use('/api/formalizacion/*', jsonBodyLimit);
app.use('/api/data/*', csvBodyLimit);

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
    // Sin esto, /health siempre dice "overlay" y esconde si abajo hay Postgres
    // o los JSON de ejemplo — justo lo que uno necesita saber al depurar.
    baseSource: overlayOf(ctx)?.baseName ?? ctx.data.name,
    fxSource: ctx.fx.name,
    llm,
    imageProvider: imageProviderConfigured(),
    zavu: {
      ...zavuIntegrationStatus(),
      automatic: {
        enabled: ZAVU_ALERTS_AUTO,
        hour: ZAVU_ALERT_HOUR,
        timeZone: ZAVU_ALERT_TIMEZONE,
        lastRunDate: lastScheduledAlertDate,
      },
    },
    wallbit: { configured: wallbitConfigured() },
    sponsorDemoProtected: Boolean(process.env.SPONSOR_DEMO_SECRET?.trim()),
    agents: AGENTS.length,
  });
});

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

/**
 * Distribuye el hallazgo más urgente por todos los canales Zavu configurados.
 * El destinatario vive en variables del servidor: este endpoint nunca es un
 * relay abierto hacia números o correos arbitrarios.
 */
app.post('/api/alerts/dispatch', async (c) => {
  try {
    return c.json(await dispatchZavuAlerts(ctx));
  } catch (error) {
    console.error('[zavu-alerts]', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'No se pudo enviar la alerta.' },
      502,
    );
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

const WallbitCoverageRequest = z.object({
  capitalAdicionalBob: z.number().min(0).max(1_000_000_000),
  tipoCambioEscenario: z.number().positive().max(1000),
});

/**
 * Compara un escenario ya calculado con el saldo USD real. Está separado del
 * simulador para no consultar Wallbit con cada movimiento del deslizador.
 */
app.post('/api/wallbit/coverage', async (c) => {
  const parsed = WallbitCoverageRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Petición inválida', detalle: parsed.error.flatten() }, 400);
  }
  try {
    return c.json(await getWallbitCoverage(parsed.data));
  } catch (error) {
    console.error('[wallbit-coverage]', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'No se pudo consultar Wallbit.' },
      502,
    );
  }
});

/**
 * El resumen del día: los hallazgos deterministas, redactados por el Director.
 * Va por SSE porque son las primeras frases que se ven al abrir la app y no
 * queremos que el usuario mire una pantalla en blanco mientras el modelo escribe.
 */
app.get('/api/brief', async (c) => {
  let provider;
  try {
    provider = createLlmProvider();
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'No hay proveedor de modelo disponible.' },
      500,
    );
  }

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    try {
      for await (const event of streamBrief({ ctx, provider, signal: controller.signal })) {
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

const compliance = new ComplianceStore();

/** Qué trámites necesita la empresa y cuáles ya tiene resueltos. */
app.get('/api/formalizacion', async (c) => {
  try {
    return c.json(
      await resumenFormalizacion(compliance, {
        tipo: c.req.query('tipo') ?? 'srl',
        conEmpleados: c.req.query('empleados') === 'true',
        rubros: (c.req.query('rubros') ?? '').split(',').filter(Boolean),
      }),
    );
  } catch (error) {
    console.error('[formalizacion]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});

const ComplianceRequest = z.object({
  estado: z.enum(['pendiente', 'hecho', 'no_aplica']),
  nota: z.string().max(500).nullable().optional(),
  vence: z.string().max(10).nullable().optional(),
});

/** Marca un trámite como hecho, pendiente o no aplicable. */
app.put('/api/formalizacion/:itemId', async (c) => {
  const parsed = ComplianceRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Petición inválida', detalle: parsed.error.flatten() }, 400);
  }
  try {
    await compliance.guardar({
      itemId: c.req.param('itemId'),
      estado: parsed.data.estado,
      nota: parsed.data.nota ?? null,
      vence: parsed.data.vence ?? null,
    });
    return c.json({ ok: true });
  } catch (error) {
    console.error('[formalizacion]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error al guardar' }, 500);
  }
});

/** Catálogo de formularios del SIN, raspado de la página oficial. */
app.get('/api/taxes/formularios', async (c) => {
  const cat = await taxForms();
  const regimen = c.req.query('regimen');
  if (regimen === 'general' || regimen === 'simplificado') {
    return c.json({ ...cat, impuestos: await formulariosDelRegimen(regimen) });
  }
  return c.json(cat);
});

const ENTIDADES = ['products', 'sales', 'customers', 'expenses'] as const;
const overlay = overlayOf(ctx);

/** Qué datos está usando el sistema: propios, ejemplo o vacío. */
app.get('/api/data', async (c) => {
  if (!overlay) return c.json({ error: 'La fuente de datos no admite superposición' }, 400);
  return c.json({ entidades: await overlay.status() });
});

/**
 * Importa un CSV para una entidad. El cuerpo es el CSV crudo, no JSON:
 * evita tener que escapar comillas y saltos de línea de un archivo real.
 * Con DATA_SOURCE=postgres la importación se guarda en la base.
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
    return c.json(await overlay.importCsv(entidad as (typeof ENTIDADES)[number], csv));
  } catch (error) {
    console.error('[data]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error al importar' }, 500);
  }
});

/** Vacía la entidad en Postgres, o vuelve al ejemplo si la base es seed. */
app.delete('/api/data/:entidad', async (c) => {
  if (!overlay) return c.json({ error: 'La fuente de datos no admite superposición' }, 400);
  const entidad = c.req.param('entidad');
  try {
    await overlay.reset(
      entidad === 'todo' ? undefined : (entidad as (typeof ENTIDADES)[number]),
    );
    return c.json({ entidades: await overlay.status() });
  } catch (error) {
    console.error('[data]', error);
    return c.json({ error: error instanceof Error ? error.message : 'Error al vaciar' }, 500);
  }
});

const ImageRequest = z.object({
  prompt: z.string().min(3).max(4000),
  /**
   * Fotos que adjunta el comercio: su producto y su logo. Como máximo dos, y
   * sólo formatos de imagen conocidos: esto termina en un proveedor externo,
   * así que no se le reenvía cualquier cosa que llegue.
   */
  referencias: z
    .array(
      z.object({
        rol: z.enum(['producto', 'logo']),
        mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
        base64: z.string().min(1).max(4_000_000),
      }),
    )
    .max(2)
    .optional(),
});

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
  return c.json(await generateImage(parsed.data.prompt, parsed.data.referencias ?? []));
});

const ChatRequest = z.object({
  agentId: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8_000),
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
  console.log(`Mentor IA API escuchando en http://localhost:${info.port}`);
  console.log(`  datos: ${ctx.data.name} · tipo de cambio: ${ctx.fx.name}`);
  startZavuAlertScheduler();
  try {
    const p = createLlmProvider();
    console.log(`  modelo: ${p.name} · ${p.model}`);
  } catch (e) {
    console.warn(`  ⚠ ${e instanceof Error ? e.message : e}: /api/chat devolverá 500.`);
  }
});
