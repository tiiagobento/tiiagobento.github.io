import { describe, expect, it } from "vitest";

import {
  buildSteelFrameCatalogSnapshot,
  selectSteelFrameCatalogPrice,
  sha256CatalogSnapshot,
  stableCatalogSnapshotJson,
  toEngineRuleForCalculation,
  validateSteelFrameCatalogCompatibility,
  validateSteelFrameCatalogRule,
} from "./service";
import type { SteelFrameCatalogRuleDraft } from "./types";

function makeRule(overrides: Partial<SteelFrameCatalogRuleDraft> = {}): SteelFrameCatalogRuleDraft {
  return {
    id: "rule-fastener-1",
    code: "NF-FASTENER-001",
    version: "1.0",
    name: "Fixador por area validado",
    strategyType: "FASTENER_BY_AREA",
    parameterSchemaVersion: 1,
    technicalInputUnit: "m2",
    purchaseUnit: "box",
    parameters: {
      unitsPerSquareMeter: 8,
      unitsPerBox: 100,
      openingTreatment: "deduct_all",
      openingMinimumAreaSquareMeters: 0,
    },
    limits: {},
    scope: { wallIds: [], openingIds: [] },
    wastePercent: 5,
    roundingMode: "ceil",
    roundingMultiple: 1,
    source: {
      sourceId: "source-1",
      sourceDocumentId: "document-1",
      sourceTitle: "Ficha tecnica homologada",
      sourceVersion: "1.0",
      documentReference: "ficha.pdf",
      pageReference: "p. 3",
    },
    status: "approved",
    technicalResponsibleName: "Responsavel tecnico",
    technicalResponsibleRegistration: "CREA 000000",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    approvedBy: "admin-1",
    ...overrides,
  };
}

function makePrice(overrides: Record<string, unknown> = {}) {
  return {
    id: "price-1",
    materialId: "material-1",
    materialVariantId: null,
    supplierId: "supplier-1",
    unitCost: 100,
    currency: "BRL" as const,
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    preferred: false,
    eligibleForAutomaticSelection: true,
    isManualOverride: false,
    createdAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("Steel Frame Phase 2 catalog service", () => {
  it("validates a typed rule against the deterministic engine before persistence", () => {
    const result = validateSteelFrameCatalogRule(makeRule());

    expect(result.errors).toEqual([]);
    expect(result.engineRule).toMatchObject({ strategy: "FASTENER_BY_AREA", approvalStatus: "approved" });
    expect(toEngineRuleForCalculation(makeRule()).strategy).toBe("FASTENER_BY_AREA");
  });

  it("blocks an approval missing its source document and technical accountability", () => {
    const result = validateSteelFrameCatalogRule(makeRule({
      source: { ...makeRule().source, sourceDocumentId: null },
      technicalResponsibleRegistration: null,
      effectiveFrom: null,
    }));

    expect(result.errors.map((error) => error.message).join(" ")).toContain("fonte e documento tecnico");
    expect(result.errors.map((error) => error.message).join(" ")).toContain("responsavel tecnico");
    expect(result.errors.map((error) => error.message).join(" ")).toContain("vigencia");
  });

  it("rejects parameters that do not match the selected typed strategy", () => {
    const result = validateSteelFrameCatalogRule(makeRule({ parameters: { unitsPerBox: 100 } }));

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.map((error) => error.message).join(" ")).toContain("unitsPerSquareMeter");
  });

  it("does not let a draft rule feed a final calculation", () => {
    const draft = makeRule({ status: "draft" });

    expect(() => toEngineRuleForCalculation(draft)).toThrow("Somente regras tecnicas aprovadas");
    expect(toEngineRuleForCalculation(draft, { allowPreliminary: true }).approvalStatus).toBe("draft");
  });

  it("selects prices in the documented order: manual, preferred, lowest, then newest", () => {
    const candidates = [
      makePrice({ id: "low", unitCost: 85 }),
      makePrice({ id: "preferred", unitCost: 120, preferred: true }),
      makePrice({ id: "manual", unitCost: 130, isManualOverride: true }),
    ];

    expect(selectSteelFrameCatalogPrice(candidates, "2026-08-01")).toMatchObject({
      selectionReason: "manual_override",
      price: { id: "manual" },
    });
    expect(selectSteelFrameCatalogPrice(candidates.filter((item) => item.id !== "manual"), "2026-08-01")).toMatchObject({
      selectionReason: "preferred_vendor",
      price: { id: "preferred" },
    });
    expect(selectSteelFrameCatalogPrice(candidates.filter((item) => item.id === "low"), "2026-08-01")).toMatchObject({
      selectionReason: "lowest_valid_price",
      price: { id: "low" },
    });
  });

  it("requires and excludes only approved compatibility rules", () => {
    const result = validateSteelFrameCatalogCompatibility(
      [{ materialId: "board", materialVariantId: null, label: "Placa" }, { materialId: "wrong-fastener", materialVariantId: null, label: "Parafuso" }],
      [
        {
          id: "requires-fastener",
          sourceMaterialId: "board",
          sourceMaterialVariantId: null,
          relatedMaterialId: "correct-fastener",
          relatedMaterialVariantId: null,
          relationshipType: "requires",
          status: "approved",
          notes: null,
        },
        {
          id: "excludes-wrong-fastener",
          sourceMaterialId: "board",
          sourceMaterialVariantId: null,
          relatedMaterialId: "wrong-fastener",
          relatedMaterialVariantId: null,
          relationshipType: "excludes",
          status: "approved",
          notes: null,
        },
        {
          id: "ignored-draft",
          sourceMaterialId: "board",
          sourceMaterialVariantId: null,
          relatedMaterialId: "ignored",
          relatedMaterialVariantId: null,
          relationshipType: "requires",
          status: "draft",
          notes: null,
        },
      ],
    );

    expect(result.errors).toHaveLength(2);
    expect(result.errors.join(" ")).toContain("requires-fastener");
    expect(result.errors.join(" ")).toContain("excludes-wrong-fastener");
  });

  it("creates a stable, hashable snapshot without mutating the input", async () => {
    const snapshot = buildSteelFrameCatalogSnapshot({
      estimateId: "estimate-1",
      estimateVersionId: "version-1",
      scenarioId: null,
      rules: [makeRule({ id: "z-rule", code: "Z-RULE" }), makeRule({ id: "a-rule", code: "A-RULE" })],
      selectedPrices: [selectSteelFrameCatalogPrice([makePrice()], "2026-08-01")],
      selectedMaterialIds: ["material-z", "material-a"],
      selectedMaterialVariantIds: ["variant-z", "variant-a"],
    });
    const serialized = stableCatalogSnapshotJson(snapshot);
    const hash = await sha256CatalogSnapshot(snapshot);

    expect(snapshot.rules.map((rule) => rule.code)).toEqual(["A-RULE", "Z-RULE"]);
    expect(snapshot.selectedMaterialIds).toEqual(["material-a", "material-z"]);
    expect(serialized).toContain('"schemaVersion":1');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
