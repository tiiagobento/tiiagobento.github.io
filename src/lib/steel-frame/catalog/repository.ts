import type {
  SteelFrameCatalogMaterialPrice,
  SteelFrameCatalogRuleDraft,
  SteelFrameCatalogSnapshot,
  SteelFrameCatalogTechnicalSource,
  SteelFrameCatalogTechnicalSourceDocument,
  SteelFrameCatalogTechnicalSourceDocumentDraft,
  SteelFrameCatalogTechnicalSourceDraft,
} from "./types";
import type {
  SteelFrameSupplierQuoteDraft,
  SteelFrameSupplierQuoteRecord,
} from "./supplier-quotes";

export type SteelFrameCatalogSnapshotToPersist = {
  estimateId: string;
  estimateVersionId: string | null;
  scenarioId: string | null;
  snapshotKind: "calculation" | "technical_review" | "proposal";
  contentSha256: string;
  snapshot: SteelFrameCatalogSnapshot;
};

// The deterministic engine consumes this interface instead of a Supabase client.
// A concrete storage adapter can change without changing calculation behavior.
export interface SteelFrameCatalogRepository {
  listTechnicalSources(): Promise<SteelFrameCatalogTechnicalSource[]>;
  createTechnicalSource(input: SteelFrameCatalogTechnicalSourceDraft): Promise<SteelFrameCatalogTechnicalSource>;
  listTechnicalSourceDocuments(sourceId: string): Promise<SteelFrameCatalogTechnicalSourceDocument[]>;
  createTechnicalSourceDocument(
    input: SteelFrameCatalogTechnicalSourceDocumentDraft,
  ): Promise<SteelFrameCatalogTechnicalSourceDocument>;
  deleteTechnicalSourceDocument(documentId: string): Promise<void>;
  listSupplierQuotes(): Promise<SteelFrameSupplierQuoteRecord[]>;
  createSupplierQuote(input: SteelFrameSupplierQuoteDraft): Promise<{ id: string }>;
  listApprovedRules(): Promise<SteelFrameCatalogRuleDraft[]>;
  getRule(ruleId: string): Promise<SteelFrameCatalogRuleDraft | null>;
  listMaterialPrices(input: {
    materialId: string;
    materialVariantId?: string | null;
  }): Promise<SteelFrameCatalogMaterialPrice[]>;
  createSnapshot(input: SteelFrameCatalogSnapshotToPersist): Promise<{ id: string }>;
}
