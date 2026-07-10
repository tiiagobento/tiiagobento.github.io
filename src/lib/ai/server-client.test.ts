import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeLeadWithServer } from "@/lib/ai/server-client";

const validResult = {
  leads: [{
    name: "Solange",
    phone: "554884616671",
    city: "Biguacu",
    neighborhood: "Deltaville",
    source: "WhatsApp",
    project_type: "Casa em steel frame",
    interest_type: "Visita",
    has_land: true,
    has_blueprint: false,
    urgency: "",
    notes: "",
    status: "Novo lead",
    priority: "Alta",
    next_step: "Agendar visita",
    lead_score: 80,
  }],
  summary: "Lead para visita.",
  warnings: [],
};

describe("server AI client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts extraction inputs and validates the structured response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validResult), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeLeadWithServer({
      conversation: "Quero marcar uma visita.",
      source: "WhatsApp",
      images: [{ mimeType: "image/png", data: "YWJj" }],
    });

    expect(result.leads[0].name).toBe("Solange");
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/extract-leads", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        conversation: "Quero marcar uma visita.",
        source: "WhatsApp",
        images: [{ mimeType: "image/png", data: "YWJj" }],
      }),
    }));
  });

  it("surfaces the friendly API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "IA não configurada. Configure uma API key nas variáveis de ambiente.",
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })));

    await expect(analyzeLeadWithServer({
      conversation: "Teste",
      source: "Site",
      images: [],
    })).rejects.toThrow("IA não configurada");
  });
});
