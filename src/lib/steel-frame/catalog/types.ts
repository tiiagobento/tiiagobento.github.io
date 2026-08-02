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

export const steelFrameCatalogTechnicalSourceStatuses = [
  "draft",
  "pending_validation",
  "approved",
  "deprecated",
  "archived",
] as const;

export type SteelFrameCatalogTechnicalSourceStatus =
  (typeof steelFrameCatalogTechnicalSourceStatuses)[number];

export type SteelFrameCatalogTechnicalSourceDraft = {
  title: string;
  sourceType: SteelFrameTechnicalSourceType;
  code: string | null;
  issuer: string | null;
  manufacturer: string | null;
  productName: string | null;
  edition: string | null;
  revision: string | null;
  publishedOn: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceUrl: string | null;
  contentSha256: string | null;
  permittedUse: string | null;
  notes: string | null;
};

export type SteelFrameCatalogTechnicalSourceDocument = {
  id: string;
  sourceId: string;
  originalFileName: string;
  storagePath: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  fileSizeBytes: number;
  pageCount: number | null;
  contentSha256: string | null;
  visibility: "catalog" | "restricted";
  notes: string | null;
  status: SteelFrameCatalogTechnicalSourceStatus;
  createdAt: string;
};

export type SteelFrameCatalogTechnicalSource = SteelFrameCatalogTechnicalSourceDraft & {
  id: string;
  createdBy: string;
  status: SteelFrameCatalogTechnicalSourceStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  deprecatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: SteelFrameCatalogTechnicalSourceDocument[];
};

export type SteelFrameCatalogTechnicalSourceDocumentDraft = {
  sourceId: string;
  originalFileName: string;
  storagePath: string;
  mimeType: SteelFrameCatalogTechnicalSourceDocument["mimeType"];
  fileSizeBytes: number;
  contentSha256?: string | null;
  visibility?: SteelFrameCatalogTechnicalSourceDocument["visibility"];
  notes?: string | null;
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
