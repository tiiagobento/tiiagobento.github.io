import { describe, expect, it } from "vitest";

import {
  steelFrameAIExtractionSchema,
  steelFrameCalculationRuleSchema,
  steelFrameCommercialComponentsSchema,
  steelFrameEstimateDraftSchema,
  steelFrameTechnicalCompositionDraftSchema,
  steelFrameTechnicalRuleDraftSchema,
} from "./schemas";

describe("steel frame schemas", () => {
  it("keeps missing technical information explicit in the estimate draft", () => {
    const result = steelFrameEstimateDraftSchema.parse({
      title: "Residencia em Biguacu",
      mode: "commercial",
      city: null,
      standardWallHeightMeters: null,
      requiresMaterialLift: null,
    });

    expect(result.city).toBeNull();
    expect(result.standardWallHeightMeters).toBeNull();
    expect(result.requiresMaterialLift).toBeNull();
  });

  it("requires the relevant catalog parameter for each deterministic rule", () => {
    const result = steelFrameCalculationRuleSchema.safeParse({
      ruleType: "FASTENER_BY_BOARD",
      parameters: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("unitsPerBoard");
    }
  });

  it("prevents impossible sale-based cost composition", () => {
    const result = steelFrameCommercialComponentsSchema.safeParse({
      directCost: 100,
      contingencyPercentOfCost: 0,
      taxPercentOfSale: 60,
      salesCommissionPercentOfSale: 20,
      platformCommissionPercentOfSale: 10,
      targetMarginPercentOfSale: 10,
      maxDiscountPercent: 0,
    });

    expect(result.success).toBe(false);
  });

  it("records the provenance and confidence of an AI extraction", () => {
    const result = steelFrameAIExtractionSchema.parse({
      field: "wall_height_meters",
      value: 2.8,
      confidence: 0.72,
      confirmationStatus: "needs_confirmation",
      evidence: {
        pageNumber: 1,
        sourceText: "pe direito de 2,80 m",
        boundingBox: { x: 10, y: 20, width: 120, height: 24 },
      },
    });

    expect(result.evidence.pageNumber).toBe(1);
    expect(result.confidence).toBeCloseTo(0.72);
  });

  it("allows incomplete technical limits only in a draft, so the validator can keep the estimate preliminary", () => {
    const rule = steelFrameTechnicalRuleDraftSchema.parse({
      code: "NF-TEST-001",
      version: "1.0",
      name: "Regra em levantamento",
      ruleType: "validation",
      origin: "company",
      referenceName: "Memorial interno",
      referenceVersion: "rascunho",
      limits: {},
    });
    const composition = steelFrameTechnicalCompositionDraftSchema.parse({
      code: "NF-COMP-001",
      version: "1.0",
      name: "Composicao em levantamento",
      applicationType: "structural",
      limits: {},
    });

    expect(rule.limits).toEqual({});
    expect(composition.ruleIds).toEqual([]);
  });
});
