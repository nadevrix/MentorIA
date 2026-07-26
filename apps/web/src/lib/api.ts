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

export interface Health {
  ok: boolean;
  dataSource: string;
  /** Qué hay debajo de la superposición: Postgres o los datos de ejemplo. */
  baseSource: string;
  fxSource: string;
  llm: { provider: string; model: string } | { error: string };
  imageProvider: string | null;
  agents: number;
}

/** Estado real del servidor, para que Ajustes no tenga que adivinarlo. */
export async function fetchHealth(): Promise<Health> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error('El servidor no responde');
  return res.json();
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

export type Severity = 'critica' | 'alta' | 'media' | 'baja';

export interface Insight {
  id: string;
  tipo: string;
  severidad: Severity;
  titulo: string;
  detalle: string;
  impactoBob: number;
  impactoNota: string;
  agenteId: string;
  pregunta: string;
  entidades?: { productos?: string[]; clientes?: string[] };
}

export interface InsightsResponse {
  generadoEn: string;
  totalImpactoBob: number;
  insights: Insight[];
}

export async function fetchInsights(): Promise<InsightsResponse> {
  const res = await fetch(`${API_URL}/api/insights`);
  if (!res.ok) throw new Error('No se pudieron cargar los hallazgos');
  return res.json();
}

export interface ScenarioProduct {
  id: string;
  nombre: string;
  precioActualBob: number;
  costoEscenarioBob: number;
  margenEscenarioPct: number;
  precioSugeridoBob: number;
  ajusteNecesarioPct: number;
  bajoCostoEnEscenario: boolean;
}

export interface ScenarioResult {
  escenario: { tipoCambioActual: number; tipoCambioSimulado: number; variacionPct: number };
  margenObjetivoPct: number;
  productosBajoCosto: { antes: number; despues: number };
  margenPromedioPct: { antes: number; despues: number };
  utilidadMensualBob: { antes: number; despues: number; delta: number };
  capitalAdicionalBob: number;
  ajustePromedioNecesarioPct: number;
  productos: ScenarioProduct[];
}

export interface MarketingCandidate {
  id: string;
  nombre: string;
  categoria: string;
  razon: 'liquidar' | 'empujar' | 'estrella';
  precioBob: number;
  margenRealPct: number;
  stock: number;
  unidades30d: number;
  diasSinVender: number | null;
  capitalInmovilizadoBob: number;
  descuentoMaximoPct: number;
}

export interface MarketingResponse {
  totalProductos: number;
  promocionables: number;
  descartados: number;
  notaDescartados: string;
  candidatos: MarketingCandidate[];
}

export async function fetchMarketing(): Promise<MarketingResponse> {
  const res = await fetch(`${API_URL}/api/marketing`);
  if (!res.ok) throw new Error('No se pudo cargar el panel de marketing');
  return res.json();
}

export interface Obligacion {
  tipo: 'iva' | 'it' | 'iue';
  nombre: string;
  periodo: string;
  montoBob: number;
  vencimiento: string;
  diasParaVencer: number;
  estado: 'vencida' | 'proxima' | 'programada';
  formula: string;
  supuesto?: string;
}

export interface TaxSummary {
  regimen: 'general' | 'simplificado';
  digitoNit: number;
  totalPorPagarBob: number;
  vencidasBob: number;
  obligaciones: Obligacion[];
  base: {
    ventasMesBob: number;
    comprasConFacturaMesBob: number;
    ventasAnioBob: number;
    utilidadAnioBob: number;
  };
  advertencia: string;
}

export async function fetchTaxes(
  digitoNit: number,
  regimen: 'general' | 'simplificado',
): Promise<TaxSummary> {
  const res = await fetch(`${API_URL}/api/taxes?digitoNit=${digitoNit}&regimen=${regimen}`);
  if (!res.ok) throw new Error('No se pudieron calcular los impuestos');
  return res.json();
}

export interface FormularioSin {
  numero: string;
  nombre: string;
  version: string | null;
  esBoleta: boolean;
  periodicidad: string | null;
  url: string;
}

export interface CatalogoSin {
  fuente: string;
  obtenidoEn: string;
  nota: string;
  impuestos: {
    impuesto: string;
    grava: string | null;
    alcance: string | null;
    formularios: FormularioSin[];
  }[];
}

export async function fetchFormularios(): Promise<CatalogoSin> {
  const res = await fetch(`${API_URL}/api/taxes/formularios`);
  if (!res.ok) throw new Error('No se pudo cargar el catálogo de formularios');
  return res.json();
}

export interface ImageResult {
  ok: boolean;
  prompt: string;
  dataUri?: string;
  proveedor?: string;
  motivo?: string;
}

export interface ImagenReferencia {
  rol: 'producto' | 'logo';
  mime: string;
  /** Base64 sin el encabezado `data:`. */
  base64: string;
}

export async function generateImage(
  prompt: string,
  referencias: ImagenReferencia[] = [],
  signal?: AbortSignal,
): Promise<ImageResult> {
  const res = await fetch(`${API_URL}/api/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, referencias }),
    signal,
  });
  if (res.status === 413) throw new Error('Las fotos pesan demasiado. Probá con imágenes más chicas.');
  if (!res.ok) throw new Error('No se pudo generar la imagen');
  return res.json();
}

export async function simulate(
  tipoCambioSimulado: number,
  margenObjetivoPct?: number,
  signal?: AbortSignal,
): Promise<ScenarioResult> {
  const res = await fetch(`${API_URL}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipoCambioSimulado, margenObjetivoPct }),
    signal,
  });
  if (!res.ok) throw new Error('No se pudo simular el escenario');
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
  yield* readSSE(res);
}

/** Resumen del día: los hallazgos deterministas, redactados por el Director. */
export async function* streamBrief(signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  const res = await fetch(`${API_URL}/api/brief`, { signal });
  yield* readSSE(res);
}

async function* readSSE(res: Response): AsyncGenerator<AgentEvent> {
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

/**
 * Cuántos trámites obligatorios faltan, para el aviso de la pestaña.
 *
 * Usa el perfil por defecto (S.R.L., sin empleados): es el mismo con el que
 * abre el panel, así el número de la pestaña coincide con lo que se ve dentro.
 */
export async function fetchPendientesFormalizacion(): Promise<number> {
  const res = await fetch(`${API_URL}/api/formalizacion`);
  if (!res.ok) throw new Error('No se pudo consultar los trámites');
  const json = (await res.json()) as { faltantes: unknown[] };
  return json.faltantes.length;
}

export const bob = (n: number): string =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
