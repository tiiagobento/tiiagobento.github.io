import type { AIProvider } from "@/lib/ai/provider-types";
import { assertImageSupport, buildOpenAIMessageContent, extractOpenAIResponseText, requestProviderJson } from "@/lib/ai/providers/shared";

export function createGroqProvider(apiKey: string): AIProvider {
  const model = process.env.GROQ_MODEL?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
  const supportsImages = modelSupportsVision(model);

  return {
    name: "groq",
    supportsImages,
    async generate(input) {
      assertImageSupport(input, supportsImages);
      const payload = await requestProviderJson("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildOpenAIMessageContent(input) }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_completion_tokens: 4096,
        }),
      });
      return extractOpenAIResponseText(payload);
    },
  };
}

function modelSupportsVision(model: string) {
  return /vision|llama-4|scout|maverick|vl|multimodal/i.test(model);
}
