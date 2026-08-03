import { z } from "zod";

import {
  steelFrameCalculationRuleTypes,
  steelFrameConfirmationStatuses,
  steelFrameEstimateStatuses,
  steelFrameRoundingModes,
  steelFrameTechnicalApplicationTypes,
  steelFrameTechnicalRuleOrigins,
} from "./types";

const nonNegativeNumber = z.number().finite().min(0);
const positiveNumber = z.number().finite().positive();
const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined || Number.isNaN(value) ? null : Number(value)),
  positiveNumber.nullable(),
);
const optionalPositiveInteger = z.preprocess(
  (value) => (value === "" || value === null || value === undefined || Number.isNaN(value) ? null : Number(value)),
  z.number().int().min(1).max(10).nullable(),
);

export const steelFrameEstimateDraftSchema = z.object({
  title: z.string().trim().min(3, "Informe um titulo para o orcamento.").max(160),
  mode: z.enum(["commercial", "technical"]),
  leadId: z.string().uuid().nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  neighborhood: z.string().trim().max(120).nullable().optional(),
  approximateAddress: z.string().trim().max(255).nullable().optional(),
  projectType: z.string().trim().max(120).nullable().optional(),
  standardWallHeightMeters: optionalPositiveNumber.refine(
    (value) => value === null || value <= 12,
    "A altura padrao nao pode exceder 12 metros.",
  ).optional(),
  expectedFloors: optionalPositiveInteger.optional(),
  accessDifficulty: z.enum(["low", "medium", "high"]).nullable().optional(),
  requiresMaterialLift: z.boolean().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const steelFrameWallSegmentSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Identifique o trecho de parede.").max(160),
  lengthMeters: positiveNumber.max(1000),
  heightMeters: positiveNumber.max(20),
  quantity: z.number().int().min(1).max(10000),
  confirmationStatus: z.enum(steelFrameConfirmationStatuses),
  sourceDescription: z.string().trim().max(1000).nullable().optional(),
  sourceData: z.record(z.string(), z.unknown()).optional(),
});

export const steelFrameOpeningSchema = z.object({
  id: z.string().uuid().optional(),
  wallSegmentId: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1, "Identifique a abertura.").max(160),
  openingType: z.enum(["door", "window", "garage", "opening", "other"]).default("other"),
  widthMeters: positiveNumber.max(50),
  heightMeters: positiveNumber.max(20),
  quantity: z.number().int().min(1).max(10000),
  subtractFromWallArea: z.boolean(),
  confirmationStatus: z.enum(steelFrameConfirmationStatuses),
  sourceDescription: z.string().trim().max(1000).nullable().optional(),
  sourceData: z.record(z.string(), z.unknown()).optional(),
});

export const steelFrameCalculationRuleSchema = z
  .object({
    ruleType: z.enum(steelFrameCalculationRuleTypes),
    parameters: z.record(z.string(), nonNegativeNumber).default({}),
    wastePercent: nonNegativeNumber.max(100).optional(),
    roundingMode: z.enum(steelFrameRoundingModes).optional(),
    roundingMultiple: positiveNumber.max(100000).optional(),
    manualQuantity: nonNegativeNumber.optional(),
  })
  .superRefine((rule, context) => {
    const requireParameter = (name: string) => {
      if (!rule.parameters[name] || rule.parameters[name] <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parameters", name],
          message: `Configure ${name} para esta regra de calculo.`,
        });
      }
    };

    switch (rule.ruleType) {
      case "STUD_BY_SPACING":
        requireParameter("spacingMeters");
        break;
      case "BOARD_BY_AREA":
      case "ROLL_BY_COVERAGE":
      case "PACKAGE_BY_COVERAGE":
      case "FASTENER_BY_AREA":
        requireParameter("coveragePerUnit");
        break;
      case "FASTENER_BY_BOARD":
        requireParameter("unitsPerBoard");
        break;
      case "FASTENER_BY_STUD":
        requireParameter("unitsPerStud");
        break;
      case "FIXED_PER_OPENING":
        requireParameter("unitsPerOpening");
        break;
      case "FIXED_PER_PROJECT":
        requireParameter("unitsPerProject");
        break;
      case "LINEAR_BY_OPENING":
        requireParameter("unitsPerLinearMeter");
        break;
      case "MANUAL":
        if (rule.manualQuantity === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["manualQuantity"],
            message: "Informe a quantidade manual.",
          });
        }
        break;
      case "TRACK_BY_LINEAR_LENGTH":
        break;
    }
  });

export const steelFrameCommercialComponentsSchema = z
  .object({
    directCost: nonNegativeNumber,
    contingencyPercentOfCost: nonNegativeNumber.max(100),
    taxPercentOfSale: nonNegativeNumber.max(99),
    salesCommissionPercentOfSale: nonNegativeNumber.max(99),
    platformCommissionPercentOfSale: nonNegativeNumber.max(99),
    targetMarginPercentOfSale: nonNegativeNumber.max(99),
    maxDiscountPercent: nonNegativeNumber.max(100),
  })
  .superRefine((components, context) => {
    const saleBasedPercent =
      components.taxPercentOfSale +
      components.salesCommissionPercentOfSale +
      components.platformCommissionPercentOfSale +
      components.targetMarginPercentOfSale;

    if (saleBasedPercent >= 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetMarginPercentOfSale"],
        message: "Impostos, comissoes e margem devem somar menos de 100%.",
      });
    }
  });

