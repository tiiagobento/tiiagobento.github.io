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
});
