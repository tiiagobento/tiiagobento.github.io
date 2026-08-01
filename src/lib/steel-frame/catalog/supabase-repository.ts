import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { asSteelFrameCatalogRuleDraft, steelFrameCatalogMaterialPriceSchema } from "./schemas";
import type { SteelFrameCatalogRepository, SteelFrameCatalogSnapshotToPersist } from "./repository";
import type { SteelFrameCatalogMaterialPrice, SteelFrameCatalogRuleDraft } from "./types";

type CatalogRow = Record<string, unknown>;

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
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
