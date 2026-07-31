export const steelFrameEstimateStatuses = [
  "draft",
  "needs_information",
  "in_review",
  "approved",
  "proposal_generated",
  "sent",
  "accepted",
  "expired",
  "cancelled",
] as const;

export type SteelFrameEstimateStatus = (typeof steelFrameEstimateStatuses)[number];

export const steelFrameFrozenEstimateStatuses = [
  "approved",
  "proposal_generated",
  "sent",
  "accepted",
  "expired",
  "cancelled",
] as const satisfies readonly SteelFrameEstimateStatus[];

export function isSteelFrameEstimateFrozenStatus(status: SteelFrameEstimateStatus) {
  return steelFrameFrozenEstimateStatuses.includes(status as (typeof steelFrameFrozenEstimateStatuses)[number]);
}

export const steelFrameCalculationRuleTypes = [
  "STUD_BY_SPACING",
  "TRACK_BY_LINEAR_LENGTH",
  "BOARD_BY_AREA",
  "ROLL_BY_COVERAGE",
  "PACKAGE_BY_COVERAGE",
  "FASTENER_BY_AREA",
  "FASTENER_BY_BOARD",
  "FASTENER_BY_STUD",
  "FIXED_PER_OPENING",
  "FIXED_PER_PROJECT",
  "LINEAR_BY_OPENING",
  "MANUAL",
] as const;

export type SteelFrameCalculationRuleType =
  (typeof steelFrameCalculationRuleTypes)[number];

export const steelFrameRoundingModes = ["none", "ceil", "nearest", "floor"] as const;
export type SteelFrameRoundingMode = (typeof steelFrameRoundingModes)[number];

export const steelFrameConfirmationStatuses = [
  "confirmed",
  "needs_confirmation",
  "not_applicable",
] as const;
export type SteelFrameConfirmationStatus =
  (typeof steelFrameConfirmationStatuses)[number];

export type SteelFrameEstimateMode = "commercial" | "technical";

export type SteelFrameWallSegmentInput = {
  id?: string;
  label: string;
  lengthMeters: number;
  heightMeters: number;
  quantity: number;
  confirmationStatus: SteelFrameConfirmationStatus;
  sourceDescription?: string | null;
};

export type SteelFrameOpeningInput = {
  id?: string;
  wallSegmentId?: string | null;
  label: string;
  openingType?: "door" | "window" | "garage" | "opening" | "other";
  widthMeters: number;
  heightMeters: number;
  quantity: number;
  subtractFromWallArea: boolean;
  confirmationStatus: SteelFrameConfirmationStatus;
  sourceDescription?: string | null;
};

export type SteelFrameAreaSummary = {
  grossWallArea: number;
  openingArea: number;
  netWallArea: number;
  warnings: string[];
};

export type SteelFrameCalculationContext = {
  wallLengthMeters: number;
  wallAreaSquareMeters: number;
  openingCount: number;
  openingLinearMeters: number;
  boardCount: number;
  studCount: number;
  projectCount?: number;
};

export type SteelFrameCalculationRule = {
  ruleType: SteelFrameCalculationRuleType;
  parameters: Record<string, number>;
  wastePercent?: number;
  roundingMode?: SteelFrameRoundingMode;
  roundingMultiple?: number;
  manualQuantity?: number;
};

export type SteelFrameCalculatedQuantity = {
  rawQuantity: number;
  quantityWithWaste: number;
  finalQuantity: number;
  unit: string;
  explanation: string;
};

export type SteelFrameCommercialComponents = {
  directCost: number;
  contingencyPercentOfCost: number;
  taxPercentOfSale: number;
  salesCommissionPercentOfSale: number;
  platformCommissionPercentOfSale: number;
  targetMarginPercentOfSale: number;
  maxDiscountPercent: number;
};

export type SteelFrameCommercialPricing = {
  contingencyAmount: number;
  minimumSalePrice: number;
  recommendedSalePrice: number;
  maximumAllowedDiscountAmount: number;
  minimumPriceAfterDiscount: number;
  warnings: string[];
};

export type SteelFrameEstimateDraft = {
  title: string;
  mode: SteelFrameEstimateMode;
  leadId?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  approximateAddress?: string | null;
  projectType?: string | null;
  standardWallHeightMeters?: number | null;
  expectedFloors?: number | null;
  accessDifficulty?: "low" | "medium" | "high" | null;
  requiresMaterialLift?: boolean | null;
  notes?: string | null;
};

