import { supabase } from "@/lib/supabase/client";

import type {
  SteelFrameCalculatedItemInput,
  SteelFrameCalculatedItemRecord,
  SteelFrameCommercialComponentRecord,
  SteelFrameCostingSnapshot,
  SteelFrameDocumentRecord,
  SteelFrameDocumentType,
  SteelFrameDocumentVisibility,
  SteelFrameEstimateDraft,
  SteelFrameEstimateRecord,
  SteelFrameEstimateStatus,
  SteelFrameLaborItemInput,
  SteelFrameLaborItemRecord,
  SteelFrameMaterialRecord,
  SteelFrameOpeningInput,
  SteelFrameOpeningRecord,
  SteelFrameOperationalCostInput,
  SteelFrameOperationalCostRecord,
  SteelFrameTechnicalAssessmentRecord,
  SteelFrameTechnicalClassification,
  SteelFrameTechnicalCompositionRecord,
  SteelFrameTechnicalRuleRecord,
  SteelFrameWallSegmentInput,
  SteelFrameWallSegmentRecord,
} from "./types";
import {
  createSteelFrameDocumentStoragePath,
  steelFrameDocumentsBucket,
} from "./documents";
import {
  steelFrameCalculatedItemSchema,
  steelFrameLaborItemSchema,
  steelFrameOperationalCostSchema,
  steelFrameTechnicalCompositionDraftSchema,
  steelFrameTechnicalRuleDraftSchema,
} from "./schemas";

export const steelFrameMigrationRequiredMessage =
  "O modulo de orcamentos ainda nao foi aplicado neste Supabase. Execute a migration add_steel_frame_estimates.sql e atualize a pagina.";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

function getClient() {
  if (!supabase) {
    throw new Error("Supabase nao esta configurado neste ambiente.");
  }

  return supabase;
}

function toNullableString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getSteelFrameErrorMessage(error: unknown) {
  const details = error as SupabaseErrorLike | undefined;
  const message = details?.message?.trim();
  const code = details?.code;

  if (
    code === "42P01" ||
    code === "42883" ||
    /steel_frame_|create_steel_frame_estimate|mark_steel_frame_proposal_generated|approve_steel_frame_technical|does not exist|could not find the function/i.test(message ?? "")
  ) {
    return steelFrameMigrationRequiredMessage;
  }

  if (code === "42501" || /permission|row-level security|rls/i.test(message ?? "")) {
    return "Sua conta nao possui permissao para executar esta acao no orcamento.";
  }

  return message || "Nao foi possivel concluir a operacao no orcamento.";
}

export async function listSteelFrameEstimates() {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_estimates")
    .select("*, lead:leads(id, name, phone, city, neighborhood)")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return (data ?? []) as SteelFrameEstimateRecord[];
}

export async function getSteelFrameEstimate(id: string) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_estimates")
    .select("*, lead:leads(id, name, phone, city, neighborhood)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameEstimateRecord | null;
}

