export const steelFrameEngineUnits = [
  "mm",
  "cm",
  "m",
  "m2",
  "unit",
  "piece",
  "bar",
  "board",
  "package",
  "roll",
  "box",
  "bag",
  "kg",
  "liter",
] as const;

export type SteelFrameEngineUnit = (typeof steelFrameEngineUnits)[number];

export const steelFrameEngineDimensionKinds = [
  "length",
  "area",
  "count",
  "mass",
  "volume",
] as const;

export type SteelFrameEngineDimensionKind =
  (typeof steelFrameEngineDimensionKinds)[number];

export const steelFrameEngineRoundingModes = ["none", "ceil", "floor", "nearest"] as const;
export type SteelFrameEngineRoundingMode =
  (typeof steelFrameEngineRoundingModes)[number];

export const steelFrameEngineTechnicalStatuses = [
  "automatic_eligible",
  "preliminary",
  "technical_review_required",
  "blocked",
] as const;

export type SteelFrameEngineTechnicalStatus =
  (typeof steelFrameEngineTechnicalStatuses)[number];

export const steelFrameEngineApprovalStatuses = [
  "draft",
  "pending_validation",
  "approved",
  "deprecated",
  "archived",
] as const;

export type SteelFrameEngineApprovalStatus =
  (typeof steelFrameEngineApprovalStatuses)[number];

export const steelFrameEngineRuleStrategies = [
  "STUD_BY_SPACING",
  "TRACK_BY_WALL_LENGTH",
  "BLOCKING_BY_STUD_PATTERN",
  "BOARD_BY_AREA_COEFFICIENT",
  "MEMBRANE_BY_AREA",
  "INSULATION_BY_AREA",
  "FASTENER_BY_AREA",
  "FASTENER_BY_BOARD",
  "FIXED_PER_OPENING",
  "FIXED_PER_PROJECT",
  "MANUAL",
  "CUTTING_STOCK_OPTIMIZATION",
  "PACKAGING_ROUNDING",
] as const;

export type SteelFrameEngineRuleStrategy =
  (typeof steelFrameEngineRuleStrategies)[number];

// Reserved for a later phase. It is deliberately not an executable strategy yet.
export const steelFrameEngineFutureRuleStrategies = ["BOARD_BY_PANEL_LAYOUT"] as const;

export type SteelFrameEngineFutureRuleStrategy =
  (typeof steelFrameEngineFutureRuleStrategies)[number];

export const steelFrameEngineOpeningTreatments = [
  "do_not_deduct",
  "deduct_all",
  "deduct_above_area",
] as const;

export type SteelFrameEngineOpeningTreatment =
  (typeof steelFrameEngineOpeningTreatments)[number];

export const steelFrameEngineBlockingPatterns = [
  "alternate",
  "all_cells",
  "fixed_lines",
  "vertical_interval",
  "fixed_quantity",
  "manual",
] as const;

export type SteelFrameEngineBlockingPattern =
  (typeof steelFrameEngineBlockingPatterns)[number];

export const steelFrameEngineJunctionTypes = [
  "external_corner",
  "internal_corner",
  "t_junction",
  "cross_junction",
  "existing_structure",
  "free_start",
  "free_end",
] as const;

export type SteelFrameEngineJunctionType =
  (typeof steelFrameEngineJunctionTypes)[number];

export const steelFrameEngineAlertSeverities = ["info", "warning", "critical"] as const;
export type SteelFrameEngineAlertSeverity =
  (typeof steelFrameEngineAlertSeverities)[number];

export type SteelFrameEngineMeasurement = {
  value: number;
  unit: SteelFrameEngineUnit;
};

export type SteelFrameEngineRounding = {
  mode: SteelFrameEngineRoundingMode;
  multiple: number;
  appliedValue: number;
};

export type SteelFrameEngineWaste = {
  configuredPercent: number;
  quantity: SteelFrameEngineMeasurement;
  reason: string | null;
};

export type SteelFrameEngineAlert = {
  code: string;
  severity: SteelFrameEngineAlertSeverity;
  message: string;
};

export type SteelFrameEngineTechnicalSource = {
  name: string;
  version: string;
  documentReference: string | null;
  pageReference: string | null;
  approvedBy: string | null;
};

export type SteelFrameEngineRuleSnapshot = {
  id: string;
  code: string;
  name: string;
  strategy: SteelFrameEngineRuleStrategy;
  version: string;
  approvalStatus: SteelFrameEngineApprovalStatus;
  source: SteelFrameEngineTechnicalSource;
};

export type SteelFrameEngineWallSegment = {
  id: string;
  label: string;
  lengthMeters: number;
};

export type SteelFrameEngineOpeningReinforcementTemplate = {
  id: string;
  name: string;
  approvalStatus: SteelFrameEngineApprovalStatus;
  maxOpeningWidthMeters: number | null;
  extraStudsPerOpening: number;
  lintelMetersPerOpening: number;
  sillMetersPerOpening: number;
  openingTrackMetersPerOpening: number;
  blockingTrackMetersPerOpening: number;
  fastenersPerOpening: number;
  cutLossPercent: number;
  source: SteelFrameEngineTechnicalSource | null;
};

