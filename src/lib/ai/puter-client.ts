import { buildPuterLeadPrompt } from "@/lib/ai/puter-lead-prompt";
import { parseAILeadAnalysisResponse } from "@/lib/ai/parse-ai-json";
import type { AIExtractedLead, AILeadAnalysisResult } from "@/lib/validations/ai-lead-draft";

const DEFAULT_MODEL = "gpt-5.4-nano";
const PUTER_LOAD_TIMEOUT_MS = 10_000;
const PUTER_CHAT_TIMEOUT_MS = 75_000;

export type AnalyzeLeadWithPuterInput = {
  conversation: string;
  source: string;
  images?: string[];
  model?: string;
};

export function isPuterReady() {
  return typeof window !== "undefined" && typeof window.puter?.ai?.chat === "function";
}

export async function waitForPuter(timeoutMs = PUTER_LOAD_TIMEOUT_MS) {
  if (typeof window === "undefined") {
    throw new Error("A IA precisa ser carregada no navegador.");
  }

  if (isPuterReady()) return window.puter;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    if (isPuterReady()) return window.puter;
  }

  throw new Error("Nao consegui carregar a IA. Verifique sua conexao e tente novamente.");
}

export async function ensurePuterAuthorizedFromUserAction() {
  if (typeof window === "undefined") {
    throw new Error("A IA precisa ser carregada no navegador.");
  }

  if (!isPuterReady() || !window.puter) {
    throw new Error("A IA ainda esta carregando. Aguarde alguns segundos e tente novamente.");
  }

  const auth = window.puter.auth;
  if (!auth?.signIn || !auth.isSignedIn) return;
  if (auth.isSignedIn()) return;

  try {
    await auth.signIn({ attempt_temp_user_creation: true });
  } catch (error) {
    throw normalizePuterError(error, "O Puter pediu login/autorizacao. Conclua o acesso e tente novamente.");
  }
}

export async function analyzeLeadTextWithPuter({ prompt, model = DEFAULT_MODEL }: { prompt: string; model?: string }) {
  const puter = await waitForPuter();
  try {
    return await withPuterChatTimeout(puter?.ai.chat(prompt, { model }));
  } catch (error) {
    throw normalizePuterError(error, "Nao foi possivel analisar esse texto.");
  }
}

export async function analyzeLeadImageWithPuter({ image, prompt, model = DEFAULT_MODEL }: { image: string; prompt: string; model?: string }) {
  const puter = await waitForPuter();
  try {
    return await withPuterChatTimeout(puter?.ai.chat(prompt, image, { model }));
  } catch (error) {
    throw normalizePuterError(error, "Nao foi possivel analisar essa imagem.");
  }
}

async function withPuterChatTimeout<T>(promise: Promise<T> | undefined) {
  if (!promise) {
    throw new Error("Nao consegui iniciar a chamada da IA. Recarregue a pagina e tente novamente.");
  }

  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("A IA demorou demais para responder. Verifique se o Puter esta autorizado e tente novamente.")),
          PUTER_CHAT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export async function analyzeLeadWithPuter({ conversation, source, images = [], model = DEFAULT_MODEL }: AnalyzeLeadWithPuterInput): Promise<AILeadAnalysisResult> {
  const trimmedConversation = conversation.trim();
  const prompt = buildPuterLeadPrompt({ conversation: trimmedConversation, source, imageCount: images.length });

  if (!trimmedConversation && images.length === 0) {
    throw new Error("Envie uma imagem ou cole um texto antes de analisar.");
  }

  if (images.length === 0) {
    const response = await analyzeLeadTextWithPuter({ prompt, model });
    return parseAILeadAnalysisResponse(response);
  }

  const results: AILeadAnalysisResult[] = [];
  for (const [index, image] of images.entries()) {
    const imagePrompt = `${prompt}\n\nAnalise a imagem ${index + 1} de ${images.length}.`;
    const response = await analyzeLeadImageWithPuter({ image, prompt: imagePrompt, model });
    results.push(parseAILeadAnalysisResponse(response));
  }

  return mergeAnalysisResults(results);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nao foi possivel ler essa imagem."));
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler essa imagem."));
    reader.readAsDataURL(file);
  });
}

