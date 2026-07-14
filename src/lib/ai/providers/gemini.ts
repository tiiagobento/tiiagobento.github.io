import type { AIProvider } from "@/lib/ai/provider-types";
import { AIProviderRequestError, requestProviderJson } from "@/lib/ai/providers/shared";

export function createGeminiProvider(apiKey: string): AIProvider {
  return {
    name: "gemini",
    supportsImages: true,
    async generate(input) {
      const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
      const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];

      for (const image of input.images) {
        parts.push({ inlineData: image });
      }

      const payload = await requestProviderJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
              maxOutputTokens: 4096,
            },
          }),
        },
      );

      const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates;
      const text = candidates?.[0]?.content?.parts
        ?.map((part) => (typeof part.text === "string" ? part.text : ""))
        .filter(Boolean)
        .join("\n");

      if (!text?.trim()) throw new AIProviderRequestError("O Gemini não retornou conteúdo utilizável.");
      return text;
    },
  };
}
