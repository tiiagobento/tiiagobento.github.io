import { describe, expect, it } from "vitest";
import {
  buildSteelFrameCalculationContext,
  getCalculationContextIssue,
  getCommercialComponentValues,
  getCurrentMaterialPrice,
  sumSteelFrameDirectCosts,
} from "./costing";
import type {
  SteelFrameCalculatedItemRecord,
  SteelFrameCommercialComponentRecord,
  SteelFrameLaborItemRecord,
  SteelFrameMaterialRecord,
  SteelFrameOpeningRecord,
  SteelFrameOperationalCostRecord,
  SteelFrameWallSegmentRecord,
} from "./types";

const material = {
  id: "material-1",
  created_by: "user-1",
  supplier_id: null,
  sku: null,
  name: "Placa",
  category: "Fechamento",
  unit: "un",
  technical_specification: {},
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  prices: [
    { id: "old", unit_cost: 80, currency: "BRL", effective_from: "2025-01-01", effective_to: "2026-02-01" },
    { id: "current", unit_cost: 95, currency: "BRL", effective_from: "2026-02-01", effective_to: null },
  ],
} satisfies SteelFrameMaterialRecord;

function wall(overrides: Partial<SteelFrameWallSegmentRecord> = {}): SteelFrameWallSegmentRecord {
  return {
    id: "wall-1",
    estimate_id: "estimate-1",
    estimate_version_id: null,
    label: "Fachada",
    section_name: null,
    length_meters: 5,
    height_meters: 3,
    quantity: 2,
    gross_area_square_meters: 30,
    confirmation_status: "confirmed",
    source_data: {},
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function opening(overrides: Partial<SteelFrameOpeningRecord> = {}): SteelFrameOpeningRecord {
  return {
    id: "opening-1",
    estimate_id: "estimate-1",
    estimate_version_id: null,
    wall_segment_id: "wall-1",
    label: "Janela",
    opening_type: "window",
    width_meters: 1,
    height_meters: 1.5,
    quantity: 2,
    opening_area_square_meters: 3,
    subtract_from_wall_area: true,
    confirmation_status: "confirmed",
    source_data: {},
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("steel frame costing helpers", () => {
  it("uses only a current catalog price", () => {
    expect(getCurrentMaterialPrice(material, new Date("2026-07-31T12:00:00Z"))).toMatchObject({
      unitCost: 95,
      currency: "BRL",
      effectiveFrom: "2026-02-01",
    });
    expect(getCurrentMaterialPrice(material, new Date("2024-01-01T12:00:00Z"))).toBeNull();
  });

  it("builds calculation context from confirmed geometry", () => {
    expect(buildSteelFrameCalculationContext([wall()], [opening()])).toEqual({
      wallLengthMeters: 10,
      wallAreaSquareMeters: 27,
      openingCount: 2,
      openingLinearMeters: 10,
      boardCount: 0,
      studCount: 0,
      projectCount: 1,
    });
  });

  it("does not allow geometry-dependent rules without their required context", () => {
    expect(getCalculationContextIssue("BOARD_BY_AREA", {
      wallLengthMeters: 0,
      wallAreaSquareMeters: 0,
      openingCount: 0,
      openingLinearMeters: 0,
      boardCount: 0,
      studCount: 0,
    })).toContain("paredes");
    expect(getCalculationContextIssue("MANUAL", {
      wallLengthMeters: 0,
      wallAreaSquareMeters: 0,
      openingCount: 0,
      openingLinearMeters: 0,
      boardCount: 0,
      studCount: 0,
    })).toBeNull();
  });

  it("sums all direct costs without adding a hidden rate", () => {
    const calculatedItems = [{ total_cost: 150 }] as SteelFrameCalculatedItemRecord[];
    const laborItems = [{ total_cost: 300 }] as SteelFrameLaborItemRecord[];
    const operationalCosts = [{ amount: 50 }] as SteelFrameOperationalCostRecord[];

    expect(sumSteelFrameDirectCosts({ calculatedItems, laborItems, operationalCosts })).toEqual({
      materialCost: 150,
      laborCost: 300,
      operationalCost: 50,
      directCost: 500,
    });
  });

  it("maps stored commercial percentages by their explicit key", () => {
    const components = [
      { component_key: "tax", percentage: 8 },
      { component_key: "target_margin", percentage: 20 },
    ] as SteelFrameCommercialComponentRecord[];

    expect(getCommercialComponentValues(components)).toEqual({
      contingencyPercentOfCost: null,
      taxPercentOfSale: 8,
      salesCommissionPercentOfSale: null,
      platformCommissionPercentOfSale: null,
      targetMarginPercentOfSale: 20,
      maxDiscountPercent: null,
    });
  });
});
