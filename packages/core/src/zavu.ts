import { z } from 'zod';
import { buildInsights, type Insight } from './insights.js';
import type { ToolContext } from './tools/registry.js';

const ZAVU_MESSAGES_URL = 'https://api.zavu.dev/v1/messages';
const ZAVU_TIMEOUT_MS = 10_000;

export type ZavuAlertChannel = 'email' | 'telegram';

export interface ZavuIntegrationStatus {
  configured: boolean;
  channels: ZavuAlertChannel[];
}

export interface ZavuDelivery {
  channel: ZavuAlertChannel;
  recipient: string;
  ok: boolean;
  messageId?: string;
  status?: string;
  error?: string;
}

export interface ZavuAlertResult {
  ok: boolean;
  configured: boolean;
  message: string;
  insight?: {
    id: string;
    severidad: Insight['severidad'];
    titulo: string;
  };
  deliveries: ZavuDelivery[];
}

export interface ZavuDispatchOptions {
  /**
   * Cuando existe, Zavu evita repetir el mismo hallazgo y canal para esa
   * ejecución lógica. El envío manual lo omite; el programado usa fecha local.
   */
  idempotencyKeyPrefix?: string;
}

const ZavuResponseSchema = z.object({
  message: z.object({
    id: z.string(),
    status: z.string(),
    channel: z.string().optional(),
  }),
});

function apiKey(): string | undefined {
  return process.env.ZAVUDEV_API_KEY?.trim() || process.env.ZAVU_API_KEY?.trim() || undefined;
}

function configuredDestinations(): { channel: ZavuAlertChannel; to: string }[] {
  const destinations: { channel: ZavuAlertChannel; to: string }[] = [];
  const email = process.env.ZAVU_ALERT_EMAIL?.trim();
  const telegram = process.env.ZAVU_TELEGRAM_CHAT_ID?.trim();

  if (telegram) destinations.push({ channel: 'telegram', to: telegram });
  if (email) destinations.push({ channel: 'email', to: email });
  return destinations;
}

/** Estado seguro para /health: nunca expone claves ni destinatarios. */
export function zavuIntegrationStatus(): ZavuIntegrationStatus {
  const channels = configuredDestinations().map((destination) => destination.channel);
  return { configured: Boolean(apiKey()) && channels.length > 0, channels };
}

function maskRecipient(to: string, channel: ZavuAlertChannel): string {
  if (channel === 'email') {
    const [local, domain] = to.split('@');
    return domain ? `${local?.slice(0, 1) || '*'}***@${domain}` : '***';
  }
  return to.length > 4 ? `***${to.slice(-4)}` : '***';
}

function severityLabel(severity: Insight['severidad']): string {
  switch (severity) {
    case 'critica':
      return 'ALERTA CRÍTICA';
    case 'alta':
      return 'ALERTA ALTA';
    case 'media':
      return 'Aviso';
    default:
      return 'Seguimiento';
  }
}

function alertText(insight: Insight): string {
  const impacto = insight.impactoBob.toLocaleString('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const context = process.env.ZAVU_ALERT_CONTEXT?.trim();
  return [
    `Mentor IA · ${severityLabel(insight.severidad)}`,
    ...(context ? [context] : []),
    insight.titulo,
    insight.detalle,
    `Impacto estimado: Bs ${impacto}.`,
    `Siguiente acción: ${insight.pregunta}`,
  ]
    .join('\n\n')
    .slice(0, 3_800);
}

async function providerError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { message?: unknown; error?: { message?: unknown } | unknown }
    | null;
  const nestedMessage =
    typeof body?.error === 'object' && body.error !== null && 'message' in body.error
      ? body.error.message
      : undefined;
  const detail =
    typeof nestedMessage === 'string'
      ? nestedMessage
      : typeof body?.message === 'string'
        ? body.message
        : undefined;

  if (response.status === 401) return 'La clave de Zavu no es válida.';
  if (response.status === 403) return 'La clave de Zavu no permite enviar mensajes.';
  if (response.status === 429) return 'Zavu alcanzó temporalmente su límite de envíos.';
  return detail?.slice(0, 240) || `Zavu respondió con estado ${response.status}.`;
}

