import type { AIImageInput } from "@/lib/ai/provider-types";

export const AI_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AI_IMAGE_MAX_COUNT = 5;
export const AI_REPLY_IMAGE_MAX_COUNT = 3;
// Inline base64 expands the payload. Keep a margin below Gemini's 20 MB inline-data limit.
export const AI_REPLY_IMAGE_TOTAL_MAX_BYTES = 13 * 1024 * 1024;
export const AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE = "Os prints excedem o limite total de 13 MB para uma analise. Remova ou reduza uma imagem.";

export const AI_ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export function validateImageFile(file: File) {
  if (!AI_ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "Envie apenas imagens PNG, JPG, JPEG ou WEBP.";
  }

  if (file.size > AI_IMAGE_MAX_BYTES) {
    return "Cada imagem pode ter no maximo 5 MB.";
  }

  return null;
}

export async function maybeCompressImage(file: File) {
  return file;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nao foi possivel ler essa imagem."));
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler essa imagem."));
    reader.readAsDataURL(file);
  });
}

export function getMimeTypeFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,/i);
  if (!match) throw new Error("Imagem em formato invalido.");
  return match[1].toLowerCase();
}

export function dataUrlToBase64(dataUrl: string) {
  const match = dataUrl.match(/^data:[^;,]+;base64,([\s\S]+)$/i);
  if (!match) throw new Error("Imagem em formato invalido.");
  return normalizeBase64(match[1]);
}

export function dataUrlToGeminiInlineData(dataUrl: string): AIImageInput {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!match) throw new Error("Imagem em formato invalido.");
  return {
    mimeType: match[1].toLowerCase(),
    data: dataUrlToBase64(dataUrl),
  };
}

export function imagePayloadToDataUrl(image: AIImageInput) {
  return `data:${image.mimeType};base64,${image.data}`;
}

export function estimateBase64Bytes(base64: string) {
  const normalized = normalizeBase64(base64);
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

export function normalizeBase64(value: string) {
  return value.replace(/\s/g, "");
}
