import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";

describe("Gemini provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends image input as inlineData/base64", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));

      expect(body.contents[0].parts).toEqual([
        { text: "Analise o print" },
        { inlineData: { mimeType: "image/png", data: "YWJj" } },
      ]);

      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "{\"leads\":[],\"summary\":\"ok\",\"warnings\":[]}" }] } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGeminiProvider("secret");
    const response = await provider.generate({
      task: "extract-leads",
      prompt: "Analise o print",
      images: [{ mimeType: "image/png", data: "YWJj" }],
    });

    expect(response).toContain("\"summary\":\"ok\"");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(":generateContent"), expect.objectContaining({
      method: "POST",
    }));
  });
});
