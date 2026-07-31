import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTestRouteAuthorization } from "@/test/route-auth-mock";
import { POST } from "./route";

const providerMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  name: "gemini",
  supportsImages: true,
}));
const databaseMocks = vi.hoisted(() => ({
  documents: vi.fn(),
  jobInsert: vi.fn(),
  extractionInsert: vi.fn(),
  questionsInsert: vi.fn(),
  jobUpdate: vi.fn(),
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
      if (table === "steel_frame_documents") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          in: databaseMocks.documents,
        };
        return query;
      }
      if (table === "steel_frame_ai_analysis_jobs") {
        return {
          insert: () => ({ select: () => ({ single: databaseMocks.jobInsert }) }),
          update: databaseMocks.jobUpdate,
        };
      }
      if (table === "steel_frame_ai_extractions") {
        return { insert: () => ({ select: () => ({ single: databaseMocks.extractionInsert }) }) };
      }
      if (table === "steel_frame_ai_questions") return { insert: databaseMocks.questionsInsert };
      throw new Error(`Tabela inesperada: ${table}`);
    },
    storage: {
      from: () => ({ download: databaseMocks.storageDownload }),
    },
  })),
}));

const estimateId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new Request("http://localhost/api/ai/extract-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/extract-estimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestRouteAuthorization("authorized");
    providerMocks.name = "gemini";
    providerMocks.supportsImages = true;
    databaseMocks.documents.mockResolvedValue({
      data: [{
        id: documentId,
        original_file_name: "planta.pdf",
        storage_path: `user-1/${estimateId}/planta.pdf`,
        mime_type: "application/pdf",
        file_size_bytes: 12,
      }],
      error: null,
    });
    databaseMocks.jobInsert.mockResolvedValue({ data: { id: "job-1" }, error: null });
    databaseMocks.extractionInsert.mockResolvedValue({ data: { id: "extraction-1" }, error: null });
    databaseMocks.questionsInsert.mockResolvedValue({ error: null });
    databaseMocks.jobUpdate.mockReturnValue({ eq: vi.fn(async () => ({ error: null })) });
    databaseMocks.storageDownload.mockResolvedValue({ data: new Blob(["pdf-data"]), error: null });
    providerMocks.generate.mockResolvedValue(JSON.stringify({
      summary: "Planta com medidas parcialmente identificadas.",
      estimate: { title: "Casa terrea", city: "Biguacu", neighborhood: null, approximate_address: null, project_type: "Casa", standard_wall_height_meters: null, expected_floors: 1 },
      walls: [],
      openings: [],
      missing_information: ["Confirmar pe direito"],
      warnings: [],
      confidence: 0.55,
    }));
  });

  it("downloads an authorized private PDF and sends it to Gemini as inline data", async () => {
    const response = await POST(request({ estimateId, documentIds: [documentId], context: "Casa terrea" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysis.summary).toContain("medidas parcialmente");
    expect(databaseMocks.storageDownload).toHaveBeenCalledWith(`user-1/${estimateId}/planta.pdf`);
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      task: "extract-estimate",
      images: [expect.objectContaining({ mimeType: "application/pdf", data: expect.any(String) })],
    }));
    expect(databaseMocks.extractionInsert).toHaveBeenCalled();
    expect(databaseMocks.questionsInsert).toHaveBeenCalled();
  });

  it("rejects an estimate document request for a non-Gemini provider", async () => {
    providerMocks.name = "openrouter";

    const response = await POST(request({ estimateId, documentIds: [documentId] }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("requer Gemini");
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("blocks a request without a selected document", async () => {
    const response = await POST(request({ estimateId, documentIds: [] }));

    expect(response.status).toBe(400);
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });

  it("does not preserve evidence that points outside the selected documents", async () => {
    providerMocks.generate.mockResolvedValue(JSON.stringify({
      summary: "Uma parede foi encontrada.",
      estimate: { title: null, city: null, neighborhood: null, approximate_address: null, project_type: null, standard_wall_height_meters: null, expected_floors: null },
      walls: [{
        label: "Parede frontal",
        length_meters: 5,
        height_meters: 2.8,
        quantity: 1,
        confidence: 0.5,
        evidence: { document_index: 2, page_number: 1, source_text: "5,00", bounding_box: null },
      }],
      openings: [],
      missing_information: [],
      warnings: [],
      confidence: 0.5,
    }));

    const response = await POST(request({ estimateId, documentIds: [documentId] }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysis.walls[0].evidence.document_index).toBeNull();
    expect(payload.analysis.warnings.join(" ")).toContain("fora da selecao");
  });
});
