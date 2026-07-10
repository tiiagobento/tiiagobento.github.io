import "server-only";

import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { createGroqProvider } from "@/lib/ai/providers/groq";
import { createHuggingFaceProvider } from "@/lib/ai/providers/huggingface";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { createOpenRouterProvider } from "@/lib/ai/providers/openrouter";
import type { AIProvider, AIProviderName } from "@/lib/ai/provider-types";

export const AI_NOT_CONFIGURED_MESSAGE = "IA não configurada. Configure uma API key nas variáveis de ambiente.";

const providerKeys: Record<Exclude<AIProviderName, "mock">, keyof NodeJS.ProcessEnv> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  huggingface: "HUGGINGFACE_API_KEY",
};

export function getAIProviderStatus() {
  const name = parseProviderName(process.env.AI_PROVIDER);
  if (!name) return { configured: false, name: null };
  if (name === "mock") return { configured: true, name };
  return { configured: Boolean(process.env[providerKeys[name]]?.trim()), name };
}

export function getConfiguredAIProvider(): AIProvider {
  const status = getAIProviderStatus();
  if (!status.name || !status.configured) throw new AIConfigurationError(AI_NOT_CONFIGURED_MESSAGE);

  if (status.name === "mock") return createMockProvider();

  const key = process.env[providerKeys[status.name]]!.trim();
  switch (status.name) {
    case "gemini":
      return createGeminiProvider(key);
    case "groq":
      return createGroqProvider(key);
    case "openrouter":
      return createOpenRouterProvider(key);
    case "huggingface":
      return createHuggingFaceProvider(key);
  }
}

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

function parseProviderName(value: string | undefined): AIProviderName | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "gemini" || normalized === "groq" || normalized === "openrouter" || normalized === "huggingface" || normalized === "mock") {
    return normalized;
  }
  return null;
}
