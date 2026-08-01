import { z } from "zod";

import {
  steelFrameEngineAlertSeverities,
  steelFrameEngineApprovalStatuses,
  steelFrameEngineBlockingPatterns,
  steelFrameEngineFutureRuleStrategies,
  steelFrameEngineJunctionTypes,
  steelFrameEngineOpeningTreatments,
  steelFrameEngineRoundingModes,
  steelFrameEngineRuleStrategies,
  steelFrameEngineUnits,
} from "./types";

const finiteNonNegative = z.number().finite().min(0);
const finitePositive = z.number().finite().positive();
const finitePositiveInteger = z.number().int().min(1);
const identifier = z.string().trim().min(1).max(160);

export const steelFrameEngineUnitSchema = z.enum(steelFrameEngineUnits);
export const steelFrameEngineApprovalStatusSchema = z.enum(steelFrameEngineApprovalStatuses);
export const steelFrameEngineRoundingModeSchema = z.enum(steelFrameEngineRoundingModes);

export const steelFrameEngineTechnicalSourceSchema = z.object({
  name: identifier,
  version: identifier,
  documentReference: z.string().trim().max(500).nullable().default(null),
  pageReference: z.string().trim().max(120).nullable().default(null),
  approvedBy: z.string().trim().max(160).nullable().default(null),
});

export const steelFrameEngineMeasurementSchema = z.object({
  value: finiteNonNegative,
  unit: steelFrameEngineUnitSchema,
});

export const steelFrameEngineWallSegmentSchema = z.object({
  id: identifier,
  label: identifier,
  lengthMeters: finitePositive,
});

export const steelFrameEngineOpeningReinforcementTemplateSchema = z.object({
  id: identifier,
  name: identifier,
  approvalStatus: steelFrameEngineApprovalStatusSchema,
  maxOpeningWidthMeters: finitePositive.nullable().default(null),
  extraStudsPerOpening: finiteNonNegative.default(0),
  lintelMetersPerOpening: finiteNonNegative.default(0),
  sillMetersPerOpening: finiteNonNegative.default(0),
  openingTrackMetersPerOpening: finiteNonNegative.default(0),
  blockingTrackMetersPerOpening: finiteNonNegative.default(0),
  fastenersPerOpening: finiteNonNegative.default(0),
  cutLossPercent: finiteNonNegative.max(100).default(0),
  source: steelFrameEngineTechnicalSourceSchema.nullable().default(null),
});

export const steelFrameEngineOpeningSchema = z.object({
  id: identifier,
  wallId: identifier.nullable().default(null),
  label: identifier,
  openingType: z.enum(["door", "window", "garage", "opening", "other"]),
  widthMeters: finitePositive,
  heightMeters: finitePositive,
  quantity: finitePositiveInteger,
  requiresReinforcement: z.boolean().default(false),
  reinforcementTemplate: steelFrameEngineOpeningReinforcementTemplateSchema.nullable().default(null),
});

export const steelFrameEngineWallSchema = z.object({
  id: identifier,
  label: identifier,
  lengthMeters: finitePositive,
  heightMeters: finitePositive,
  quantity: finitePositiveInteger,
  segments: z.array(steelFrameEngineWallSegmentSchema).default([]),
  cavityWidthMeters: finitePositive.nullable().default(null),
  source: steelFrameEngineTechnicalSourceSchema.nullable().default(null),
});

export const steelFrameEngineJunctionSchema = z.object({
  id: identifier,
  type: z.enum(steelFrameEngineJunctionTypes),
  wallIds: z.array(identifier).min(1),
  extraStuds: finiteNonNegative.default(0),
  extraTrackMeters: finiteNonNegative.default(0),
  description: z.string().trim().max(500).nullable().default(null),
});

export const steelFrameEngineCommercialBarSchema = z.object({
  id: identifier,
  label: identifier,
  lengthMeters: finitePositive,
  availableQuantity: z.number().int().min(0).nullable().default(null),
});

export const steelFrameEngineReusableLeftoverSchema = z.object({
  id: identifier,
  label: identifier,
  lengthMeters: finitePositive,
  source: z.string().trim().max(200).nullable().default(null),
});

export const steelFrameEngineTechnicalPieceSchema = z.object({
  id: identifier,
  label: identifier,
  quantity: finitePositiveInteger,
  lengthMeters: finitePositive,
  source: identifier,
});

export const steelFrameEnginePackageSchema = z.object({
  id: identifier,
  label: identifier,
  unit: steelFrameEngineUnitSchema,
  capacity: steelFrameEngineMeasurementSchema,
});

export const steelFrameEngineMaterialSchema = z.object({
  id: identifier,
  name: identifier,
  category: identifier,
  technicalUnit: steelFrameEngineUnitSchema,
  purchaseUnit: steelFrameEngineUnitSchema,
  package: steelFrameEnginePackageSchema.nullable().default(null),
  compatibleCompositionLayerIds: z.array(identifier).default([]),
});

