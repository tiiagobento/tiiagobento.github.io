import { describe, expect, it } from "vitest";

import {
  steelFrameEngineCalculationRequestSchema,
  steelFrameEngineRuleSchema,
  steelFrameEngineWallSchema,
} from "./schemas";

const source = {
  name: "Fonte de teste",
  version: "1.0",
  documentReference: null,
  pageReference: null,
  approvedBy: null,
};

describe("steel frame engine schemas", () => {
  it("rejects walls with invalid geometry", () => {
    const parsed = steelFrameEngineWallSchema.safeParse({
      id: "wall",
      label: "Parede",
      lengthMeters: -1,
      heightMeters: 3,
      quantity: 1,
    });

    expect(parsed.success).toBe(false);
  });

  it("requires complete typed parameters for a stud rule", () => {
    const parsed = steelFrameEngineRuleSchema.safeParse({
      id: "stud",
      code: "STUD",
      name: "Montantes",
      version: "1",
      approvalStatus: "approved",
      source,
      strategy: "STUD_BY_SPACING",
      technicalUnit: "piece",
      purchaseUnit: "bar",
      acceptedInputUnits: ["m"],
      parameters: { spacingMeters: 0.4 },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects fractional physical counts and incomplete vertical blocking parameters", () => {
    const fractionalStuds = steelFrameEngineRuleSchema.safeParse({
      id: "stud-fractional",
      code: "STUD_FRACTIONAL",
      name: "Montantes",
      version: "1",
      approvalStatus: "approved",
      source,
      strategy: "STUD_BY_SPACING",
      technicalUnit: "piece",
      purchaseUnit: "bar",
      acceptedInputUnits: ["m"],
      parameters: {
        spacingMeters: 0.4,
        initialStudsPerWall: 1.5,
        endStudsPerWall: 1,
        manualExtraStuds: 0,
        commercialStock: { commercialBars: [{ id: "bar", label: "Barra", lengthMeters: 6, availableQuantity: null }] },
      },
    });
    const verticalBlocking = steelFrameEngineRuleSchema.safeParse({
      id: "blocking",
      code: "BLOCKING_VERTICAL",
      name: "Bloqueadores",
      version: "1",
      approvalStatus: "approved",
      source,
      strategy: "BLOCKING_BY_STUD_PATTERN",
      technicalUnit: "piece",
      purchaseUnit: "bar",
      acceptedInputUnits: ["m"],
      parameters: {
        pattern: "vertical_interval",
        spacingMeters: 0.4,
        pieceLengthMeters: 0.35,
        lines: 0,
        verticalIntervalMeters: null,
        fixedQuantityPerWall: 0,
        manualQuantityPerWall: 0,
        commercialStock: { commercialBars: [{ id: "bar", label: "Barra", lengthMeters: 6, availableQuantity: null }] },
      },
    });

    expect(fractionalStuds.success).toBe(false);
    expect(verticalBlocking.success).toBe(false);
  });

  it("parses a typed request with explicit defaults instead of formulas", () => {
    const parsed = steelFrameEngineCalculationRequestSchema.safeParse({
      rule: {
        id: "manual",
        code: "MANUAL",
        name: "Quantidade manual",
        version: "1",
        approvalStatus: "pending_validation",
        source,
        strategy: "MANUAL",
        technicalUnit: "unit",
        purchaseUnit: "box",
        acceptedInputUnits: ["unit"],
        parameters: {
          technicalQuantity: 12,
          unitsPerPurchaseUnit: 10,
          justification: "Conferencia de campo.",
        },
      },
      context: {},
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.context.projectCount).toBe(1);
      expect(parsed.data.rule.wastePercent).toBe(0);
    }
  });
});
