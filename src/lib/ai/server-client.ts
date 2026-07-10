import { aiLeadAnalysisSchema, type AILeadAnalysisResult } from "@/lib/validations/ai-lead-draft";
import type { AIImageInput } from "@/lib/ai/provider-types";

const SERVER_AI_TIMEOUT_MS = 75_000;

export async function analyzeLeadWithServer(input: {
  conversation: string;
  source: string;
  images: AIImageInput[];
}): Promise<AILeadAnalysisResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SERVER_AI_TIMEOUT_MS);

  try {
    const response = await fetch("/api/ai/extract-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível analisar a conversa.";
      throw new Error(message);
    }

    return aiLeadAnalysisSchema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A IA demorou demais para responder. Tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
