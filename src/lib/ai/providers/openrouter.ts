import type { AIProvider } from "@/lib/ai/provider-types";
import { assertImageSupport, buildOpenAIMessageContent, extractOpenAIResponseText, requestProviderJson } from "@/lib/ai/providers/shared";

export function createOpenRouterProvider(apiKey: string): AIProvider {
  const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
  const supportsImages = modelSupportsVision(model);

  return {
    name: "openrouter",
    supportsImages,
    async generate(input) {
      assertImageSupport(input, supportsImages);
      const payload = await requestProviderJson("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://nova-forma-crm.vercel.app",
          "X-OpenRouter-Title": "Nova Forma CRM",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildOpenAIMessageContent(input) }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });
      return extractOpenAIResponseText(payload);
    },
  };
}

function modelSupportsVision(model: string) {
  return /vision|vl|llava|qwen.*vl|gemini|gpt-4o|claude-3|pixtral|multimodal|glm-4\.?5v/i.test(model);
}