export type SteelFrameEngineOpening = {
  id: string;
  wallId: string | null;
  label: string;
  openingType: "door" | "window" | "garage" | "opening" | "other";
  widthMeters: number;
  heightMeters: number;
  quantity: number;
  requiresReinforcement: boolean;
  reinforcementTemplate: SteelFrameEngineOpeningReinforcementTemplate | null;
};

export type SteelFrameEngineWall = {
  id: string;
  label: string;
  lengthMeters: number;
  heightMeters: number;
  quantity: number;
  segments: SteelFrameEngineWallSegment[];
  cavityWidthMeters: number | null;
  source: SteelFrameEngineTechnicalSource | null;
};

export type SteelFrameEngineJunction = {
  id: string;
  type: SteelFrameEngineJunctionType;
  wallIds: string[];
  extraStuds: number;
  extraTrackMeters: number;
  description: string | null;
};

export type SteelFrameEngineTechnicalPiece = {
  id: string;
  label: string;
  quantity: number;
  lengthMeters: number;
  source: string;
};

export type SteelFrameEngineCommercialBar = {
  id: string;
  label: string;
  lengthMeters: number;
  availableQuantity: number | null;
};

export type SteelFrameEngineReusableLeftover = {
  id: string;
  label: string;
  lengthMeters: number;
  source: string | null;
};

export type SteelFrameEnginePackage = {
  id: string;
  label: string;
  unit: SteelFrameEngineUnit;
  capacity: SteelFrameEngineMeasurement;
};

export type SteelFrameEngineMaterial = {
  id: string;
  name: string;
  category: string;
  technicalUnit: SteelFrameEngineUnit;
  purchaseUnit: SteelFrameEngineUnit;
  package: SteelFrameEnginePackage | null;
  compatibleCompositionLayerIds: string[];
};

export type SteelFrameEngineCompositionLayer = {
  id: string;
  position: string;
  materialFamily: string;
  faces: number;
  layers: number;
  condition: string | null;
  source: SteelFrameEngineTechnicalSource | null;
};

export type SteelFrameEngineComposition = {
  id: string;
  code: string;
  version: string;
  name: string;
  approvalStatus: SteelFrameEngineApprovalStatus;
  maxWallHeightMeters: number | null;
  layers: SteelFrameEngineCompositionLayer[];
  source: SteelFrameEngineTechnicalSource | null;
};

export type SteelFrameEngineCalculationContext = {
  projectCount: number;
  walls: SteelFrameEngineWall[];
  openings: SteelFrameEngineOpening[];
  junctions: SteelFrameEngineJunction[];
  composition: SteelFrameEngineComposition | null;
  missingInformation: string[];
};

export type SteelFrameEngineExplanationLine = {
  label: string;
  value: string;
};

export type SteelFrameEngineCalculationExplanation = {
  title: string;
  strategy: SteelFrameEngineRuleStrategy | null;
  summary: string;
  inputs: SteelFrameEngineExplanationLine[];
  parameters: SteelFrameEngineExplanationLine[];
  subtotals: SteelFrameEngineExplanationLine[];
  purchase: SteelFrameEngineExplanationLine[];
  text: string;
};

export type SteelFrameEnginePurchaseQuantity = {
  quantity: number;
  unit: SteelFrameEngineUnit;
  capacityPerPurchaseUnit: SteelFrameEngineMeasurement;
  coveredTechnicalQuantity: number;
  estimatedLeftover: SteelFrameEngineMeasurement;
  rounding: SteelFrameEngineRounding;
};

export type SteelFrameEngineQuantityResult = {
  raw: SteelFrameEngineMeasurement;
  withWaste: SteelFrameEngineMeasurement;
  waste: SteelFrameEngineWaste;
  purchase: SteelFrameEnginePurchaseQuantity;
};

export type SteelFrameEngineCutPlacement = {
  pieceId: string;
  label: string;
  lengthMeters: number;
};

export type SteelFrameEngineCutBar = {
  id: string;
  sourceType: "commercial" | "leftover";
  sourceId: string;
  sourceLabel: string;
  lengthMeters: number;
  placements: SteelFrameEngineCutPlacement[];
  usedLengthMeters: number;
  kerfLossMeters: number;
  leftoverMeters: number;
  reusableLeftover: boolean;
};

export type SteelFrameEngineCutPattern = {
  stockLabel: string;
  pieceLengthsMeters: number[];
  count: number;
};

export type SteelFrameEngineCuttingPlan = {
  bars: SteelFrameEngineCutBar[];
  commercialBarsToPurchase: number;
  commercialBarsByStock: Array<{ stockId: string; stockLabel: string; quantity: number }>;
  totalRequiredPieceLengthMeters: number;
  totalCommercialLengthMeters: number;
  totalKerfLossMeters: number;
  totalLeftoverMeters: number;
  utilizationPercent: number;
  cutPatterns: SteelFrameEngineCutPattern[];
  reusableLeftovers: SteelFrameEngineReusableLeftover[];
};

export type SteelFrameEngineCalculationResult = {
  strategy: SteelFrameEngineRuleStrategy | null;
  classification: SteelFrameEngineTechnicalStatus;
  rule: SteelFrameEngineRuleSnapshot | null;
  quantities: SteelFrameEngineQuantityResult;
  technicalPieces: SteelFrameEngineTechnicalPiece[];
  cuttingPlan: SteelFrameEngineCuttingPlan | null;
  explanation: SteelFrameEngineCalculationExplanation;
  alerts: SteelFrameEngineAlert[];
};
