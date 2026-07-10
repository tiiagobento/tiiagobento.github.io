import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderRequestError, UNSUPPORTED_IMAGE_PROVIDER_MESSAGE } from "@/lib/ai/providers/shared";
import { POST } from "./route";

const providerMocks = vi.hoisted(() => ({
  generate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
    },
  })),
}));

vi.mock("@/lib/ai/provider", () => ({
  AIConfigurationError: class AIConfigurationError extends Error {},
  getConfiguredAIProvider: vi.fn(() => ({
    name: "mock",
    supportsImages: true,
    generate: providerMocks.generate,
  })),
}));

const validAIResponse = JSON.stringify({
  leads: [{
    name: "Cibelle",
    phone: "554898295786",
    city: "Imbituba",
    neighborhood: "Itapiruba",
    source: "WhatsApp",
    project_type: "Casa em steel frame",
    interest_type: "Orcamento",
    has_land: null,
    has_blueprint: true,
    urgency: "Fim do ano",
    notes: "Cliente enviou print com planta.",
    status: "Qualificado",
    priority: "Alta",
    next_step: "Confirmar medidas e marcar visita",
    lead_score: 82,
  }],
  summary: "Lead extraido de print.",
  warnings: [],
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/extract-leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/extract-leads", () => {
  beforeEach(() => {
    providerMocks.generate.mockReset();
    providerMocks.generate.mockResolvedValue(validAIResponse);
  });

  it("accepts image without text", async () => {
    const response = await POST(jsonRequest({
      conversation: "",
      source: "WhatsApp",
      images: [{ mimeType: "image/png", data: "YWJj" }],
    }));

    expect(response.status).toBe(200);
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      images: [{ mimeType: "image/png", data: "YWJj" }],
    }));
  });

  it("accepts text and image together", async () => {
    const response = await POST(jsonRequest({
      text: "Cliente pediu orcamento em Biguacu.",
      source: "WhatsApp",
      images: [{ mimeType: "image/jpeg", data: "YWJj" }],
    }));

    expect(response.status).toBe(200);
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Cliente pediu orcamento em Biguacu."),
      images: [{ mimeType: "image/jpeg", data: "YWJj" }],
    }));
  });

  it("blocks request without text and without image", async () => {
    const response = await POST(jsonRequest({
      conversation: "",
      source: "WhatsApp",
      images: [],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Envie uma imagem ou cole um texto antes de analisar.");
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("returns friendly error when provider does not support images", async () => {
    providerMocks.generate.mockRejectedValue(new AIProviderRequestError(UNSUPPORTED_IMAGE_PROVIDER_MESSAGE, 400));

    const response = await POST(jsonRequest({
      conversation: "",
      source: "WhatsApp",
      images: [{ mimeType: "image/webp", data: "YWJj" }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe(UNSUPPORTED_IMAGE_PROVIDER_MESSAGE);
  });

  it("normalizes partial AI output into editable lead drafts", async () => {
    providerMocks.generate.mockResolvedValue(JSON.stringify({
      lead: {
        name: null,
        phone: 554888137508,
        city: null,
        source: "WhatsApp",
        has_land: "sim",
        has_blueprint: "",
        lead_score: "78",
      },
      ai_summary: "Print parcialmente legivel.",
      missing_information: "Confirmar nome e bairro.",
    }));

    const response = await POST(jsonRequest({
      conversation: "",
      source: "WhatsApp",
      images: [{ mimeType: "image/png", data: "YWJj" }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.leads[0]).toMatchObject({
      name: "",
      phone: "554888137508",
      city: "",
      has_land: true,
      has_blueprint: null,
      status: "Novo lead",
      priority: "Media",
      lead_score: 78,
    });
    expect(payload.summary).toBe("Print parcialmente legivel.");
    expect(payload.warnings).toEqual(["Confirmar nome e bairro."]);
  });
});
