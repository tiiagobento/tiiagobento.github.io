import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  asSteelFrameCatalogRuleDraft,
  steelFrameCatalogMaterialPriceSchema,
  steelFrameTechnicalSourceDraftSchema,
} from "./schemas";
import type { SteelFrameCatalogRepository, SteelFrameCatalogSnapshotToPersist } from "./repository";
import {
  steelFrameCatalogTechnicalSourceStatuses,
  type SteelFrameCatalogMaterialPrice,
  type SteelFrameCatalogRuleDraft,
  type SteelFrameCatalogTechnicalSource,
  type SteelFrameCatalogTechnicalSourceDocument,
  type SteelFrameCatalogTechnicalSourceStatus,
} from "./types";

type CatalogRow = Record<string, unknown>;

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function requiredText(value: unknown, field: string) {
  const text = textOrNull(value);
  if (!text) throw new Error(`O catalogo retornou ${field} sem valor.`);
  return text;
}

function asTechnicalSourceStatus(value: unknown): SteelFrameCatalogTechnicalSourceStatus {
  if (typeof value === "string" && steelFrameCatalogTechnicalSourceStatuses.includes(value as SteelFrameCatalogTechnicalSourceStatus)) {
    return value as SteelFrameCatalogTechnicalSourceStatus;
  }
  throw new Error("O catalogo retornou um status de fonte desconhecido.");
}

function asSourceDocumentMimeType(value: unknown): SteelFrameCatalogTechnicalSourceDocument["mimeType"] {
  if (value === "application/pdf" || value === "image/jpeg" || value === "image/png" || value === "image/webp") {
    return value;
  }
  throw new Error("O catalogo retornou um tipo de documento nao suportado.");
}

function asDocumentVisibility(value: unknown): SteelFrameCatalogTechnicalSourceDocument["visibility"] {
  if (value === "catalog" || value === "restricted") return value;
  throw new Error("O catalogo retornou uma visibilidade de documento desconhecida.");
}

function mapTechnicalSourceDocumentRow(row: CatalogRow): SteelFrameCatalogTechnicalSourceDocument {
  return {
    id: requiredText(row.id, "id"),
    sourceId: requiredText(row.source_id, "source_id"),
    originalFileName: requiredText(row.original_file_name, "original_file_name"),
    storagePath: requiredText(row.storage_path, "storage_path"),
    mimeType: asSourceDocumentMimeType(row.mime_type),
    fileSizeBytes: Number(row.file_size_bytes),
    pageCount: typeof row.page_count === "number" ? row.page_count : null,
    contentSha256: textOrNull(row.content_sha256),
    visibility: asDocumentVisibility(row.visibility),
    notes: textOrNull(row.notes),
    status: asTechnicalSourceStatus(row.status),
    createdAt: requiredText(row.created_at, "created_at"),
  };
}

function mapTechnicalSourceRow(row: CatalogRow): SteelFrameCatalogTechnicalSource {
  const parsed = steelFrameTechnicalSourceDraftSchema.parse({
    title: row.title,
    sourceType: row.source_type,
    code: textOrNull(row.code),
    issuer: textOrNull(row.issuer),
    manufacturer: textOrNull(row.manufacturer),
    productName: textOrNull(row.product_name),
    edition: textOrNull(row.edition),
    revision: textOrNull(row.revision),
    publishedOn: textOrNull(row.published_on),
    effectiveFrom: textOrNull(row.effective_from),
    effectiveTo: textOrNull(row.effective_to),
    sourceUrl: textOrNull(row.source_url),
    contentSha256: textOrNull(row.content_sha256),
    permittedUse: textOrNull(row.permitted_use),
    notes: textOrNull(row.notes),
  });

  return {
    ...parsed,
    id: requiredText(row.id, "id"),
    createdBy: requiredText(row.created_by, "created_by"),
    status: asTechnicalSourceStatus(row.status),
    approvedBy: textOrNull(row.approved_by),
    approvedAt: textOrNull(row.approved_at),
    approvalNotes: textOrNull(row.approval_notes),
    deprecatedAt: textOrNull(row.deprecated_at),
    createdAt: requiredText(row.created_at, "created_at"),
    updatedAt: requiredText(row.updated_at, "updated_at"),
    documents: Array.isArray(row.documents)
      ? row.documents.map((document) => mapTechnicalSourceDocumentRow(document as CatalogRow))
      : [],
  };
}

function mapRuleRow(row: CatalogRow): SteelFrameCatalogRuleDraft {
  const source = (row.source ?? {}) as CatalogRow;
  const sourceDocument = (row.source_document ?? {}) as CatalogRow;

  return asSteelFrameCatalogRuleDraft({
    id: row.id,
    code: row.code,
    version: row.version,
    name: row.name,
    strategyType: row.strategy_type,
    parameterSchemaVersion: row.parameter_schema_version,
    technicalInputUnit: row.technical_input_unit,
    purchaseUnit: row.purchase_unit,
    parameters: row.parameters,
    limits: row.limits,
    scope: row.application_scope ?? { wallIds: [], openingIds: [] },
    wastePercent: 0,
    roundingMode: "ceil",
    roundingMultiple: 1,
    source: {
      sourceId: textOrNull(row.source_id),
      sourceDocumentId: textOrNull(row.source_document_id),
      sourceTitle: textOrNull(source.title) ?? textOrNull(row.reference_name),
      sourceVersion: textOrNull(source.revision) ?? textOrNull(source.edition) ?? textOrNull(row.reference_version),
      documentReference: textOrNull(sourceDocument.original_file_name),
      pageReference: null,
    },
    status: row.status,
    technicalResponsibleName: textOrNull(row.technical_responsible_name),
    technicalResponsibleRegistration: textOrNull(row.technical_responsible_registration),
    effectiveFrom: textOrNull(row.effective_from),
    effectiveTo: textOrNull(row.effective_to),
    approvedBy: textOrNull(row.approved_by),
  });
}

