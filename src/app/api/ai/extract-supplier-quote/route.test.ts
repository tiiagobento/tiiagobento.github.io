import { beforeEach, describe, expect, it, vi } from "vitest";

import { setTestRouteAuthorization } from "@/test/route-auth-mock";
import { POST } from "./route";

const providerMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  name: "gemini",
  supportsImages: true,
}));
const databaseMocks = vi.hoisted(() => ({
  source: vi.fn(),
  document: vi.fn(),
  storageDownload: vi.fn(),
}));

vi.mock("@/lib/supabase/route-auth", async () => {
  const { getTestRouteAuthorization } = await import("@/test/route-auth-mock");
  return { authorizeServerPermission: async () => getTestRouteAuthorization() };
});

vi.mock("@/lib/ai/provider", () => ({
  AIConfigurationError: class AIConfigurationError extends Error {},
  getConfiguredAIProvider: vi.fn(() => ({
    name: providerMocks.name,
    supportsImages: providerMocks.supportsImages,
    generate: providerMocks.generate,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from(table: string) {
      if (table === "steel_frame_technical_sources") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          maybeSingle: databaseMocks.source,
        };
        return query;
      }
      if (table === "steel_frame_technical_source_documents") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          maybeSingle: databaseMocks.document,
        };
        return query;
      }
      throw new Error(`Tabela inesperada: ${table}`);
    },
    storage: {
      from: () => ({ download: databaseMocks.storageDownload }),
    },
  })),
}));

const sourceId = "11111111-1111-4111-8111-111111111111";
const sourceDocumentId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new Request("http://localhost/api/ai/extract-supplier-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function providerResponse(items = true) {
  return JSON.stringify({
    supplier: { name: "Fornecedor", tax_id: null, contact_name: null, contact_phone: null, contact_email: null },
    quote: { number: "Q-1", issued_on: "2026-07-16", valid_until: null, expected_billing_on: null, payment_terms: null, subtotal: 10, discount: 0, freight: 0, taxes: 0, total: 10, currency: "BRL" },
    items: items ? [{ source_line_number: 1, external_code: "A1", description: "Perfil", ncm: null, quantity: 1, unit: "PC", unit_price: 10, line_total: 10 }] : [],
    summary: "Cotacao lida para revisao.",
    warnings: [],
    confidence: 0.8,
  });
}

describe("POST /api/ai/extract-supplier-quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestRouteAuthorization("authorized");
    providerMocks.name = "gemini";
    providerMocks.supportsImages = true;
    databaseMocks.source.mockResolvedValue({ data: { id: sourceId, source_type: "supplier_quote" }, error: null });
    databaseMocks.document.mockResolvedValue({
      data: { id: sourceDocumentId, source_id: sourceId, original_file_name: "cotacao.pdf", storage_path: `${sourceId}/cotacao.pdf`, mime_type: "application/pdf", file_size_bytes: 12 },
      error: null,
    });
    databaseMocks.storageDownload.mockResolvedValue({ data: new Blob(["quote-data"]), error: null });
    providerMocks.generate.mockResolvedValue(providerResponse());
  });

  it("downloads a private source document and sends inline data to Gemini", async () => {
    const response = await POST(request({ sourceId, sourceDocumentId }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysis.quote.number).toBe("Q-1");
    expect(databaseMocks.storageDownload).toHaveBeenCalledWith(`${sourceId}/cotacao.pdf`);
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      task: "extract-supplier-quote",
      images: [expect.objectContaining({ mimeType: "application/pdf", data: expect.any(String) })],
    }));
  });

  it("blocks a provider without document vision support", async () => {
    providerMocks.name = "openrouter";

    const response = await POST(request({ sourceId, sourceDocumentId }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("nao suporta");
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("blocks a request without a private source document", async () => {
    const response = await POST(request({ sourceId }));

    expect(response.status).toBe(400);
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("keeps the analysis reviewable when the provider cannot identify quote items", async () => {
    providerMocks.generate.mockResolvedValue(providerResponse(false));

    const response = await POST(request({ sourceId, sourceDocumentId }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysis.warnings.join(" ")).toContain("Nenhum item completo");
  });
});
