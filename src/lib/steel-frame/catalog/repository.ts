import type {
  SteelFrameCatalogMaterialPrice,
  SteelFrameCatalogRuleDraft,
  SteelFrameCatalogSnapshot,
} from "./types";

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
  getRule(ruleId: string): Promise<SteelFrameCatalogRuleDraft | null>;
  listMaterialPrices(input: {
    materialId: string;
    materialVariantId?: string | null;
  }): Promise<SteelFrameCatalogMaterialPrice[]>;
  createSnapshot(input: SteelFrameCatalogSnapshotToPersist): Promise<{ id: string }>;
}
