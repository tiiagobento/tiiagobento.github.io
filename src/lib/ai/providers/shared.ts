import { imagePayloadToDataUrl } from "@/lib/ai/image-utils";
import type { AIProviderRequest } from "@/lib/ai/provider-types";

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;
export const UNSUPPORTED_IMAGE_PROVIDER_MESSAGE = "O provider atual nao suporta analise de imagem. Use Gemini ou Puter para analisar prints.";

export class AIProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "AIProviderRequestError";
  }
}

export function getAIRequestTimeoutMs() {
  const configured = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(configured) && configured >= MIN_TIMEOUT_MS && configured <= MAX_TIMEOUT_MS) {
    return configured;
  }
  return DEFAULT_TIMEOUT_MS;
}

export async function requestProviderJson(url: string, init: RequestInit, timeoutMs = getAIRequestTimeoutMs()) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage = getProviderErrorMessage(payload);
      const suffix = providerMessage ? `: ${providerMessage}` : "";
      throw new AIProviderRequestError(`O provedor de IA recusou a solicitação${suffix}`, mapProviderStatus(response.status));
    }

    return payload;
  } catch (error) {
    if (error instanceof AIProviderRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIProviderRequestError("A IA demorou demais para responder. Tente novamente.", 504);
    }
    throw new AIProviderRequestError("Não foi possível conectar ao provedor de IA. Tente novamente.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildOpenAIMessageContent(input: AIProviderRequest) {
  if (input.images.length === 0) return input.prompt;

  return [
    { type: "text", text: input.prompt },
    ...input.images.map((image) => ({
      type: "image_url",
      image_url: { url: imagePayloadToDataUrl(image) },
    })),
  ];
}

export function assertImageSupport(input: AIProviderRequest, supportsImages: boolean) {
  if (input.images.length > 0 && !supportsImages) {
    throw new AIProviderRequestError(UNSUPPORTED_IMAGE_PROVIDER_MESSAGE, 400);
  }
}

export function extractOpenAIResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new AIProviderRequestError("O provedor de IA retornou uma resposta vazia.");
  }

  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (text.trim()) return text;
  }

  throw new AIProviderRequestError("O provedor de IA não retornou conteúdo utilizável.");
}

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) throw new AIProviderRequestError("Uma das imagens enviadas está em formato inválido.", 400);
  return { mimeType: match[1], data: match[2].replace(/\s/g, "") };
}

function getProviderErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error.slice(0, 240);
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.slice(0, 240);
  }
  return "";
}

function mapProviderStatus(status: number) {
  if (status === 401 || status === 403) return 502;
  if (status === 408 || status === 429) return 503;
  return 502;
}