export const steelFrameCalculatedItemSchema = z.object({
  materialId: z.string().uuid(),
  label: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(32),
  rule: steelFrameCalculationRuleSchema,
  sourceValues: z.object({
    wallLengthMeters: nonNegativeNumber,
    wallAreaSquareMeters: nonNegativeNumber,
    openingCount: nonNegativeNumber,
    openingLinearMeters: nonNegativeNumber,
    boardCount: nonNegativeNumber,
    studCount: nonNegativeNumber,
    projectCount: nonNegativeNumber.optional(),
  }),
  rawQuantity: nonNegativeNumber,
  calculatedQuantity: nonNegativeNumber,
  unitCost: nonNegativeNumber,
  sourceData: z.record(z.string(), z.unknown()).optional(),
  requiresTechnicalReview: z.boolean().optional(),
  confirmationStatus: z.enum(steelFrameConfirmationStatuses).optional(),
});

export const steelFrameLaborItemSchema = z.object({
  label: z.string().trim().min(1, "Informe a mao de obra.").max(160),
  quantity: positiveNumber.max(100000),
  unit: z.string().trim().min(1, "Informe a unidade.").max(32),
  unitCost: nonNegativeNumber.max(100000000),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const steelFrameOperationalCostSchema = z.object({
  category: z.string().trim().min(1, "Informe a categoria.").max(120),
  label: z.string().trim().min(1, "Informe o custo operacional.").max(160),
  amount: nonNegativeNumber.max(100000000),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const steelFrameCalculatedItemAdjustmentSchema = z.object({
  label: z.string().trim().min(1, "Informe o material.").max(160),
  calculatedQuantity: nonNegativeNumber.max(100000000),
  unitCost: nonNegativeNumber.max(100000000),
  justification: z
    .string()
    .trim()
    .min(3, "Explique por que o item foi ajustado.")
    .max(1000),
});

export const steelFrameCostItemArchiveSchema = z.object({
  estimateId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemType: z.enum(["calculated", "labor", "operational"]),
  reason: z
    .string()
    .trim()
    .min(3, "Informe o motivo do arquivamento.")
    .max(1000),
});

const steelFrameMaterialMetadataSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do material.").max(160),
  category: z.string().trim().min(2, "Informe a categoria.").max(120),
  unit: z.string().trim().min(1, "Informe a unidade.").max(32),
  sku: z.string().trim().max(120).nullable().optional(),
});

export const steelFrameMaterialDraftSchema = steelFrameMaterialMetadataSchema.extend({
  initialUnitCost: nonNegativeNumber.max(100000000).nullable().optional(),
});

export const steelFrameMaterialUpdateSchema = steelFrameMaterialMetadataSchema.extend({
  materialId: z.string().uuid(),
});

export const steelFrameMaterialPriceSchema = z.object({
  materialId: z.string().uuid(),
  unitCost: nonNegativeNumber.max(100000000),
  effectiveFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de vigencia."),
  sourceReference: z.string().trim().min(3, "Informe a fonte do preco.").max(500),
});

export const steelFrameMaterialArchiveSchema = z.object({
  materialId: z.string().uuid(),
  reason: z.string().trim().min(3, "Informe o motivo do arquivamento.").max(1000),
});

export const steelFrameEstimateVersionSchema = z.object({
  estimateId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  status: z.enum(steelFrameEstimateStatuses),
  snapshot: z.record(z.string(), z.unknown()),
  technicalReviewNotes: z.string().trim().max(10000).nullable().optional(),
});

export const steelFrameAIEvidenceSchema = z.object({
  sourceDocumentId: z.string().uuid().nullable().optional(),
  pageNumber: z.number().int().positive().nullable().optional(),
  sourceText: z.string().trim().max(5000).nullable().optional(),
  boundingBox: z
    .object({
      x: nonNegativeNumber,
      y: nonNegativeNumber,
      width: positiveNumber,
      height: positiveNumber,
    })
    .nullable()
    .optional(),
});

export const steelFrameAIExtractionSchema = z.object({
  field: z.string().trim().min(1).max(160),
  value: z.unknown().nullable(),
  confidence: nonNegativeNumber.max(1),
  confirmationStatus: z.enum(steelFrameConfirmationStatuses),
  evidence: steelFrameAIEvidenceSchema,
});

const jsonObjectSchema = z.record(z.string(), z.unknown());
const technicalCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/, "Use letras, numeros, hifen ou sublinhado no codigo.");
const optionalShortText = z.string().trim().max(160).nullable().optional();
const optionalLongText = z.string().trim().max(5000).nullable().optional();
const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD.")
  .nullable()
  .optional();

export const steelFrameTechnicalLimitsSchema = z
  .object({
    maxWallHeightMeters: optionalPositiveNumber.optional(),
    maxFloors: optionalPositiveInteger.optional(),
    allowedStudSpacingMeters: z.array(positiveNumber.max(10)).max(20).optional(),
    maxOpeningWidthMeters: optionalPositiveNumber.optional(),
    requiresWindValidation: z.boolean().nullable().optional(),
    requiresRoofReview: z.boolean().nullable().optional(),
    requiresTechnicalReview: z.boolean().nullable().optional(),
  })
  .passthrough();

export const steelFrameTechnicalRuleDraftSchema = z.object({
  code: technicalCodeSchema,
  version: z.string().trim().min(1, "Informe a versao.").max(64),
  name: z.string().trim().min(3, "Informe o nome da regra.").max(180),
  ruleType: z.string().trim().min(2, "Informe o tipo da regra.").max(80),
  origin: z.enum(steelFrameTechnicalRuleOrigins),
  referenceName: z.string().trim().min(2, "Informe a fonte da regra.").max(180),
  referenceVersion: z.string().trim().min(1, "Informe a versao da fonte.").max(80),
  permittedUse: optionalLongText,
  applicationScope: jsonObjectSchema.default({}),
  conditions: jsonObjectSchema.default({}),
  parameters: jsonObjectSchema.default({}),
  limits: steelFrameTechnicalLimitsSchema.default({}),
  technicalResponsibleName: optionalShortText,
  technicalResponsibleRegistration: optionalShortText,
  approvalNotes: optionalLongText,
  effectiveFrom: optionalDate,
  effectiveTo: optionalDate,
  sourceId: z.string().uuid().nullable().default(null),
  sourceDocumentId: z.string().uuid().nullable().default(null),
}).superRefine((input, context) => {
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveTo"],
      message: "A vigencia final nao pode ser anterior a vigencia inicial.",
    });
  }
  if (input.sourceDocumentId && !input.sourceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceDocumentId"],
      message: "Selecione a fonte tecnica antes de vincular um documento.",
    });
  }
});

