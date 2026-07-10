import { describe, expect, it } from "vitest";
import {
  AI_IMAGE_MAX_BYTES,
  dataUrlToBase64,
  dataUrlToGeminiInlineData,
  estimateBase64Bytes,
  getMimeTypeFromDataUrl,
  imagePayloadToDataUrl,
  validateImageFile,
} from "@/lib/ai/image-utils";

describe("AI image utils", () => {
  it("extracts mime type and base64 from data URLs", () => {
    const dataUrl = "data:image/png;base64,YWJj";

    expect(getMimeTypeFromDataUrl(dataUrl)).toBe("image/png");
    expect(dataUrlToBase64(dataUrl)).toBe("YWJj");
    expect(dataUrlToGeminiInlineData(dataUrl)).toEqual({ mimeType: "image/png", data: "YWJj" });
    expect(imagePayloadToDataUrl({ mimeType: "image/png", data: "YWJj" })).toBe(dataUrl);
  });

  it("validates accepted image files", () => {
    const file = new File(["image"], "print.webp", { type: "image/webp" });

    expect(validateImageFile(file)).toBeNull();
  });

  it("blocks invalid files", () => {
    const file = new File(["not image"], "print.pdf", { type: "application/pdf" });

    expect(validateImageFile(file)).toBe("Envie apenas imagens PNG, JPG, JPEG ou WEBP.");
  });

  it("blocks images bigger than 5 MB", () => {
    const file = new File([new Uint8Array(AI_IMAGE_MAX_BYTES + 1)], "large.png", { type: "image/png" });

    expect(validateImageFile(file)).toBe("Cada imagem pode ter no maximo 5 MB.");
  });

  it("estimates base64 size", () => {
    expect(estimateBase64Bytes("YWJj")).toBe(3);
  });
});