export async function createSteelFrameEstimate(input: SteelFrameEstimateDraft) {
  const client = getClient();
  const { data, error } = await client.rpc("create_steel_frame_estimate", {
    estimate_title: input.title.trim(),
    estimate_mode: input.mode,
    estimate_lead_id: input.leadId ?? null,
    estimate_city: toNullableString(input.city),
    estimate_neighborhood: toNullableString(input.neighborhood),
    estimate_approximate_address: toNullableString(input.approximateAddress),
    estimate_project_type: toNullableString(input.projectType),
    estimate_standard_wall_height_meters: input.standardWallHeightMeters ?? null,
    estimate_expected_floors: input.expectedFloors ?? null,
    estimate_access_difficulty: input.accessDifficulty ?? null,
    estimate_requires_material_lift: input.requiresMaterialLift ?? null,
    estimate_notes: toNullableString(input.notes),
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameEstimateRecord;
}

export async function updateSteelFrameEstimateStatus(
  estimateId: string,
  status: SteelFrameEstimateStatus,
) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_estimates")
    .update({ status })
    .eq("id", estimateId)
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameEstimateRecord;
}

export async function approveSteelFrameEstimate(estimateId: string, reviewNotes?: string | null) {
  const client = getClient();
  const { data, error } = await client.rpc("approve_steel_frame_estimate", {
    target_estimate_id: estimateId,
    review_notes: toNullableString(reviewNotes),
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameEstimateRecord;
}

export async function markSteelFrameProposalGenerated(estimateId: string, documentId: string) {
  const client = getClient();
  const { data, error } = await client.rpc("mark_steel_frame_proposal_generated", {
    target_estimate_id: estimateId,
    target_document_id: documentId,
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameEstimateRecord;
}

export async function getSteelFrameGeometry(estimateId: string) {
  const client = getClient();
  const [wallsResult, openingsResult] = await Promise.all([
    client
      .from("steel_frame_wall_segments")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    client
      .from("steel_frame_openings")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
  ]);

  if (wallsResult.error) throw new Error(getSteelFrameErrorMessage(wallsResult.error));
  if (openingsResult.error) throw new Error(getSteelFrameErrorMessage(openingsResult.error));

  return {
    walls: (wallsResult.data ?? []) as SteelFrameWallSegmentRecord[],
    openings: (openingsResult.data ?? []) as SteelFrameOpeningRecord[],
  };
}

export async function addSteelFrameWall(
  estimateId: string,
  input: SteelFrameWallSegmentInput,
  sortOrder: number,
) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_wall_segments")
    .insert({
      estimate_id: estimateId,
      label: input.label.trim(),
      length_meters: input.lengthMeters,
      height_meters: input.heightMeters,
      quantity: input.quantity,
      confirmation_status: input.confirmationStatus,
      source_data: {
        ...(input.sourceData ?? {}),
        ...(input.sourceDescription ? { source_description: input.sourceDescription } : {}),
      },
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameWallSegmentRecord;
}

export async function addSteelFrameOpening(
  estimateId: string,
  input: SteelFrameOpeningInput,
  sortOrder: number,
) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_openings")
    .insert({
      estimate_id: estimateId,
      wall_segment_id: input.wallSegmentId ?? null,
      label: input.label.trim(),
      opening_type: input.openingType ?? "other",
      width_meters: input.widthMeters,
      height_meters: input.heightMeters,
      quantity: input.quantity,
      subtract_from_wall_area: input.subtractFromWallArea,
      confirmation_status: input.confirmationStatus,
      source_data: {
        ...(input.sourceData ?? {}),
        ...(input.sourceDescription ? { source_description: input.sourceDescription } : {}),
      },
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameOpeningRecord;
}

export async function listSteelFrameMaterials() {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_materials")
    .select("*, prices:steel_frame_material_prices(id, unit_cost, currency, effective_from, effective_to)")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return (data ?? []) as SteelFrameMaterialRecord[];
}

export async function createSteelFrameMaterial({
  name,
  category,
  unit,
  sku,
  initialUnitCost,
}: {
  name: string;
  category: string;
  unit: string;
  sku?: string | null;
  initialUnitCost?: number | null;
}) {
  const client = getClient();
  const { data, error } = await client.rpc("create_steel_frame_material", {
    material_name: name.trim(),
    material_category: category.trim(),
    material_unit: unit.trim(),
    material_sku: toNullableString(sku),
    initial_unit_cost: initialUnitCost ?? null,
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameMaterialRecord;
}

export async function listSteelFrameTechnicalRules() {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_technical_rules")
    .select("*")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return (data ?? []) as SteelFrameTechnicalRuleRecord[];
}

export async function listSteelFrameTechnicalCompositions() {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_technical_compositions")
    .select("*, rules:steel_frame_technical_composition_rules(*, rule:steel_frame_technical_rules(*))")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return (data ?? []) as SteelFrameTechnicalCompositionRecord[];
}

export async function createSteelFrameTechnicalRule(input: Parameters<typeof steelFrameTechnicalRuleDraftSchema.parse>[0]) {
  const parsed = steelFrameTechnicalRuleDraftSchema.parse(input);
  const client = getClient();
  const sourceReference = parsed.sourceId
    ? { source_id: parsed.sourceId, source_document_id: parsed.sourceDocumentId }
    : {};
  const { data, error } = await client
    .from("steel_frame_technical_rules")
    .insert({
      code: parsed.code,
      version: parsed.version,
      name: parsed.name,
      rule_type: parsed.ruleType,
      origin: parsed.origin,
      reference_name: parsed.referenceName,
      reference_version: parsed.referenceVersion,
      permitted_use: toNullableString(parsed.permittedUse),
      application_scope: parsed.applicationScope,
      conditions: parsed.conditions,
      parameters: parsed.parameters,
      limits: parsed.limits,
      technical_responsible_name: toNullableString(parsed.technicalResponsibleName),
      technical_responsible_registration: toNullableString(parsed.technicalResponsibleRegistration),
      approval_notes: toNullableString(parsed.approvalNotes),
      effective_from: parsed.effectiveFrom ?? null,
      effective_to: parsed.effectiveTo ?? null,
      ...sourceReference,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameTechnicalRuleRecord;
}

export async function createSteelFrameTechnicalComposition(input: Parameters<typeof steelFrameTechnicalCompositionDraftSchema.parse>[0]) {
  const parsed = steelFrameTechnicalCompositionDraftSchema.parse(input);
  const client = getClient();
  const sourceReference = parsed.sourceId
    ? { source_id: parsed.sourceId, source_document_id: parsed.sourceDocumentId }
    : {};
  const { data, error } = await client
    .from("steel_frame_technical_compositions")
    .insert({
      code: parsed.code,
      version: parsed.version,
      name: parsed.name,
      application_type: parsed.applicationType,
      profile_specification: toNullableString(parsed.profileSpecification),
      description: toNullableString(parsed.description),
      permitted_use: toNullableString(parsed.permittedUse),
      application_scope: parsed.applicationScope,
      conditions: parsed.conditions,
      limits: parsed.limits,
      technical_responsible_name: toNullableString(parsed.technicalResponsibleName),
      technical_responsible_registration: toNullableString(parsed.technicalResponsibleRegistration),
      approval_notes: toNullableString(parsed.approvalNotes),
      effective_from: parsed.effectiveFrom ?? null,
      effective_to: parsed.effectiveTo ?? null,
      ...sourceReference,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));

  if (parsed.ruleIds.length) {
    const { error: linkError } = await client
      .from("steel_frame_technical_composition_rules")
      .insert(parsed.ruleIds.map((ruleId, index) => ({
        composition_id: data.id,
        rule_id: ruleId,
        sort_order: index,
      })));
    if (linkError) throw new Error(getSteelFrameErrorMessage(linkError));
  }

  return data as SteelFrameTechnicalCompositionRecord;
}

export async function approveSteelFrameTechnicalRule(ruleId: string, reviewNotes?: string | null) {
  const client = getClient();
  const { data, error } = await client.rpc("approve_steel_frame_technical_rule", {
    target_rule_id: ruleId,
    review_notes: toNullableString(reviewNotes),
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameTechnicalRuleRecord;
}

export async function approveSteelFrameTechnicalComposition(compositionId: string, reviewNotes?: string | null) {
  const client = getClient();
  const { data, error } = await client.rpc("approve_steel_frame_technical_composition", {
    target_composition_id: compositionId,
    review_notes: toNullableString(reviewNotes),
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameTechnicalCompositionRecord;
}

export async function getLatestSteelFrameTechnicalAssessment(estimateId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_technical_assessments")
    .select("*, composition:steel_frame_technical_compositions(id, code, version, name, status)")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameTechnicalAssessmentRecord | null;
}

export async function createSteelFrameTechnicalAssessment({
  estimateId,
  compositionId,
  classification,
  inputSnapshot,
  findings,
  missingInformation,
  ruleSnapshot,
}: {
  estimateId: string;
  compositionId?: string | null;
  classification: SteelFrameTechnicalClassification;
  inputSnapshot: Record<string, unknown>;
  findings: Array<{ code: string; severity: "info" | "warning" | "critical"; message: string }>;
  missingInformation: string[];
  ruleSnapshot: Array<Record<string, unknown>>;
}) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_technical_assessments")
    .insert({
      estimate_id: estimateId,
      composition_id: compositionId ?? null,
      classification,
      input_snapshot: inputSnapshot,
      findings,
      missing_information: missingInformation,
      rule_snapshot: ruleSnapshot,
    })
    .select("*, composition:steel_frame_technical_compositions(id, code, version, name, status)")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameTechnicalAssessmentRecord;
}

export async function getSteelFrameCosting(estimateId: string): Promise<SteelFrameCostingSnapshot> {
  const client = getClient();
  const [calculatedItemsResult, laborItemsResult, operationalCostsResult, commercialComponentsResult] = await Promise.all([
    client
      .from("steel_frame_calculated_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    client
      .from("steel_frame_labor_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    client
      .from("steel_frame_operational_costs")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    client
      .from("steel_frame_commercial_components")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
  ]);

  const firstError = [
    calculatedItemsResult.error,
    laborItemsResult.error,
    operationalCostsResult.error,
    commercialComponentsResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(getSteelFrameErrorMessage(firstError));

  return {
    calculatedItems: (calculatedItemsResult.data ?? []) as SteelFrameCalculatedItemRecord[],
    laborItems: (laborItemsResult.data ?? []) as SteelFrameLaborItemRecord[],
    operationalCosts: (operationalCostsResult.data ?? []) as SteelFrameOperationalCostRecord[],
    commercialComponents: (commercialComponentsResult.data ?? []) as SteelFrameCommercialComponentRecord[],
  };
}

export async function addSteelFrameCalculatedItem(
  estimateId: string,
  input: SteelFrameCalculatedItemInput,
  sortOrder: number,
) {
  const parsed = steelFrameCalculatedItemSchema.parse(input);
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_calculated_items")
    .insert({
      estimate_id: estimateId,
      material_id: parsed.materialId,
      label: parsed.label.trim(),
      category: parsed.category.trim(),
      unit: parsed.unit.trim(),
      calculation_rule: parsed.rule.ruleType,
      rule_parameters: parsed.rule.parameters,
      source_values: parsed.sourceValues,
      raw_quantity: parsed.rawQuantity,
      waste_percent: parsed.rule.wastePercent ?? 0,
      calculated_quantity: parsed.calculatedQuantity,
      unit_cost: parsed.unitCost,
      requires_technical_review: parsed.requiresTechnicalReview ?? true,
      confirmation_status: parsed.confirmationStatus ?? "needs_confirmation",
      source_data: parsed.sourceData ?? {},
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameCalculatedItemRecord;
}

export async function addSteelFrameLaborItem(
  estimateId: string,
  input: SteelFrameLaborItemInput,
  sortOrder: number,
) {
  const parsed = steelFrameLaborItemSchema.parse(input);
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_labor_items")
    .insert({
      estimate_id: estimateId,
      label: parsed.label.trim(),
      quantity: parsed.quantity,
      unit: parsed.unit.trim(),
      unit_cost: parsed.unitCost,
      notes: toNullableString(parsed.notes),
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameLaborItemRecord;
}

export async function addSteelFrameOperationalCost(
  estimateId: string,
  input: SteelFrameOperationalCostInput,
  sortOrder: number,
) {
  const parsed = steelFrameOperationalCostSchema.parse(input);
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_operational_costs")
    .insert({
      estimate_id: estimateId,
      category: parsed.category.trim(),
      label: parsed.label.trim(),
      amount: parsed.amount,
      notes: toNullableString(parsed.notes),
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return data as SteelFrameOperationalCostRecord;
}

export async function upsertSteelFrameCommercialComponents(
  estimateId: string,
  components: {
    contingencyPercentOfCost: number;
    taxPercentOfSale: number;
    salesCommissionPercentOfSale: number;
    platformCommissionPercentOfSale: number;
    targetMarginPercentOfSale: number;
    maxDiscountPercent: number;
  },
) {
  const client = getClient();
  const rows = [
    {
      estimate_id: estimateId,
      estimate_version_id: null,
      component_key: "contingency",
      calculation_basis: "percent_of_cost",
      percentage: components.contingencyPercentOfCost,
      amount: null,
      sort_order: 0,
    },
    {
      estimate_id: estimateId,
      estimate_version_id: null,
      component_key: "tax",
      calculation_basis: "percent_of_sale",
      percentage: components.taxPercentOfSale,
      amount: null,
      sort_order: 1,
    },
    {
      estimate_id: estimateId,
      estimate_version_id: null,
      component_key: "sales_commission",
      calculation_basis: "percent_of_sale",
      percentage: components.salesCommissionPercentOfSale,
      amount: null,
      sort_order: 2,
    },
    {
      estimate_id: estimateId,
      estimate_version_id: null,
      component_key: "platform_commission",
      calculation_basis: "percent_of_sale",
      percentage: components.platformCommissionPercentOfSale,
      amount: null,
      sort_order: 3,
    },
    {
      estimate_id: estimateId,
      estimate_version_id: null,
      component_key: "target_margin",
      calculation_basis: "percent_of_sale",
      percentage: components.targetMarginPercentOfSale,
      amount: null,
      sort_order: 4,
    },
    {
      estimate_id: estimateId,
      estimate_version_id: null,
      component_key: "max_discount",
      calculation_basis: "percent_of_sale",
      percentage: components.maxDiscountPercent,
      amount: null,
      sort_order: 5,
    },
  ];
  const { data, error } = await client
    .from("steel_frame_commercial_components")
    .upsert(rows, { onConflict: "estimate_id,estimate_version_id,component_key" })
    .select("*");

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return (data ?? []) as SteelFrameCommercialComponentRecord[];
}

export async function listSteelFrameDocuments(estimateId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("steel_frame_documents")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
  return (data ?? []) as SteelFrameDocumentRecord[];
}

export async function uploadSteelFrameDocument({
  estimateId,
  file,
  documentType,
  visibility,
  metadata: additionalMetadata,
}: {
  estimateId: string;
  file: File;
  documentType: SteelFrameDocumentType;
  visibility: SteelFrameDocumentVisibility;
  metadata?: Record<string, unknown>;
}) {
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sua sessao expirou. Entre novamente para enviar um documento.");
  }

  const storagePath = createSteelFrameDocumentStoragePath({
    userId: authData.user.id,
    estimateId,
    fileName: file.name,
    uuid: crypto.randomUUID(),
  });
  const metadata = { ...additionalMetadata, upload_state: "pending" };
  const { data: document, error: metadataError } = await client
    .from("steel_frame_documents")
    .insert({
      estimate_id: estimateId,
      uploaded_by: authData.user.id,
      original_file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      document_type: documentType,
      visibility,
      metadata,
    })
    .select("*")
    .single();

  if (metadataError) throw new Error(getSteelFrameErrorMessage(metadataError));

  const { error: uploadError } = await client.storage
    .from(steelFrameDocumentsBucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    await client.from("steel_frame_documents").delete().eq("id", document.id);
    throw new Error(getSteelFrameErrorMessage(uploadError));
  }

  const { data: uploadedDocument, error: updateError } = await client
    .from("steel_frame_documents")
    .update({ metadata: { ...metadata, upload_state: "uploaded" } })
    .eq("id", document.id)
    .select("*")
    .single();

  if (updateError) return document as SteelFrameDocumentRecord;
  return uploadedDocument as SteelFrameDocumentRecord;
}

export async function getSteelFrameDocumentSignedUrl(storagePath: string) {
  const client = getClient();
  const { data, error } = await client.storage
    .from(steelFrameDocumentsBucket)
    .createSignedUrl(storagePath, 120);

  if (error || !data?.signedUrl) throw new Error(getSteelFrameErrorMessage(error));
  return data.signedUrl;
}

export async function deleteSteelFrameDocument(document: Pick<SteelFrameDocumentRecord, "id" | "storage_path">) {
  const client = getClient();
  const { error: storageError } = await client.storage
    .from(steelFrameDocumentsBucket)
    .remove([document.storage_path]);
  if (storageError) throw new Error(getSteelFrameErrorMessage(storageError));

  const { error: metadataError } = await client
    .from("steel_frame_documents")
    .delete()
    .eq("id", document.id);
  if (metadataError) throw new Error(getSteelFrameErrorMessage(metadataError));
}

export async function addSteelFrameAICorrection({
  estimateId,
  extractionId,
  fieldName,
  previousValue,
  correctedValue,
}: {
  estimateId: string;
  extractionId: string;
  fieldName: string;
  previousValue: unknown;
  correctedValue: unknown;
}) {
  const client = getClient();
  const { error } = await client.from("steel_frame_ai_corrections").insert({
    estimate_id: estimateId,
    extraction_id: extractionId,
    field_name: fieldName,
    previous_value: previousValue,
    corrected_value: correctedValue,
  });

  if (error) throw new Error(getSteelFrameErrorMessage(error));
}
