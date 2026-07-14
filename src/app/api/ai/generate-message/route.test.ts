import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNSUPPORTED_IMAGE_PROVIDER_MESSAGE } from "@/lib/ai/providers/shared";
import { AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE } from "@/lib/ai/image-utils";
import { POST } from "./route";

const providerMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  supportsImages: true,
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
    supportsImages: providerMocks.supportsImages,
    generate: providerMocks.generate,
  })),
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/generate-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseRequest = {
  objective: "Responder ao cliente com proximo passo comercial.",
  context: "Tenho terreno em Biguacu e gostaria de marcar uma visita.",
  tone: "cordial" as const,
  lead: { name: "Cibelle", city: "Biguacu" },
};

describe("POST /api/ai/generate-message", () => {
  beforeEach(() => {
    providerMocks.generate.mockReset();
    providerMocks.supportsImages = true;
    providerMocks.generate.mockResolvedValue(JSON.stringify({
      message: "Ola, Cibelle! Podemos organizar uma visita ao terreno. Qual periodo funciona melhor para voce?",
      warnings: [],
    }));
  });

  it("generates a reply from the pasted latest client message", async () => {
    const response = await POST(jsonRequest(baseRequest));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toContain("Cibelle");
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      task: "generate-message",
      images: [],
      prompt: expect.stringContaining(baseRequest.context),
    }));
  });

  it("accepts prints and passes base64 image data to the configured provider", async () => {
    const response = await POST(jsonRequest({
      ...baseRequest,
      context: "",
      images: [{ mimeType: "image/png", data: "YWJj" }],
    }));

    expect(response.status).toBe(200);
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      images: [{ mimeType: "image/png", data: "YWJj" }],
      prompt: expect.stringContaining("Foram enviados 1 print(s)"),
    }));
  });

  it("blocks an empty request before calling the AI provider", async () => {
    const response = await POST(jsonRequest({ ...baseRequest, context: "", images: [] }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Cole a ultima mensagem do cliente ou envie ao menos um print.");
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("blocks image payloads that would exceed Gemini's inline-data request limit", async () => {
    const imageData = "A".repeat(6_100_000);
    const response = await POST(jsonRequest({
      ...baseRequest,
      context: "",
      images: [
        { mimeType: "image/png", data: imageData },
        { mimeType: "image/png", data: imageData },
        { mimeType: "image/png", data: imageData },
      ],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe(AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE);
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the configured provider cannot read images", async () => {
    providerMocks.supportsImages = false;
    const response = await POST(jsonRequest({
      ...baseRequest,
      images: [{ mimeType: "image/webp", data: "YWJj" }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe(UNSUPPORTED_IMAGE_PROVIDER_MESSAGE);
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });
});
