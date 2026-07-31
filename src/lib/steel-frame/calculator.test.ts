import { describe, expect, it } from "vitest";

import {
  calculateCommercialPricing,
  calculateMaterialQuantity,
  calculateWallAreas,
} from "./calculator";

describe("steel frame calculation engine", () => {
  it("calculates wall area and deducts confirmed openings without allowing negative area", () => {
    const result = calculateWallAreas(
      [
        {
          id: "a",
          label: "Parede frontal",
          lengthMeters: 8,
          heightMeters: 2.8,
          quantity: 1,
          confirmationStatus: "confirmed",
        },
      ],
      [
        {
          label: "Porta principal",
          widthMeters: 0.9,
          heightMeters: 2.1,
          quantity: 1,
          subtractFromWallArea: true,
          confirmationStatus: "confirmed",
          wallSegmentId: "a",
        },
      ],
    );

    expect(result).toMatchObject({
      grossWallArea: 22.4,
      openingArea: 1.89,
      netWallArea: 20.51,
      warnings: [],
    });
  });

  it("flags inconsistent areas instead of producing a negative quantity basis", () => {
    const result = calculateWallAreas(
      [
        {
          label: "Parede curta",
          lengthMeters: 2,
          heightMeters: 2,
          quantity: 1,
          confirmationStatus: "confirmed",
        },
      ],
      [
        {
          label: "Abertura maior",
          widthMeters: 3,
          heightMeters: 2,
          quantity: 1,
          subtractFromWallArea: true,
          confirmationStatus: "confirmed",
        },
      ],
    );

    expect(result.netWallArea).toBe(0);
    expect(result.warnings).toContain(
      "A area das aberturas e maior que a area informada das paredes. Revise as medidas.",
    );
  });

  it("applies catalog parameters, waste, and package rounding deterministically", () => {
    const result = calculateMaterialQuantity({
      rule: {
        ruleType: "BOARD_BY_AREA",
        parameters: { coveragePerUnit: 2.88 },
        wastePercent: 10,
        roundingMode: "ceil",
      },
      context: {
        wallLengthMeters: 20,
        wallAreaSquareMeters: 20.51,
        openingCount: 1,
        openingLinearMeters: 6,
        boardCount: 8,
        studCount: 76,
      },
    });

    expect(result.rawQuantity).toBeCloseTo(7.1215, 4);
    expect(result.quantityWithWaste).toBeCloseTo(7.8337, 4);
    expect(result.finalQuantity).toBe(8);
  });

  it("requires configuration instead of guessing a technical quantity", () => {
    expect(() =>
      calculateMaterialQuantity({
        rule: {
          ruleType: "STUD_BY_SPACING",
          parameters: {},
        },
        context: {
          wallLengthMeters: 20,
          wallAreaSquareMeters: 20,
          openingCount: 0,
          openingLinearMeters: 0,
          boardCount: 0,
          studCount: 0,
        },
      }),
    ).toThrow("Configure spacingMeters");
  });

  it("calculates a commercial price without hard-coded construction costs", () => {
    const result = calculateCommercialPricing({
      directCost: 10_000,
      contingencyPercentOfCost: 5,
      taxPercentOfSale: 6,
      salesCommissionPercentOfSale: 0,
      platformCommissionPercentOfSale: 0,
      targetMarginPercentOfSale: 20,
      maxDiscountPercent: 12,
    });

    expect(result.contingencyAmount).toBe(500);
    expect(result.minimumSalePrice).toBe(11170.21);
    expect(result.recommendedSalePrice).toBe(14189.19);
    expect(result.maximumAllowedDiscountAmount).toBe(1702.7);
    expect(result.minimumPriceAfterDiscount).toBe(12486.49);
  });
});
