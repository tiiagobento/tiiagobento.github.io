import { describe, expect, it } from "vitest";
import { MAX_LEAD_FILE_BYTES, createLeadFileStorageName, getLeadFileValidationError } from "@/lib/lead-files";

describe("lead file validation", () => {
  it("accepts an architectural plan PDF within the limit", () => {
    const file = new File(["plan"], "Planta residencial.pdf", { type: "application/pdf" });
    expect(getLeadFileValidationError(file)).toBeNull();
  });

  it("rejects unsupported and oversized files", () => {
    const executable = new File(["binary"], "arquivo.exe", { type: "application/octet-stream" });
    const oversized = new File([new Uint8Array(MAX_LEAD_FILE_BYTES + 1)], "foto.jpg", { type: "image/jpeg" });
    expect(getLeadFileValidationError(executable)).toContain("PDF");
    expect(getLeadFileValidationError(oversized)).toContain("15 MB");
  });

  it("creates a storage-safe file name while retaining its extension", () => {
    expect(createLeadFileStorageName("Planta casa Joao #1.pdf")).toBe("Planta-casa-Joao-1.pdf");
  });
});
