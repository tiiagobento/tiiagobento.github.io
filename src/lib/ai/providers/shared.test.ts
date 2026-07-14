import { describe, expect, it } from "vitest";
import { buildOpenAIMessageContent, extractOpenAIResponseText, getAIRequestTimeoutMs, parseDataUrl } from "@/lib/ai/providers/shared";
import { createMockProvider } from "@/lib/ai/providers/mock";

describe("AI provider helpers", () => {
  it("uses a bounded server-side AI timeout", () => {
    const previous = process.env.AI_REQUEST_TIMEOUT_MS;
    process.env.AI_REQUEST_TIMEOUT_MS = "30000";
    expect(getAIRequestTimeoutMs()).toBe(30_000);

    process.env.AI_REQUEST_TIMEOUT_MS = "1000";
    expect(getAIRequestTimeoutMs()).toBe(30_000);

    if (previous === undefined) delete process.env.AI_REQUEST_TIMEOUT_MS;
    else process.env.AI_REQUEST_TIMEOUT_MS = previous;
  });

  it("builds multimodal OpenAI-compatible content", () => {
    const content = buildOpenAIMessageContent({
      task: "extract-leads",
      prompt: "Analise",
      images: [{ mimeType: "image/png", data: "YWJj" }],
    });

    expect(content).toEqual([
      { type: "text", text: "Analise" },
      { type: "image_url", image_url: { url: "data:image/png;base64,YWJj" } },
    ]);
  });

  it("extracts text from OpenAI-compatible responses", () => {
    expect(extractOpenAIResponseText({
      choices: [{ message: { content: "```json\n{\"ok\":true}\n```" } }],
    })).toContain("\"ok\":true");
  });

  it("parses image data URLs without changing their bytes", () => {
    expect(parseDataUrl("data:image/webp;base64,YWJj")).toEqual({
      mimeType: "image/webp",
      data: "YWJj",
    });
  });

  it("returns useful deterministic mock responses", async () => {
    const provider = createMockProvider();
    const extraction = JSON.parse(await provider.generate({ task: "extract-leads", prompt: "", images: [] }));
    const message = JSON.parse(await provider.generate({ task: "generate-message", prompt: "", images: [] }));

    expect(extraction.leads[0].status).toBe("Novo lead");
    expect(extraction.warnings[0]).toContain("mock");
    expect(message.message).toContain("Nova Forma Steel Frame");
  });
});
