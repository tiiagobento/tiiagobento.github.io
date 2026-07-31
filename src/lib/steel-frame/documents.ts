import type { SteelFrameDocumentType, SteelFrameDocumentVisibility } from "./types";

export const steelFrameDocumentsBucket = "steel-frame-documents";
export const steelFrameDocumentMaxBytes = 20 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const steelFrameDocumentTypeOptions: Array<{ value: SteelFrameDocumentType; label: string }> = [
  { value: "plant", label: "Planta" },
  { value: "sketch", label: "Croqui" },
  { value: "facade", label: "Fachada" },
  { value: "photo", label: "Foto" },
  { value: "quote", label: "Orcamento recebido" },
  { value: "technical_document", label: "Documento tecnico" },
  { value: "reference", label: "Referencia" },
  { value: "proposal", label: "Proposta" },
];

export const steelFrameDocumentVisibilityOptions: Array<{ value: SteelFrameDocumentVisibility; label: string }> = [
  { value: "commercial", label: "Comercial" },
  { value: "technical", label: "Tecnico" },
  { value: "internal", label: "Interno" },
];

export function getSteelFrameDocumentValidationError(file: Pick<File, "type" | "size" | "name">) {
  if (!allowedMimeTypes.has(file.type)) {
    return "Envie apenas PDF, JPG, PNG ou WEBP para este orcamento.";
  }

  if (file.size <= 0) {
    return "O arquivo selecionado esta vazio.";
  }

  if (file.size > steelFrameDocumentMaxBytes) {
    return "Cada arquivo pode ter no maximo 20 MB.";
  }

  return null;
}

export function createSteelFrameDocumentStoragePath({
  userId,
  estimateId,
  fileName,
  uuid,
}: {
  userId: string;
  estimateId: string;
  fileName: string;
  uuid: string;
}) {
  const normalizedName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "documento";

  return `${userId}/${estimateId}/${uuid}-${normalizedName}`;
}

export function formatSteelFrameDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
