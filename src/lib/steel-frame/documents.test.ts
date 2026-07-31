import { describe, expect, it } from "vitest";
import {
  createSteelFrameDocumentStoragePath,
  getSteelFrameDocumentValidationError,
  steelFrameDocumentMaxBytes,
} from "./documents";

describe("steel frame document validation", () => {
  it("allows only the private bucket formats and size", () => {
    expect(getSteelFrameDocumentValidationError({ name: "planta.pdf", type: "application/pdf", size: 1024 })).toBeNull();
    expect(getSteelFrameDocumentValidationError({ name: "imagem.gif", type: "image/gif", size: 1024 })).toContain("PDF, JPG, PNG ou WEBP");
    expect(getSteelFrameDocumentValidationError({ name: "grande.pdf", type: "application/pdf", size: steelFrameDocumentMaxBytes + 1 })).toContain("20 MB");
  });

  it("creates a user and estimate scoped storage path", () => {
    expect(createSteelFrameDocumentStoragePath({
      userId: "user-1",
      estimateId: "estimate-1",
      uuid: "uuid-1",
      fileName: "Planta residencial - versao 1.pdf",
    })).toBe("user-1/estimate-1/uuid-1-Planta-residencial-versao-1.pdf");
  });
});
