import { describe, expect, it } from "vitest";

import type { SteelFrameCatalogRuleDraft } from "./catalog/types";
import {
  buildSteelFrameEngineCalculatedItem,
  buildSteelFrameEstimateEngineContext,
  evaluateSteelFrameCatalogRule,
  findSteelFrameRuleMaterialMatches,
  hasPersistedSteelFrameEngineRule,
} from "./estimate-engine";
import type {
  SteelFrameMaterialRecord,
  SteelFrameOpeningRecord,
  SteelFrameWallSegmentRecord,
} from "./types";

const rule: SteelFrameCatalogRuleDraft = {
  id: "rule-studs",
  code: "STUD-090",
  version: "1.0",
  name: "Montantes 90 mm",
  strategyType: "STUD_BY_SPACING",
  parameterSchemaVersion: 1,
  technicalInputUnit: "m",
  purchaseUnit: "bar",
  parameters: {
    spacingMeters: 0.4,
    initialStudsPerWall: 1,
    endStudsPerWall: 1,
    manualExtraStuds: 0,
    commercialStock: {
      commercialBars: [{ id: "bar-6", label: "Barra 6 m", lengthMeters: 6, availableQuantity: null }],
      kerfMeters: 0.01,
      reusableLeftovers: [],
      minimumReusableLeftoverMeters: 0.2,
    },
  },
  limits: { maxWallHeightMeters: 4, maxOpeningWidthMeters: 3 },
  scope: { wallIds: [], openingIds: [] },
  wastePercent: 0,
  roundingMode: "ceil",
  roundingMultiple: 1,
  source: {
    sourceId: "source-1",
    sourceDocumentId: "document-1",
    sourceTitle: "Composicao aprovada",
    sourceVersion: "1.0",
    documentReference: "manual.pdf",
    pageReference: "12",
  },
  status: "approved",
  technicalResponsibleName: "Responsavel tecnico",
  technicalResponsibleRegistration: "CREA-TESTE",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  approvedBy: "profile-1",
};

const wall: SteelFrameWallSegmentRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  estimate_id: "22222222-2222-4222-8222-222222222222",
  estimate_version_id: null,
  label: "Parede A",
  section_name: null,
  length_meters: 6,
  height_meters: 3,
  quantity: 1,
  gross_area_square_meters: 18,
  confirmation_status: "confirmed",
  source_data: { cavity_width_meters: 0.09 },
  sort_order: 0,
  created_at: "2026-08-02T12:00:00.000Z",
  updated_at: "2026-08-02T12:00:00.000Z",
};

const material: SteelFrameMaterialRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  created_by: "44444444-4444-4444-8444-444444444444",
  supplier_id: null,
  sku: "M90",
  name: "Montante 90 x 6 m",
  category: "Estrutura",
  unit: "barra",
  technical_specification: { technical_rule_code: "STUD-090" },
  active: true,
  created_at: "2026-08-02T12:00:00.000Z",
  updated_at: "2026-08-02T12:00:00.000Z",
  prices: [{
    id: "55555555-5555-4555-8555-555555555555",
    unit_cost: 49.9,
    currency: "BRL",
    effective_from: "2026-01-01",
    effective_to: null,
  }],
};

describe("Steel Frame estimate engine adapter", () => {
  it("maps confirmed geometry into a deterministic engine context", () => {
    const opening = {
      id: "66666666-6666-4666-8666-666666666666",
      wall_segment_id: null,
      label: "Janela A",
      opening_type: "window",
      width_meters: 1.2,
      height_meters: 1.2,
      quantity: 1,
      confirmation_status: "confirmed",
    } as SteelFrameOpeningRecord;

    const context = buildSteelFrameEstimateEngineContext([wall], [opening]);

    expect(context.walls[0]).toMatchObject({ lengthMeters: 6, heightMeters: 3, cavityWidthMeters: 0.09 });
    expect(context.openings[0]).toMatchObject({ wallId: null, requiresReinforcement: true });
    expect(context.missingInformation).toContain("Vincule as aberturas as paredes correspondentes para melhorar o calculo.");
  });

  it("evaluates an approved typed rule and preserves its explanation and cutting plan", () => {
    const evaluation = evaluateSteelFrameCatalogRule(rule, [wall], []);

    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) return;
    expect(evaluation.result.classification).toBe("automatic_eligible");
    expect(evaluation.result.quantities.purchase.unit).toBe("bar");
    expect(evaluation.result.cuttingPlan?.commercialBarsToPurchase).toBeGreaterThan(0);
    expect(evaluation.result.rule?.name).toBe("Montantes 90 mm");
    expect(evaluation.result.explanation.text).toContain("Espacamento maximo: 0,4 m");
  });

  it("matches a material explicitly linked to the rule and builds an auditable persisted item", () => {
    const evaluation = evaluateSteelFrameCatalogRule(rule, [wall], []);
    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) return;

    expect(findSteelFrameRuleMaterialMatches(rule, [material])).toEqual([material]);
    const item = buildSteelFrameEngineCalculatedItem({ rule, result: evaluation.result, material, walls: [wall], openings: [] });

    expect(item.confirmationStatus).toBe("confirmed");
    expect(item.requiresTechnicalReview).toBe(false);
    expect(item.calculatedQuantity).toBe(evaluation.result.quantities.purchase.quantity);
    expect(item.sourceData?.calculation_mode).toBe("typed_engine_v1");
    expect(hasPersistedSteelFrameEngineRule(item.sourceData ?? {}, rule)).toBe(true);
  });

  it("blocks persistence when the technical engine has no geometry", () => {
    const evaluation = evaluateSteelFrameCatalogRule(rule, [], []);
    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) return;
    expect(evaluation.result.classification).toBe("blocked");
    expect(() => buildSteelFrameEngineCalculatedItem({ rule, result: evaluation.result, material, walls: [], openings: [] })).toThrow(
      "A regra esta bloqueada por dados tecnicos pendentes.",
    );
  });
});