async function sendMessage(
  insight: Insight,
  destination: { channel: ZavuAlertChannel; to: string },
  options: ZavuDispatchOptions,
): Promise<ZavuDelivery> {
  const key = apiKey();
  if (!key) throw new Error('Falta ZAVUDEV_API_KEY.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const senderId = process.env.ZAVU_SENDER_ID?.trim();
  if (senderId) headers['Zavu-Sender'] = senderId;

  const body: Record<string, string> = {
    to: destination.to,
    channel: destination.channel,
    text: alertText(insight),
  };
  if (options.idempotencyKeyPrefix) {
    body.idempotencyKey =
      `${options.idempotencyKeyPrefix}:${insight.id}:${destination.channel}`
        .replace(/[^a-zA-Z0-9:_-]/g, '-')
        .slice(0, 240);
  }
  if (destination.channel === 'email') {
    body.subject = `Mentor IA: ${insight.titulo}`.slice(0, 180);
  }

  try {
    const response = await fetch(ZAVU_MESSAGES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ZAVU_TIMEOUT_MS),
    });
    if (response.status === 409 && options.idempotencyKeyPrefix) {
      return {
        channel: destination.channel,
        recipient: maskRecipient(destination.to, destination.channel),
        ok: true,
        status: 'ya enviada',
      };
    }
    if (!response.ok) throw new Error(await providerError(response));

    const parsed = ZavuResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Zavu devolvió una respuesta inesperada.');

    return {
      channel: destination.channel,
      recipient: maskRecipient(destination.to, destination.channel),
      ok: true,
      messageId: parsed.data.message.id,
      status: parsed.data.message.status,
    };
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === 'TimeoutError';
    return {
      channel: destination.channel,
      recipient: maskRecipient(destination.to, destination.channel),
      ok: false,
      error: timeout
        ? 'Zavu tardó demasiado en responder.'
        : error instanceof Error
          ? error.message
          : 'No se pudo enviar el mensaje.',
    };
  }
}

/**
 * Elige el hallazgo más urgente y lo distribuye por todos los canales
 * configurados. Los números vienen del motor determinista; Zavu sólo entrega.
 */
export async function dispatchZavuAlerts(
  ctx: ToolContext,
  options: ZavuDispatchOptions = {},
): Promise<ZavuAlertResult> {
  const destinations = configuredDestinations();
  const configured = Boolean(apiKey()) && destinations.length > 0;
  if (!configured) {
    return {
      ok: false,
      configured: false,
      message: 'Configura ZAVUDEV_API_KEY y al menos un destinatario de alerta.',
      deliveries: [],
    };
  }

  const report = await buildInsights(ctx);
  const insight =
    report.insights.find((item) => item.severidad === 'critica') ??
    report.insights.find((item) => item.severidad === 'alta') ??
    report.insights[0];

  if (!insight) {
    return {
      ok: true,
      configured: true,
      message: 'No hay hallazgos que requieran una alerta.',
      deliveries: [],
    };
  }

  const deliveries = await Promise.all(
    destinations.map((destination) => sendMessage(insight, destination, options)),
  );
  const delivered = deliveries.filter((delivery) => delivery.ok).length;

  return {
    ok: delivered > 0 && delivered === deliveries.length,
    configured: true,
    message:
      delivered === deliveries.length
        ? `Alerta enviada por ${delivered} canal${delivered === 1 ? '' : 'es'}.`
        : `Se entregaron ${delivered} de ${deliveries.length} canales.`,
    insight: {
      id: insight.id,
      severidad: insight.severidad,
      titulo: insight.titulo,
    },
    deliveries,
  };
}
