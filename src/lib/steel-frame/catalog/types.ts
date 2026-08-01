import type {
  SteelFrameEngineApprovalStatus,
  SteelFrameEngineRuleStrategy,
  SteelFrameEngineUnit,
} from "../engine";

export const steelFrameCatalogLifecycleStatuses = [
  "draft",
  "pending_validation",
  "approved",
  "deprecated",
  "archived",
  "superseded",
] as const;

export type SteelFrameCatalogLifecycleStatus =
  (typeof steelFrameCatalogLifecycleStatuses)[number];

export const steelFrameTechnicalSourceTypes = [
  "standard",
  "guideline",
  "manual",
  "technical_sheet",
  "catalog",
  "structural_project",
  "memorial",
  "approved_composition",
  "internal_guidance",
  "installer_validated_method",
  "supplier_quote",
  "price_table",
  "calibration_case",
] as const;

export type SteelFrameTechnicalSourceType =
  (typeof steelFrameTechnicalSourceTypes)[number];

export type SteelFrameCatalogSourceReference = {
  sourceId: string | null;
  sourceDocumentId: string | null;
  sourceTitle: string | null;
  sourceVersion: string | null;
  documentReference: string | null;
  pageReference: string | null;
};

export type SteelFrameCatalogRuleDraft = {
  id: string;
  code: string;
  version: string;
  name: string;
  strategyType: SteelFrameEngineRuleStrategy;
  parameterSchemaVersion: number;
  technicalInputUnit: SteelFrameEngineUnit;
  purchaseUnit: SteelFrameEngineUnit;
  parameters: unknown;
  limits: Record<string, unknown>;
  scope: {
    wallIds: string[];
    openingIds: string[];
  };
  wastePercent: number;
  roundingMode: "none" | "ceil" | "floor" | "nearest";
  roundingMultiple: number;
  source: SteelFrameCatalogSourceReference;
  status: SteelFrameCatalogLifecycleStatus;
  technicalResponsibleName: string | null;
  technicalResponsibleRegistration: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  approvedBy: string | null;
};

export type SteelFrameCatalogRuleValidation = {
  rule: SteelFrameCatalogRuleDraft | null;
  errors: Array<{ path: string; message: string }>;
  engineRule: Record<string, unknown> | null;
};

export type SteelFrameCatalogMaterialPrice = {
  id: string;
  materialId: string;
  materialVariantId: string | null;
  supplierId: string | null;
  unitCost: number;
  currency: "BRL";
  effectiveFrom: string;
  effectiveTo: string | null;
  preferred: boolean;
  eligibleForAutomaticSelection: boolean;
  isManualOverride: boolean;
  createdAt: string;
};

export type SteelFrameCatalogPriceSelection = {
  price: SteelFrameCatalogMaterialPrice | null;
  selectionReason:
    | "manual_override"
    | "preferred_vendor"
    | "lowest_valid_price"
    | "newest_valid_price"
    | "missing_price";
  alerts: string[];
};

export type SteelFrameCatalogCompatibility = {
  id: string;
  sourceMaterialId: string | null;
  sourceMaterialVariantId: string | null;
  relatedMaterialId: string | null;
  relatedMaterialVariantId: string | null;
  relationshipType: "requires" | "allows" | "excludes" | "replaces";
  status: SteelFrameCatalogLifecycleStatus;
  notes: string | null;
};

export type SteelFrameCatalogSelection = {
  materialId: string | null;
  materialVariantId: string | null;
  label: string;
};

export type SteelFrameCatalogCompatibilityValidation = {
  errors: string[];
  warnings: string[];
};

export type SteelFrameCatalogSnapshotInput = {
  estimateId: string;
  estimateVersionId: string | null;
  scenarioId: string | null;
  rules: SteelFrameCatalogRuleDraft[];
  selectedPrices: SteelFrameCatalogPriceSelection[];
  selectedMaterialIds: string[];
  selectedMaterialVariantIds: string[];
};

export type SteelFrameCatalogSnapshot = {
  schemaVersion: 1;
  estimateId: string;
  estimateVersionId: string | null;
  scenarioId: string | null;
  rules: Array<{
    id: string;
    code: string;
    version: string;
    strategyType: SteelFrameEngineRuleStrategy;
    status: SteelFrameEngineApprovalStatus;
    sourceId: string | null;
    sourceDocumentId: string | null;
    parameters: unknown;
    limits: Record<string, unknown>;
  }>;
  selectedPrices: Array<{
    priceId: string | null;
    selectionReason: SteelFrameCatalogPriceSelection["selectionReason"];
    unitCost: number | null;
    currency: "BRL" | null;
  }>;
  selectedMaterialIds: string[];
  selectedMaterialVariantIds: string[];
};
