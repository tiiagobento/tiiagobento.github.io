import type { AIProvider } from "@/lib/ai/provider-types";
import { assertImageSupport, buildOpenAIMessageContent, extractOpenAIResponseText, requestProviderJson } from "@/lib/ai/providers/shared";

export function createHuggingFaceProvider(apiKey: string): AIProvider {
  const model = process.env.HUGGINGFACE_MODEL?.trim() || "zai-org/GLM-4.5V:fastest";
  const supportsImages = modelSupportsVision(model);

  return {
    name: "huggingface",
    supportsImages,
    async generate(input) {
      assertImageSupport(input, supportsImages);
      const payload = await requestProviderJson("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildOpenAIMessageContent(input) }],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });
      return extractOpenAIResponseText(payload);
    },
  };
}

function modelSupportsVision(model: string) {
  return /vision|vl|llava|qwen.*vl|glm-4\.?5v|multimodal/i.test(model);
}