export type SteelFrameEstimateRecord = {
  id: string;
  lead_id: string | null;
  created_by: string;
  commercial_responsible_id: string | null;
  technical_responsible_id: string | null;
  title: string;
  mode: SteelFrameEstimateMode;
  status: SteelFrameEstimateStatus;
  city: string | null;
  neighborhood: string | null;
  approximate_address: string | null;
  project_type: string | null;
  standard_wall_height_meters: number | null;
  expected_floors: number | null;
  access_difficulty: "low" | "medium" | "high" | null;
  requires_material_lift: boolean | null;
  notes: string | null;
  current_version_number: number;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    name: string;
    phone: string;
    city: string | null;
    neighborhood: string | null;
  } | null;
};

export type SteelFrameWallSegmentRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  label: string;
  section_name: string | null;
  length_meters: number;
  height_meters: number;
  quantity: number;
  gross_area_square_meters: number;
  confirmation_status: SteelFrameConfirmationStatus;
  source_data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SteelFrameOpeningRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  wall_segment_id: string | null;
  label: string;
  opening_type: "door" | "window" | "garage" | "opening" | "other";
  width_meters: number;
  height_meters: number;
  quantity: number;
  opening_area_square_meters: number;
  subtract_from_wall_area: boolean;
  confirmation_status: SteelFrameConfirmationStatus;
  source_data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SteelFrameMaterialRecord = {
  id: string;
  created_by: string;
  supplier_id: string | null;
  sku: string | null;
  name: string;
  category: string;
  unit: string;
  technical_specification: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
  prices?: Array<{
    id: string;
    unit_cost: number;
    currency: string;
    effective_from: string;
    effective_to: string | null;
  }>;
};

export type SteelFrameCalculatedItemRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  assembly_id: string | null;
  assembly_item_id: string | null;
  material_id: string | null;
  label: string;
  category: string;
  unit: string;
  calculation_rule: SteelFrameCalculationRuleType;
  rule_parameters: Record<string, number>;
  source_values: Record<string, number>;
  raw_quantity: number;
  waste_percent: number;
  calculated_quantity: number;
  unit_cost: number;
  total_cost: number;
  requires_technical_review: boolean;
  confirmation_status: SteelFrameConfirmationStatus;
  source_data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SteelFrameLaborItemRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  label: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SteelFrameOperationalCostRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  category: string;
  label: string;
  amount: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SteelFrameCommercialComponentRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  component_key: string;
  calculation_basis: "fixed" | "percent_of_cost" | "percent_of_sale";
  percentage: number | null;
  amount: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SteelFrameCostingSnapshot = {
  calculatedItems: SteelFrameCalculatedItemRecord[];
  laborItems: SteelFrameLaborItemRecord[];
  operationalCosts: SteelFrameOperationalCostRecord[];
  commercialComponents: SteelFrameCommercialComponentRecord[];
};

export type SteelFrameDocumentType =
  | "plant"
  | "sketch"
  | "facade"
  | "photo"
  | "quote"
  | "technical_document"
  | "reference"
  | "proposal";

export type SteelFrameDocumentVisibility = "commercial" | "technical" | "internal";

export type SteelFrameDocumentRecord = {
  id: string;
  estimate_id: string;
  estimate_version_id: string | null;
  uploaded_by: string;
  original_file_name: string;
  storage_path: string;
  processed_storage_path: string | null;
  mime_type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  file_size_bytes: number;
  page_count: number | null;
  document_type: SteelFrameDocumentType;
  visibility: SteelFrameDocumentVisibility;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SteelFrameCalculatedItemInput = {
  materialId: string;
  label: string;
  category: string;
  unit: string;
  rule: SteelFrameCalculationRule;
  sourceValues: SteelFrameCalculationContext;
  rawQuantity: number;
  calculatedQuantity: number;
  unitCost: number;
  sourceData?: Record<string, unknown>;
  requiresTechnicalReview?: boolean;
  confirmationStatus?: SteelFrameConfirmationStatus;
};

export type SteelFrameLaborItemInput = {
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  notes?: string | null;
};

export type SteelFrameOperationalCostInput = {
  category: string;
  label: string;
  amount: number;
  notes?: string | null;
};