function mapPriceRow(row: CatalogRow): SteelFrameCatalogMaterialPrice {
  return steelFrameCatalogMaterialPriceSchema.parse({
    id: row.id,
    materialId: row.material_id,
    materialVariantId: textOrNull(row.material_variant_id),
    supplierId: textOrNull(row.supplier_id),
    unitCost: Number(row.unit_cost),
    currency: row.currency,
    effectiveFrom: row.effective_from,
    effectiveTo: textOrNull(row.effective_to),
    preferred: row.preferred === true,
    eligibleForAutomaticSelection: true,
    isManualOverride: false,
    createdAt: row.created_at,
  });
}

export function createSupabaseSteelFrameCatalogRepository(
  client: SupabaseClient = createSupabaseBrowserClient(),
): SteelFrameCatalogRepository {
  return {
    async listTechnicalSources() {
      const { data, error } = await client
        .from("steel_frame_technical_sources")
        .select(`
          *,
          documents:steel_frame_technical_source_documents(*)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as CatalogRow[]).map(mapTechnicalSourceRow);
    },

    async createTechnicalSource(input) {
      const parsed = steelFrameTechnicalSourceDraftSchema.parse(input);
      const { data, error } = await client
        .from("steel_frame_technical_sources")
        .insert({
          title: parsed.title,
          source_type: parsed.sourceType,
          code: parsed.code,
          issuer: parsed.issuer,
          manufacturer: parsed.manufacturer,
          product_name: parsed.productName,
          edition: parsed.edition,
          revision: parsed.revision,
          published_on: parsed.publishedOn,
          effective_from: parsed.effectiveFrom,
          effective_to: parsed.effectiveTo,
          source_url: parsed.sourceUrl,
          content_sha256: parsed.contentSha256,
          permitted_use: parsed.permittedUse,
          notes: parsed.notes,
        })
        .select("*")
        .single();

      if (error) throw error;
      return mapTechnicalSourceRow(data as CatalogRow);
    },

    async listTechnicalSourceDocuments(sourceId) {
      const { data, error } = await client
        .from("steel_frame_technical_source_documents")
        .select("*")
        .eq("source_id", sourceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as CatalogRow[]).map(mapTechnicalSourceDocumentRow);
    },

    async createTechnicalSourceDocument(input) {
      const { data, error } = await client
        .from("steel_frame_technical_source_documents")
        .insert({
          source_id: input.sourceId,
          original_file_name: input.originalFileName,
          storage_path: input.storagePath,
          mime_type: input.mimeType,
          file_size_bytes: input.fileSizeBytes,
          content_sha256: input.contentSha256 ?? null,
          visibility: input.visibility ?? "restricted",
          notes: input.notes ?? null,
        })
        .select("*")
        .single();

      if (error) throw error;
      return mapTechnicalSourceDocumentRow(data as CatalogRow);
    },

    async deleteTechnicalSourceDocument(documentId) {
      const { error } = await client
        .from("steel_frame_technical_source_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },

    async getRule(ruleId) {
      const { data, error } = await client
        .from("steel_frame_technical_rules")
        .select(`
          *,
          source:steel_frame_technical_sources(id, title, edition, revision),
          source_document:steel_frame_technical_source_documents(id, original_file_name)
        `)
        .eq("id", ruleId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapRuleRow(data as CatalogRow) : null;
    },

    async listMaterialPrices({ materialId, materialVariantId = null }) {
      const { data, error } = await client
        .from("steel_frame_material_prices")
        .select("id, material_id, material_variant_id, supplier_id, unit_cost, currency, effective_from, effective_to, preferred, created_at")
        .eq("material_id", materialId);

      if (error) throw error;
      return ((data ?? []) as CatalogRow[])
        .filter((row) => !materialVariantId || row.material_variant_id === null || row.material_variant_id === materialVariantId)
        .map(mapPriceRow);
    },

    async createSnapshot(input: SteelFrameCatalogSnapshotToPersist) {
      const { data, error } = await client
        .from("steel_frame_catalog_snapshots")
        .insert({
          estimate_id: input.estimateId,
          estimate_version_id: input.estimateVersionId,
          scenario_id: input.scenarioId,
          snapshot_kind: input.snapshotKind,
          content_sha256: input.contentSha256,
          snapshot: input.snapshot,
        })
        .select("id")
        .single();

      if (error) throw error;
      return { id: String((data as { id: string }).id) };
    },
  };
}
