import { describe, expect, it } from "vitest";
import {
  createTechnicalSourceStoragePath,
  formatTechnicalSourceDocumentSize,
  getTechnicalSourceDocumentValidationError,
  steelFrameCatalogDocumentMaxBytes,
} from "./source-files";

function makeFile(overrides: Partial<Pick<File, "name" | "type" | "size">> = {}) {
  return {
    name: "Manual de vedacao.pdf",
    type: "application/pdf",
    size: 1024,
    ...overrides,
  } as Pick<File, "name" | "type" | "size">;
}

describe("technical source file helpers", () => {
  it("accepts private technical PDFs and supported images", () => {
    expect(getTechnicalSourceDocumentValidationError(makeFile())).toBeNull();
    expect(getTechnicalSourceDocumentValidationError(makeFile({ name: "planta.webp", type: "image/webp" }))).toBeNull();
  });

  it("rejects unsupported or oversized files before storage", () => {
    expect(getTechnicalSourceDocumentValidationError(makeFile({ type: "text/plain" }))).toContain("PDF, JPG, PNG ou WEBP");
    expect(getTechnicalSourceDocumentValidationError(makeFile({ size: steelFrameCatalogDocumentMaxBytes + 1 }))).toContain("20 MB");
    expect(getTechnicalSourceDocumentValidationError(makeFile({ size: 0 }))).toContain("vazio");
  });

  it("creates a user-owned, normalized storage path", () => {
    expect(createTechnicalSourceStoragePath({
      userId: "user-123",
      sourceId: "source-456",
      uuid: "upload-789",
      fileName: "Manual técnico / revisão 1.pdf",
    })).toBe("user-123/source-456/upload-789-Manual-tecnico-revisao-1.pdf");
  });

  it("formats document sizes for the source library", () => {
    expect(formatTechnicalSourceDocumentSize(300)).toBe("300 B");
    expect(formatTechnicalSourceDocumentSize(2048)).toBe("2.0 KB");
    expect(formatTechnicalSourceDocumentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
