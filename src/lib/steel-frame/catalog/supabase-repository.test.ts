import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseSteelFrameCatalogRepository } from "./supabase-repository";

const sourceRow = {
  id: "source-1",
  created_by: "user-1",
  title: "Manual de fechamento externo",
  source_type: "manual",
  code: null,
  issuer: "Fabricante",
  manufacturer: null,
  product_name: null,
  edition: "2026",
  revision: "R1",
  published_on: null,
  effective_from: null,
  effective_to: null,
  source_url: "https://example.com/manual",
  content_sha256: null,
  permitted_use: "Referencia interna",
  notes: null,
  status: "draft",
  approved_by: null,
  approved_at: null,
  approval_notes: null,
  deprecated_at: null,
  created_at: "2026-08-02T10:00:00.000Z",
  updated_at: "2026-08-02T10:00:00.000Z",
  documents: [
    {
      id: "document-1",
      source_id: "source-1",
      original_file_name: "manual.pdf",
      storage_path: "user-1/source-1/upload-manual.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 2048,
      page_count: 12,
      content_sha256: null,
      visibility: "restricted",
      notes: null,
      status: "draft",
      created_at: "2026-08-02T10:00:00.000Z",
    },
  ],
};

function makeListClient() {
  const order = vi.fn().mockResolvedValue({ data: [sourceRow], error: null });
  const select = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select, order };
}

function makeCreateClient() {
  const single = vi.fn().mockResolvedValue({ data: { ...sourceRow, documents: undefined }, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

describe("Supabase Steel Frame catalog repository", () => {
  it("maps technical source rows and their private document metadata", async () => {
    const mock = makeListClient();
    const repository = createSupabaseSteelFrameCatalogRepository(mock.client);

    await expect(repository.listTechnicalSources()).resolves.toEqual([
      expect.objectContaining({
        id: "source-1",
        title: "Manual de fechamento externo",
        sourceType: "manual",
        status: "draft",
        documents: [expect.objectContaining({ id: "document-1", visibility: "restricted", fileSizeBytes: 2048 })],
      }),
    ]);
    expect(mock.from).toHaveBeenCalledWith("steel_frame_technical_sources");
    expect(mock.select).toHaveBeenCalledWith(expect.stringContaining("steel_frame_technical_source_documents"));
  });

  it("creates sources as data records without publishing technical content", async () => {
    const mock = makeCreateClient();
    const repository = createSupabaseSteelFrameCatalogRepository(mock.client);

    const source = await repository.createTechnicalSource({
      title: "Manual de fechamento externo",
      sourceType: "manual",
      code: null,
      issuer: "Fabricante",
      manufacturer: null,
      productName: null,
      edition: "2026",
      revision: "R1",
      publishedOn: null,
      effectiveFrom: null,
      effectiveTo: null,
      sourceUrl: "https://example.com/manual",
      contentSha256: null,
      permittedUse: "Referencia interna",
      notes: null,
    });

    expect(source.status).toBe("draft");
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Manual de fechamento externo",
      source_type: "manual",
      source_url: "https://example.com/manual",
    }));
    expect(mock.insert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
  });

  it("lists only approved typed rules for the estimate engine", async () => {
    const ruleRow = {
      id: "rule-1",
      code: "STUD-090",
      version: "1.0",
      name: "Montantes 90 mm",
      strategy_type: "STUD_BY_SPACING",
      parameter_schema_version: 1,
      technical_input_unit: "m",
      purchase_unit: "bar",
      parameters: {
        spacingMeters: 0.4,
        initialStudsPerWall: 1,
        endStudsPerWall: 1,
        manualExtraStuds: 0,
        commercialStock: {
          commercialBars: [{ id: "bar-6", label: "Barra 6 m", lengthMeters: 6, availableQuantity: null }],
          kerfMeters: 0,
          reusableLeftovers: [],
          minimumReusableLeftoverMeters: 0.2,
        },
      },
      limits: {},
      application_scope: { wallIds: [], openingIds: [] },
      status: "approved",
      source_id: "source-1",
      source_document_id: "document-1",
      source: { title: "Composicao aprovada", edition: "1.0", revision: null },
      source_document: { original_file_name: "manual.pdf" },
      reference_name: "Composicao aprovada",
      reference_version: "1.0",
      technical_responsible_name: "Responsavel tecnico",
      technical_responsible_registration: "CREA-TESTE",
      effective_from: "2026-01-01",
      effective_to: null,
      approved_by: "admin-1",
    };
    const order = vi.fn().mockResolvedValue({ data: [ruleRow], error: null });
    const not = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ not });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createSupabaseSteelFrameCatalogRepository({ from } as unknown as SupabaseClient);

    await expect(repository.listApprovedRules()).resolves.toEqual([
      expect.objectContaining({ id: "rule-1", strategyType: "STUD_BY_SPACING", status: "approved" }),
    ]);
    expect(eq).toHaveBeenCalledWith("status", "approved");
    expect(not).toHaveBeenCalledWith("strategy_type", "is", null);
  });
});