export const steelFrameTechnicalCompositionDraftSchema = z.object({
  code: technicalCodeSchema,
  version: z.string().trim().min(1, "Informe a versao.").max(64),
  name: z.string().trim().min(3, "Informe o nome da composicao.").max(180),
  applicationType: z.enum(steelFrameTechnicalApplicationTypes),
  profileSpecification: optionalLongText,
  description: optionalLongText,
  permittedUse: optionalLongText,
  applicationScope: jsonObjectSchema.default({}),
  conditions: jsonObjectSchema.default({}),
  limits: steelFrameTechnicalLimitsSchema.default({}),
  technicalResponsibleName: optionalShortText,
  technicalResponsibleRegistration: optionalShortText,
  approvalNotes: optionalLongText,
  effectiveFrom: optionalDate,
  effectiveTo: optionalDate,
  ruleIds: z.array(z.string().uuid()).max(100).default([]),
  sourceId: z.string().uuid().nullable().default(null),
  sourceDocumentId: z.string().uuid().nullable().default(null),
}).superRefine((input, context) => {
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveTo"],
      message: "A vigencia final nao pode ser anterior a vigencia inicial.",
    });
  }
  if (input.sourceDocumentId && !input.sourceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceDocumentId"],
      message: "Selecione a fonte tecnica antes de vincular um documento.",
    });
  }
});

export type SteelFrameEstimateDraftInput = z.infer<typeof steelFrameEstimateDraftSchema>;
export type SteelFrameEstimateDraftFormInput = z.input<typeof steelFrameEstimateDraftSchema>;
export type SteelFrameWallSegmentInput = z.infer<typeof steelFrameWallSegmentSchema>;
export type SteelFrameOpeningInput = z.infer<typeof steelFrameOpeningSchema>;
export type SteelFrameCalculationRuleInput = z.infer<typeof steelFrameCalculationRuleSchema>;
export type SteelFrameCommercialComponentsInput = z.infer<
  typeof steelFrameCommercialComponentsSchema
>;
export type SteelFrameCalculatedItemInput = z.infer<typeof steelFrameCalculatedItemSchema>;
export type SteelFrameLaborItemInput = z.infer<typeof steelFrameLaborItemSchema>;
export type SteelFrameOperationalCostInput = z.infer<typeof steelFrameOperationalCostSchema>;
export type SteelFrameMaterialDraftInput = z.infer<typeof steelFrameMaterialDraftSchema>;
export type SteelFrameMaterialUpdateInput = z.infer<typeof steelFrameMaterialUpdateSchema>;
export type SteelFrameMaterialPriceInput = z.infer<typeof steelFrameMaterialPriceSchema>;
export type SteelFrameMaterialArchiveInput = z.infer<typeof steelFrameMaterialArchiveSchema>;
export type SteelFrameTechnicalRuleDraftInput = z.infer<typeof steelFrameTechnicalRuleDraftSchema>;
export type SteelFrameTechnicalCompositionDraftInput = z.infer<typeof steelFrameTechnicalCompositionDraftSchema>;
