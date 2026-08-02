import type { SupabaseClient } from "@supabase/supabase-js";

import type { SteelFrameCatalogRepository } from "./repository";
import type {
  SteelFrameCatalogTechnicalSourceDocument,
  SteelFrameCatalogTechnicalSourceDocumentDraft,
} from "./types";

export const steelFrameCatalogBucket = "steel-frame-catalog";
export const steelFrameCatalogDocumentMaxBytes = 20 * 1024 * 1024;

const allowedMimeTypes = new Set<SteelFrameCatalogTechnicalSourceDocument["mimeType"]>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function getTechnicalSourceDocumentValidationError(file: Pick<File, "type" | "size" | "name">) {
  if (!allowedMimeTypes.has(file.type as SteelFrameCatalogTechnicalSourceDocument["mimeType"])) {
    return "Envie apenas PDF, JPG, PNG ou WEBP para a biblioteca tecnica.";
  }

  if (file.size <= 0) return "O arquivo selecionado esta vazio.";
  if (file.size > steelFrameCatalogDocumentMaxBytes) return "Cada arquivo pode ter no maximo 20 MB.";
  return null;
}

export function createTechnicalSourceStoragePath({
  userId,
  sourceId,
  fileName,
  uuid,
}: {
  userId: string;
  sourceId: string;
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

  return `${userId}/${sourceId}/${uuid}-${normalizedName}`;
}

export function formatTechnicalSourceDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadTechnicalSourceDocument({
  client,
  repository,
  sourceId,
  file,
  notes = null,
}: {
  client: SupabaseClient;
  repository: SteelFrameCatalogRepository;
  sourceId: string;
  file: File;
  notes?: string | null;
}) {
  const validationError = getTechnicalSourceDocumentValidationError(file);
  if (validationError) throw new Error(validationError);

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sua sessao expirou. Entre novamente para enviar um documento tecnico.");
  }

  const storagePath = createTechnicalSourceStoragePath({
    userId: authData.user.id,
    sourceId,
    fileName: file.name,
    uuid: crypto.randomUUID(),
  });
  const documentInput: SteelFrameCatalogTechnicalSourceDocumentDraft = {
    sourceId,
    originalFileName: file.name,
    storagePath,
    mimeType: file.type as SteelFrameCatalogTechnicalSourceDocument["mimeType"],
    fileSizeBytes: file.size,
    visibility: "restricted",
    notes,
  };
  const document = await repository.createTechnicalSourceDocument(documentInput);
  const { error: uploadError } = await client.storage
    .from(steelFrameCatalogBucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    await repository.deleteTechnicalSourceDocument(document.id).catch(() => undefined);
    throw uploadError;
  }

  return document;
}

export async function getTechnicalSourceDocumentSignedUrl({
  client,
  storagePath,
}: {
  client: SupabaseClient;
  storagePath: string;
}) {
  const { data, error } = await client.storage
    .from(steelFrameCatalogBucket)
    .createSignedUrl(storagePath, 120);

  if (error || !data?.signedUrl) throw error ?? new Error("Nao foi possivel abrir o documento privado.");
  return data.signedUrl;
}

export async function deleteTechnicalSourceDocument({
  client,
  repository,
  document,
}: {
  client: SupabaseClient;
  repository: SteelFrameCatalogRepository;
  document: Pick<SteelFrameCatalogTechnicalSourceDocument, "id" | "storagePath">;
}) {
  const { error: storageError } = await client.storage
    .from(steelFrameCatalogBucket)
    .remove([document.storagePath]);
  if (storageError) throw storageError;

  await repository.deleteTechnicalSourceDocument(document.id);
}
