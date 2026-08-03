import { z } from "zod";

import {
  steelFrameEngineApprovalStatuses,
  steelFrameEngineRuleSchema,
  steelFrameEngineRuleStrategies,
  steelFrameEngineRoundingModes,
  steelFrameEngineUnits,
} from "../engine";
import {
  steelFrameCatalogLifecycleStatuses,
  steelFrameTechnicalSourceTypes,
  type SteelFrameCatalogRuleDraft,
} from "./types";

const identifier = z.string().trim().min(1).max(160);
const nullableIdentifier = identifier.nullable();
const nullableDate = z.string().date().nullable();

export const steelFrameCatalogSourceReferenceSchema = z.object({
  sourceId: nullableIdentifier,
  sourceDocumentId: nullableIdentifier,
  sourceTitle: z.string().trim().min(1).max(240).nullable(),
  sourceVersion: z.string().trim().min(1).max(120).nullable(),
  documentReference: z.string().trim().max(500).nullable(),
  pageReference: z.string().trim().max(120).nullable(),
});

export const steelFrameTechnicalSourceDraftSchema = z.object({
  title: z.string().trim().min(3).max(240),
  sourceType: z.enum(steelFrameTechnicalSourceTypes),
  code: z.string().trim().max(120).nullable(),
  issuer: z.string().trim().max(240).nullable(),
  manufacturer: z.string().trim().max(240).nullable(),
  productName: z.string().trim().max(240).nullable(),
  edition: z.string().trim().max(120).nullable(),
  revision: z.string().trim().max(120).nullable(),
  publishedOn: nullableDate,
  effectiveFrom: nullableDate,
  effectiveTo: nullableDate,
  sourceUrl: z.string().url().nullable(),
  contentSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(),
  permittedUse: z.string().trim().max(2000).nullable(),
  notes: z.string().trim().max(5000).nullable(),
}).superRefine((value, context) => {
  if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveTo"],
      message: "A vigencia final nao pode ser anterior a vigencia inicial.",
    });
  }
});

export const steelFrameSupplierDraftSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do fornecedor.").max(240),
  taxId: z.string().trim().max(80).nullable(),
  contactName: z.string().trim().max(160).nullable(),
  phone: z.string().trim().max(80).nullable(),
  email: z.string().trim().email("Informe um email valido.").max(320).nullable(),
  notes: z.string().trim().max(5_000).nullable(),
});

export const steelFrameSupplierUpdateSchema = steelFrameSupplierDraftSchema.extend({
  supplierId: z.string().uuid(),
});

export const steelFrameSupplierArchiveSchema = z.object({
  supplierId: z.string().uuid(),
  reason: z.string().trim().min(3, "Informe o motivo do arquivamento.").max(1_000),
});

export const steelFrameCatalogRuleDraftSchema = z.object({
  id: identifier,
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/),
  version: z.string().trim().min(1).max(64),
  name: z.string().trim().min(3).max(180),
  strategyType: z.enum(steelFrameEngineRuleStrategies),
  parameterSchemaVersion: z.number().int().min(1).max(1000),
  technicalInputUnit: z.enum(steelFrameEngineUnits),
  purchaseUnit: z.enum(steelFrameEngineUnits),
  parameters: z.unknown(),
  limits: z.record(z.string(), z.unknown()),
  scope: z.object({
    wallIds: z.array(identifier).max(1000),
    openingIds: z.array(identifier).max(1000),
  }),
  wastePercent: z.number().finite().min(0).max(100),
  roundingMode: z.enum(steelFrameEngineRoundingModes),
  roundingMultiple: z.number().finite().positive(),
  source: steelFrameCatalogSourceReferenceSchema,
  status: z.enum(steelFrameCatalogLifecycleStatuses),
  technicalResponsibleName: z.string().trim().max(160).nullable(),
  technicalResponsibleRegistration: z.string().trim().max(160).nullable(),
  effectiveFrom: nullableDate,
  effectiveTo: nullableDate,
  approvedBy: nullableIdentifier,
}).superRefine((value, context) => {
  if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveTo"],
      message: "A vigencia final nao pode ser anterior a vigencia inicial.",
    });
  }
});

export const steelFrameCatalogMaterialPriceSchema = z.object({
  id: identifier,
  materialId: identifier,
  materialVariantId: nullableIdentifier,
  supplierId: nullableIdentifier,
  unitCost: z.number().finite().min(0),
  currency: z.literal("BRL"),
  effectiveFrom: z.string().date(),
  effectiveTo: nullableDate,
  preferred: z.boolean(),
  eligibleForAutomaticSelection: z.boolean(),
  isManualOverride: z.boolean(),
  createdAt: z.string().datetime(),
}).superRefine((value, context) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveTo"],
      message: "A validade final nao pode ser anterior ao inicio.",
    });
  }
});

export const steelFrameCatalogEngineApprovalStatusSchema = z.enum(steelFrameEngineApprovalStatuses);

export function asSteelFrameCatalogRuleDraft(value: unknown): SteelFrameCatalogRuleDraft {
  return steelFrameCatalogRuleDraftSchema.parse(value);
}

export function buildEngineRuleCandidate(rule: SteelFrameCatalogRuleDraft) {
  const status = rule.status === "superseded" ? "deprecated" : rule.status;
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    strategy: rule.strategyType,
    version: rule.version,
    approvalStatus: status,
    source: {
      name: rule.source.sourceTitle ?? "Fonte pendente",
      version: rule.source.sourceVersion ?? "Pendente",
      documentReference: rule.source.documentReference,
      pageReference: rule.source.pageReference,
      approvedBy: rule.approvedBy,
    },
    technicalUnit: rule.technicalInputUnit,
    purchaseUnit: rule.purchaseUnit,
    acceptedInputUnits: [rule.technicalInputUnit],
    wastePercent: rule.wastePercent,
    roundingMode: rule.roundingMode,
    roundingMultiple: rule.roundingMultiple,
    scope: rule.scope,
    limits: rule.limits,
    parameters: rule.parameters,
  };
}

export function validateSteelFrameCatalogRuleEngineContract(rule: SteelFrameCatalogRuleDraft) {
  return steelFrameEngineRuleSchema.safeParse(buildEngineRuleCandidate(rule));
}
