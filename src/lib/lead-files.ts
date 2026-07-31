import type { LeadFileCategory } from "@/lib/types";

export const MAX_LEAD_FILE_BYTES = 15 * 1024 * 1024;

export const leadFileCategories: LeadFileCategory[] = [
  "Planta/projeto",
  "Orcamento",
  "Documento",
  "Foto do local",
  "Comprovante de repasse",
  "Outro",
];

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"]);

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function getLeadFileValidationError(file: File) {
  if (file.size <= 0) return "O arquivo esta vazio.";
  if (file.size > MAX_LEAD_FILE_BYTES) return "Cada arquivo deve ter no maximo 15 MB.";

  const extension = extensionOf(file.name);
  if (!allowedMimeTypes.has(file.type) && !allowedExtensions.has(extension)) {
    return "Envie PDF, imagem JPG/PNG/WEBP ou documento DOC/DOCX.";
  }

  return null;
}

export function createLeadFileStorageName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);

  return normalized || "arquivo";
}

export function formatLeadFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