export const steelFrameEngineCompositionLayerSchema = z.object({
  id: identifier,
  position: identifier,
  materialFamily: identifier,
  faces: finitePositiveInteger,
  layers: finitePositiveInteger,
  condition: z.string().trim().max(500).nullable().default(null),
  source: steelFrameEngineTechnicalSourceSchema.nullable().default(null),
});

export const steelFrameEngineCompositionSchema = z.object({
  id: identifier,
  code: identifier,
  version: identifier,
  name: identifier,
  approvalStatus: steelFrameEngineApprovalStatusSchema,
  maxWallHeightMeters: finitePositive.nullable().default(null),
  layers: z.array(steelFrameEngineCompositionLayerSchema).default([]),
  source: steelFrameEngineTechnicalSourceSchema.nullable().default(null),
});

export const steelFrameEngineCalculationContextSchema = z.object({
  projectCount: finitePositiveInteger.default(1),
  walls: z.array(steelFrameEngineWallSchema).default([]),
  openings: z.array(steelFrameEngineOpeningSchema).default([]),
  junctions: z.array(steelFrameEngineJunctionSchema).default([]),
  composition: steelFrameEngineCompositionSchema.nullable().default(null),
  missingInformation: z.array(identifier).default([]),
});

const steelFrameEngineRuleScopeSchema = z.object({
  wallIds: z.array(identifier).default([]),
  openingIds: z.array(identifier).default([]),
});

const steelFrameEngineRuleLimitsSchema = z.object({
  maxWallHeightMeters: finitePositive.nullable().default(null),
  maxOpeningWidthMeters: finitePositive.nullable().default(null),
});

const steelFrameEngineRuleMetadataSchema = z.object({
  id: identifier,
  code: identifier,
  name: identifier,
  version: identifier,
  approvalStatus: steelFrameEngineApprovalStatusSchema,
  source: steelFrameEngineTechnicalSourceSchema,
  technicalUnit: steelFrameEngineUnitSchema,
  purchaseUnit: steelFrameEngineUnitSchema,
  acceptedInputUnits: z.array(steelFrameEngineUnitSchema).min(1),
  wastePercent: finiteNonNegative.max(100).default(0),
  roundingMode: steelFrameEngineRoundingModeSchema.default("ceil"),
  roundingMultiple: finitePositive.default(1),
  scope: steelFrameEngineRuleScopeSchema.default({ wallIds: [], openingIds: [] }),
  limits: steelFrameEngineRuleLimitsSchema.default({
    maxWallHeightMeters: null,
    maxOpeningWidthMeters: null,
  }),
});

const steelFrameEngineStockParametersSchema = z.object({
  commercialBars: z.array(steelFrameEngineCommercialBarSchema).min(1),
  kerfMeters: finiteNonNegative.default(0),
  reusableLeftovers: z.array(steelFrameEngineReusableLeftoverSchema).default([]),
  minimumReusableLeftoverMeters: finiteNonNegative.default(0),
});

const steelFrameEngineStudRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("STUD_BY_SPACING"),
  parameters: z.object({
    spacingMeters: finitePositive,
    initialStudsPerWall: finiteNonNegative,
    endStudsPerWall: finiteNonNegative,
    manualExtraStuds: finiteNonNegative,
    commercialStock: steelFrameEngineStockParametersSchema,
  }),
});

const steelFrameEngineTrackRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("TRACK_BY_WALL_LENGTH"),
  parameters: z.object({
    lowerRunsPerWall: finiteNonNegative,
    upperRunsPerWall: finiteNonNegative,
    openingTrackMetersPerOpening: finiteNonNegative,
    blockingTrackMetersPerWall: finiteNonNegative,
    lintelTrackMetersPerOpening: finiteNonNegative,
    sillTrackMetersPerOpening: finiteNonNegative,
    manualTrackMeters: finiteNonNegative,
    commercialStock: steelFrameEngineStockParametersSchema,
  }),
});

const steelFrameEngineBlockingRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("BLOCKING_BY_STUD_PATTERN"),
  parameters: z.object({
    pattern: z.enum(steelFrameEngineBlockingPatterns),
    spacingMeters: finitePositive,
    pieceLengthMeters: finitePositive,
    lines: z.number().int().min(0),
    verticalIntervalMeters: finitePositive.nullable().default(null),
    fixedQuantityPerWall: finiteNonNegative,
    manualQuantityPerWall: finiteNonNegative,
    commercialStock: steelFrameEngineStockParametersSchema,
  }),
});

const steelFrameEngineBoardRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("BOARD_BY_AREA_COEFFICIENT"),
  parameters: z.object({
    coverageSquareMetersPerBoard: finitePositive,
    boardsPerPackage: finitePositiveInteger,
    faces: finitePositiveInteger,
    layers: finitePositiveInteger,
    openingTreatment: z.enum(steelFrameEngineOpeningTreatments),
    openingMinimumAreaSquareMeters: finiteNonNegative,
  }),
});

const steelFrameEngineMembraneRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("MEMBRANE_BY_AREA"),
  parameters: z.object({
    coverageSquareMetersPerRoll: finitePositive,
    rollsPerPurchaseUnit: finitePositiveInteger,
    faces: finitePositiveInteger,
    layers: finitePositiveInteger,
    overlapPercent: finiteNonNegative.max(100),
    openingTreatment: z.enum(steelFrameEngineOpeningTreatments),
    openingMinimumAreaSquareMeters: finiteNonNegative,
  }),
});

const steelFrameEngineInsulationRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("INSULATION_BY_AREA"),
  parameters: z.object({
    coverageSquareMetersPerPackage: finitePositive,
    faces: finitePositiveInteger,
    layers: finitePositiveInteger,
    openingTreatment: z.enum(steelFrameEngineOpeningTreatments),
    openingMinimumAreaSquareMeters: finiteNonNegative,
    compatibleCavityWidthsMeters: z.array(finitePositive).default([]),
  }),
});

const steelFrameEngineFastenerAreaRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("FASTENER_BY_AREA"),
  parameters: z.object({
    unitsPerSquareMeter: finitePositive,
    unitsPerBox: finitePositiveInteger,
    openingTreatment: z.enum(steelFrameEngineOpeningTreatments),
    openingMinimumAreaSquareMeters: finiteNonNegative,
  }),
});

const steelFrameEngineFastenerBoardRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("FASTENER_BY_BOARD"),
  parameters: z.object({
    boardQuantity: finiteNonNegative,
    unitsPerBoard: finitePositive,
    unitsPerBox: finitePositiveInteger,
  }),
});

const steelFrameEngineFixedPerOpeningRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("FIXED_PER_OPENING"),
  parameters: z.object({
    unitsPerOpening: finitePositive,
    unitsPerPurchaseUnit: finitePositiveInteger,
  }),
});

const steelFrameEngineFixedPerProjectRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("FIXED_PER_PROJECT"),
  parameters: z.object({
    unitsPerProject: finitePositive,
    unitsPerPurchaseUnit: finitePositiveInteger,
  }),
});

const steelFrameEngineManualRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("MANUAL"),
  parameters: z.object({
    technicalQuantity: finiteNonNegative,
    unitsPerPurchaseUnit: finitePositive,
    justification: z.string().trim().min(3).max(1000),
  }),
});

const steelFrameEngineCuttingStockRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("CUTTING_STOCK_OPTIMIZATION"),
  parameters: steelFrameEngineStockParametersSchema.extend({
    pieces: z.array(steelFrameEngineTechnicalPieceSchema).min(1),
  }),
});

const steelFrameEnginePackagingRuleSchema = steelFrameEngineRuleMetadataSchema.extend({
  strategy: z.literal("PACKAGING_ROUNDING"),
  parameters: z.object({
    technicalQuantity: finiteNonNegative,
    unitsPerPurchaseUnit: finitePositive,
  }),
});

export const steelFrameEngineRuleSchema = z.discriminatedUnion("strategy", [
  steelFrameEngineStudRuleSchema,
  steelFrameEngineTrackRuleSchema,
  steelFrameEngineBlockingRuleSchema,
  steelFrameEngineBoardRuleSchema,
  steelFrameEngineMembraneRuleSchema,
  steelFrameEngineInsulationRuleSchema,
  steelFrameEngineFastenerAreaRuleSchema,
  steelFrameEngineFastenerBoardRuleSchema,
  steelFrameEngineFixedPerOpeningRuleSchema,
  steelFrameEngineFixedPerProjectRuleSchema,
  steelFrameEngineManualRuleSchema,
  steelFrameEngineCuttingStockRuleSchema,
  steelFrameEnginePackagingRuleSchema,
]);

export const steelFrameEngineCalculationRequestSchema = z.object({
  rule: steelFrameEngineRuleSchema,
  context: steelFrameEngineCalculationContextSchema,
});

export const steelFrameEngineCuttingPlanInputSchema = z.object({
  pieces: z.array(steelFrameEngineTechnicalPieceSchema).min(1),
  commercialBars: z.array(steelFrameEngineCommercialBarSchema).min(1),
  kerfMeters: finiteNonNegative.default(0),
  reusableLeftovers: z.array(steelFrameEngineReusableLeftoverSchema).default([]),
  minimumReusableLeftoverMeters: finiteNonNegative.default(0),
});

export const steelFrameEngineAlertSchema = z.object({
  code: identifier,
  severity: z.enum(steelFrameEngineAlertSeverities),
  message: identifier,
});

export const steelFrameEngineFutureRuleStrategySchema = z.enum(steelFrameEngineFutureRuleStrategies);

export type SteelFrameEngineRule = z.infer<typeof steelFrameEngineRuleSchema>;
export type SteelFrameEngineCalculationRequest = z.infer<
  typeof steelFrameEngineCalculationRequestSchema
>;
export type SteelFrameEngineCuttingPlanInput = z.infer<
  typeof steelFrameEngineCuttingPlanInputSchema
>;