function mergeAnalysisResults(results: AILeadAnalysisResult[]): AILeadAnalysisResult {
  if (results.length === 0) {
    return { leads: [], summary: "", warnings: [] };
  }

  return {
    leads: mergeDuplicateLeads(results.flatMap((result) => result.leads)),
    summary: results.map((result) => result.summary).filter(Boolean).join("\n\n"),
    warnings: Array.from(new Set(results.flatMap((result) => result.warnings))),
  };
}

function mergeDuplicateLeads(leads: AIExtractedLead[]) {
  const merged = new Map<string, AIExtractedLead>();
  const order: string[] = [];

  for (const lead of leads) {
    const key = leadIdentityKey(lead);
    if (!merged.has(key)) {
      merged.set(key, lead);
      order.push(key);
      continue;
    }

    merged.set(key, mergeLeadFields(merged.get(key)!, lead));
  }

  return order.map((key) => merged.get(key)!);
}

function leadIdentityKey(lead: AIExtractedLead) {
  const phoneDigits = lead.phone.replace(/\D/g, "");
  if (phoneDigits.length >= 8) return `phone:${phoneDigits}`;

  const name = normalizeLeadText(lead.name);
  const city = normalizeLeadText(lead.city);
  const neighborhood = normalizeLeadText(lead.neighborhood);
  if (name) return `name:${name}|${city}|${neighborhood}`;

  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `unique:${randomId}`;
}

function mergeLeadFields(current: AIExtractedLead, incoming: AIExtractedLead): AIExtractedLead {
  return {
    name: bestText(current.name, incoming.name),
    phone: bestText(current.phone, incoming.phone),
    city: bestText(current.city, incoming.city),
    neighborhood: bestText(current.neighborhood, incoming.neighborhood),
    source: bestText(current.source, incoming.source),
    project_type: bestText(current.project_type, incoming.project_type),
    interest_type: bestText(current.interest_type, incoming.interest_type),
    has_land: mergeNullableBoolean(current.has_land, incoming.has_land),
    has_blueprint: mergeNullableBoolean(current.has_blueprint, incoming.has_blueprint),
    urgency: bestText(current.urgency, incoming.urgency),
    notes: mergeNotes(current.notes, incoming.notes),
    status: mergeStatus(current.status, incoming.status),
    priority: mergePriority(current.priority, incoming.priority),
    next_step: bestText(current.next_step, incoming.next_step),
    lead_score: Math.max(current.lead_score, incoming.lead_score),
  };
}

function bestText(current: string, incoming: string) {
  const left = current.trim();
  const right = incoming.trim();
  if (!left) return right;
  if (!right) return left;
  return right.length > left.length ? right : left;
}

function mergeNotes(current: string, incoming: string) {
  const notes = [current.trim(), incoming.trim()].filter(Boolean);
  return Array.from(new Set(notes)).join("\n");
}

function mergeNullableBoolean(current: boolean | null, incoming: boolean | null) {
  if (current === true || incoming === true) return true;
  if (current === false || incoming === false) return false;
  return null;
}

function mergePriority(current: string, incoming: string) {
  const rank: Record<string, number> = { Baixa: 1, Media: 2, Alta: 3 };
  return (rank[incoming] ?? 0) > (rank[current] ?? 0) ? incoming : current;
}

function mergeStatus(current: string, incoming: string) {
  const rank: Record<string, number> = {
    "Novo lead": 1,
    "Em triagem": 2,
    Qualificado: 3,
    "Visita a marcar": 4,
    "Orcamento a enviar": 5,
    "Sem resposta": 1,
  };
  return (rank[incoming] ?? 0) > (rank[current] ?? 0) ? incoming : current;
}

function normalizeLeadText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePuterError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message || fallback;
    if (/auth|authorize|login|sign.?in|permission|unauthorized|forbidden/i.test(message)) {
      return new Error("O Puter pediu login/autorizacao. Conclua o acesso na janela do Puter e tente novamente.");
    }
    return new Error(message);
  }
  return new Error(fallback);
}
