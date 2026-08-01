import { describe, expect, it } from "vitest";

import { calculateSteelFrameEngineRule, getSteelFrameEngineTechnicalStatusSummary } from "./engine";

const source = {
  name: "Regra de teste",
  version: "1.0",
  documentReference: "TESTE-001",
  pageReference: "1",
  approvedBy: "Responsavel tecnico",
};

const commercialStock = {
  commercialBars: [
    { id: "bar-6", label: "Barra comercial 6 m", lengthMeters: 6, availableQuantity: null },
  ],
  kerfMeters: 0,
  reusableLeftovers: [],
  minimumReusableLeftoverMeters: 0.2,
};

function ruleMetadata({
  strategy,
  technicalUnit,
  purchaseUnit,
  acceptedInputUnits,
  approvalStatus = "approved",
  wastePercent = 0,
}: {
  strategy: string;
  technicalUnit: string;
  purchaseUnit: string;
  acceptedInputUnits: string[];
  approvalStatus?: string;
  wastePercent?: number;
}) {
  return {
    id: `${strategy}-rule`,
    code: `${strategy}-TEST`,
    name: strategy,
    version: "1.0.0",
    approvalStatus,
    source,
    strategy,
    technicalUnit,
    purchaseUnit,
    acceptedInputUnits,
    wastePercent,
    roundingMode: "ceil",
    roundingMultiple: 1,
    scope: { wallIds: [], openingIds: [] },
    limits: { maxWallHeightMeters: null, maxOpeningWidthMeters: null },
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    projectCount: 1,
    walls: [
      {
        id: "wall-a",
        label: "Parede A",
        lengthMeters: 6.73,
        heightMeters: 3,
        quantity: 1,
        segments: [],
        cavityWidthMeters: 0.09,
        source,
      },
    ],
    openings: [],
    junctions: [],
    composition: null,
    missingInformation: [],
    ...overrides,
  };
}

function calculate(rule: Record<string, unknown>, contextOverrides: Record<string, unknown> = {}) {
  return calculateSteelFrameEngineRule({ rule, context: context(contextOverrides) });
}

describe("steel frame engine typed strategies", () => {
  it("calculates parameterized studs without a hard-coded spacing", () => {
    const result = calculate({
      ...ruleMetadata({
        strategy: "STUD_BY_SPACING",
        technicalUnit: "piece",
        purchaseUnit: "bar",
        acceptedInputUnits: ["m"],
      }),
      parameters: {
        spacingMeters: 0.4,
        initialStudsPerWall: 1,
        endStudsPerWall: 1,
        manualExtraStuds: 0,
        commercialStock,
      },
    });

    expect(result.classification).toBe("automatic_eligible");
    expect(result.technicalPieces.reduce((sum, piece) => sum + piece.quantity, 0)).toBe(18);
    expect(result.quantities.raw.value).toBe(54);
    expect(result.cuttingPlan?.commercialBarsToPurchase).toBe(9);
    expect(result.explanation.text).toContain("Montantes regulares");
  });

  it("separates multiple walls, different heights, junctions, and manual adjustments", () => {
    const result = calculate({
      ...ruleMetadata({
        strategy: "STUD_BY_SPACING",
        technicalUnit: "piece",
        purchaseUnit: "bar",
        acceptedInputUnits: ["m"],
      }),
      parameters: {
        spacingMeters: 0.5,
        initialStudsPerWall: 1,
        endStudsPerWall: 1,
        manualExtraStuds: 2,
        commercialStock,
      },
    }, {
      walls: [
        { ...context().walls[0], id: "wall-low", label: "Parede baixa", lengthMeters: 4, heightMeters: 2.8, quantity: 2 },
        { ...context().walls[0], id: "wall-high", label: "Parede alta", lengthMeters: 3.1, heightMeters: 3.1, quantity: 1 },
      ],
      junctions: [
        { id: "junction-a", type: "external_corner", wallIds: ["wall-low", "wall-high"], extraStuds: 3, extraTrackMeters: 0, description: "Canto externo" },
      ],
    });

    expect(result.technicalPieces.reduce((sum, piece) => sum + piece.quantity, 0)).toBe(31);
    expect(result.technicalPieces.map((piece) => piece.lengthMeters)).toEqual(
      expect.arrayContaining([2.8, 3.1]),
    );
    expect(result.classification).toBe("technical_review_required");
  });

  it("includes approved door reinforcement and blocks a required missing template", () => {
    const baseRule = {
      ...ruleMetadata({
        strategy: "STUD_BY_SPACING",
        technicalUnit: "piece",
        purchaseUnit: "bar",
        acceptedInputUnits: ["m"],
      }),
      parameters: {
        spacingMeters: 0.4,
        initialStudsPerWall: 1,
        endStudsPerWall: 1,
        manualExtraStuds: 0,
        commercialStock,
      },
    };
    const reinforced = calculate(baseRule, {
      openings: [
        {
          id: "door-a",
          wallId: "wall-a",
          label: "Porta principal",
          openingType: "door",
          widthMeters: 0.9,
          heightMeters: 2.1,
          quantity: 1,
          requiresReinforcement: true,
          reinforcementTemplate: {
            id: "door-template",
            name: "Porta demonstrativa",
            approvalStatus: "approved",
            maxOpeningWidthMeters: 1.2,
            extraStudsPerOpening: 2,
            lintelMetersPerOpening: 1,
            sillMetersPerOpening: 0,
            openingTrackMetersPerOpening: 0,
            blockingTrackMetersPerOpening: 0,
            fastenersPerOpening: 0,
            cutLossPercent: 0,
            source,
          },
        },
      ],
    });
    const withoutTemplate = calculate(baseRule, {
      openings: [
        {
          id: "door-b",
          wallId: "wall-a",
          label: "Porta sem template",
          openingType: "door",
          widthMeters: 0.9,
          heightMeters: 2.1,
          quantity: 1,
          requiresReinforcement: true,
          reinforcementTemplate: null,
        },
      ],
    });

    expect(reinforced.technicalPieces.reduce((sum, piece) => sum + piece.quantity, 0)).toBe(20);
    expect(reinforced.classification).toBe("automatic_eligible");
    expect(withoutTemplate.classification).toBe("blocked");
    expect(withoutTemplate.alerts.map((alert) => alert.code)).toContain("OPENING_TEMPLATE_MISSING");
  });

  it("keeps lower and upper tracks separated before cutting", () => {
    const result = calculate({
      ...ruleMetadata({
        strategy: "TRACK_BY_WALL_LENGTH",
        technicalUnit: "m",
        purchaseUnit: "bar",
        acceptedInputUnits: ["m"],
      }),
      parameters: {
        lowerRunsPerWall: 1,
        upperRunsPerWall: 1,
        openingTrackMetersPerOpening: 0,
        blockingTrackMetersPerWall: 0,
        lintelTrackMetersPerOpening: 0,
        sillTrackMetersPerOpening: 0,
        manualTrackMeters: 0,
        commercialStock,
      },
    }, { walls: [{ ...context().walls[0], lengthMeters: 6, heightMeters: 3 }] });

    expect(result.quantities.raw).toEqual({ value: 12, unit: "m" });
    expect(result.technicalPieces.map((piece) => piece.label)).toEqual(
      expect.arrayContaining(["Guia inferior - Parede A", "Guia superior - Parede A"]),
    );
    expect(result.cuttingPlan?.commercialBarsToPurchase).toBe(2);
  });

  it("calculates blockers from the configured pattern instead of a fixed percentage", () => {
    const result = calculate({
      ...ruleMetadata({
        strategy: "BLOCKING_BY_STUD_PATTERN",
        technicalUnit: "piece",
        purchaseUnit: "bar",
        acceptedInputUnits: ["m"],
      }),
      parameters: {
        pattern: "alternate",
        spacingMeters: 0.4,
        pieceLengthMeters: 0.35,
        lines: 1,
        verticalIntervalMeters: null,
        fixedQuantityPerWall: 0,
        manualQuantityPerWall: 0,
        commercialStock,
      },
    }, { walls: [{ ...context().walls[0], lengthMeters: 6, heightMeters: 3 }] });

    expect(result.technicalPieces[0]?.quantity).toBe(8);
    expect(result.explanation.text).toContain("alternado");
  });

  it("respects configurable opening deductions for boards", () => {
    const shared = {
      ...ruleMetadata({
        strategy: "BOARD_BY_AREA_COEFFICIENT",
        technicalUnit: "board",
        purchaseUnit: "package",
        acceptedInputUnits: ["m2"],
      }),
      parameters: {
        coverageSquareMetersPerBoard: 2.5,
        boardsPerPackage: 5,
        faces: 1,
        layers: 1,
        openingTreatment: "do_not_deduct",
        openingMinimumAreaSquareMeters: 0,
      },
    };
    const openings = [
      {
        id: "window-a",
        wallId: "wall-a",
        label: "Janela",
        openingType: "window",
        widthMeters: 2,
        heightMeters: 1,
        quantity: 1,
        requiresReinforcement: false,
        reinforcementTemplate: null,
      },
    ];
    const noDeduction = calculate(shared, {
      walls: [{ ...context().walls[0], lengthMeters: 5, heightMeters: 3 }],
      openings,
    });
    const deductAll = calculate(
      { ...shared, parameters: { ...shared.parameters, openingTreatment: "deduct_all" } },
      { walls: [{ ...context().walls[0], lengthMeters: 5, heightMeters: 3 }], openings },
    );

    expect(noDeduction.quantities.raw.value).toBe(6);
    expect(deductAll.quantities.raw.value).toBe(5.2);
    expect(noDeduction.quantities.purchase.coveredTechnicalQuantity).toBeGreaterThanOrEqual(
      noDeduction.quantities.withWaste.value,
    );
  });

  it("never produces a negative area-based quantity when openings exceed the wall", () => {
    const result = calculate({
      ...ruleMetadata({
        strategy: "BOARD_BY_AREA_COEFFICIENT",
        technicalUnit: "board",
        purchaseUnit: "package",
        acceptedInputUnits: ["m2"],
      }),
      parameters: {
        coverageSquareMetersPerBoard: 2.5,
        boardsPerPackage: 5,
        faces: 1,
        layers: 1,
        openingTreatment: "deduct_all",
        openingMinimumAreaSquareMeters: 0,
      },
    }, {
      walls: [{ ...context().walls[0], lengthMeters: 2, heightMeters: 2 }],
      openings: [
        { id: "wide-window", wallId: "wall-a", label: "Vao maior", openingType: "window", widthMeters: 3, heightMeters: 2, quantity: 1, requiresReinforcement: false, reinforcementTemplate: null },
      ],
    });

    expect(result.quantities.raw.value).toBe(0);
    expect(result.quantities.purchase.quantity).toBe(0);
  });

  it("calculates membrane, insulation, and both fastener bases with package rounding", () => {
    const membrane = calculate({
      ...ruleMetadata({ strategy: "MEMBRANE_BY_AREA", technicalUnit: "m2", purchaseUnit: "roll", acceptedInputUnits: ["m2"], wastePercent: 5 }),
      parameters: { coverageSquareMetersPerRoll: 20, rollsPerPurchaseUnit: 1, faces: 1, layers: 1, overlapPercent: 10, openingTreatment: "do_not_deduct", openingMinimumAreaSquareMeters: 0 },
    });
    const insulation = calculate({
      ...ruleMetadata({ strategy: "INSULATION_BY_AREA", technicalUnit: "m2", purchaseUnit: "package", acceptedInputUnits: ["m2"] }),
      parameters: { coverageSquareMetersPerPackage: 8, faces: 1, layers: 1, openingTreatment: "do_not_deduct", openingMinimumAreaSquareMeters: 0, compatibleCavityWidthsMeters: [0.09] },
    });
    const areaFastener = calculate({
      ...ruleMetadata({ strategy: "FASTENER_BY_AREA", technicalUnit: "unit", purchaseUnit: "box", acceptedInputUnits: ["m2"] }),
      parameters: { unitsPerSquareMeter: 12, unitsPerBox: 100, openingTreatment: "do_not_deduct", openingMinimumAreaSquareMeters: 0 },
    });
    const boardFastener = calculate({
      ...ruleMetadata({ strategy: "FASTENER_BY_BOARD", technicalUnit: "unit", purchaseUnit: "box", acceptedInputUnits: ["board"] }),
      parameters: { boardQuantity: 12, unitsPerBoard: 20, unitsPerBox: 100 },
    });

    expect(membrane.quantities.raw.value).toBeCloseTo(22.209, 3);
    expect(insulation.quantities.purchase.quantity).toBe(3);
    expect(areaFastener.quantities.purchase.quantity).toBe(3);
    expect(boardFastener.quantities.raw.value).toBe(240);
  });

  it("supports fixed, manual, packaging, and direct cutting strategies", () => {
    const fixedOpening = calculate({
      ...ruleMetadata({ strategy: "FIXED_PER_OPENING", technicalUnit: "unit", purchaseUnit: "box", acceptedInputUnits: ["unit"] }),
      parameters: { unitsPerOpening: 4, unitsPerPurchaseUnit: 10 },
    }, {
      openings: [
        { id: "global-opening", wallId: null, label: "Abertura", openingType: "opening", widthMeters: 1, heightMeters: 1, quantity: 2, requiresReinforcement: false, reinforcementTemplate: null },
      ],
    });
    const fixedProject = calculate({
      ...ruleMetadata({ strategy: "FIXED_PER_PROJECT", technicalUnit: "unit", purchaseUnit: "box", acceptedInputUnits: ["unit"] }),
      parameters: { unitsPerProject: 3, unitsPerPurchaseUnit: 5 },
    }, { projectCount: 2 });
    const manual = calculate({
      ...ruleMetadata({ strategy: "MANUAL", technicalUnit: "unit", purchaseUnit: "box", acceptedInputUnits: ["unit"] }),
      parameters: { technicalQuantity: 13, unitsPerPurchaseUnit: 10, justification: "Ajuste conferido em visita." },
    });
    const packaging = calculate({
      ...ruleMetadata({ strategy: "PACKAGING_ROUNDING", technicalUnit: "unit", purchaseUnit: "bag", acceptedInputUnits: ["unit"] }),
      parameters: { technicalQuantity: 21, unitsPerPurchaseUnit: 10 },
    });
    const cutting = calculate({
      ...ruleMetadata({ strategy: "CUTTING_STOCK_OPTIMIZATION", technicalUnit: "m", purchaseUnit: "bar", acceptedInputUnits: ["m"] }),
      parameters: { pieces: [{ id: "cut-a", label: "Peca", quantity: 2, lengthMeters: 3, source: "Teste" }], ...commercialStock },
    });

    expect(fixedOpening.quantities.raw.value).toBe(8);
    expect(fixedProject.quantities.raw.value).toBe(6);
    expect(manual.classification).toBe("technical_review_required");
    expect(packaging.quantities.purchase.quantity).toBe(3);
    expect(cutting.cuttingPlan?.commercialBarsToPurchase).toBe(1);
  });

  it("marks missing, invalid, unapproved, and manually overridden inputs safely", () => {
    const invalid = calculateSteelFrameEngineRule({ context: context() });
    const incompatibleUnit = calculate({
      ...ruleMetadata({
        strategy: "BOARD_BY_AREA_COEFFICIENT",
        technicalUnit: "board",
        purchaseUnit: "package",
        acceptedInputUnits: ["unit"],
      }),
      parameters: { coverageSquareMetersPerBoard: 2.5, boardsPerPackage: 5, faces: 1, layers: 1, openingTreatment: "do_not_deduct", openingMinimumAreaSquareMeters: 0 },
    });
    const unapproved = calculate({
      ...ruleMetadata({
        strategy: "FASTENER_BY_BOARD",
        technicalUnit: "unit",
        purchaseUnit: "box",
        acceptedInputUnits: ["board"],
        approvalStatus: "draft",
      }),
      parameters: { boardQuantity: 1, unitsPerBoard: 1, unitsPerBox: 1 },
    });
    const heightOutsideLimit = calculate({
      ...ruleMetadata({ strategy: "FASTENER_BY_BOARD", technicalUnit: "unit", purchaseUnit: "box", acceptedInputUnits: ["board"] }),
      limits: { maxWallHeightMeters: 2.7, maxOpeningWidthMeters: null },
      parameters: { boardQuantity: 1, unitsPerBoard: 1, unitsPerBox: 1 },
    });

    expect(invalid.classification).toBe("blocked");
    expect(incompatibleUnit.classification).toBe("blocked");
    expect(unapproved.classification).toBe("technical_review_required");
    expect(heightOutsideLimit.alerts.map((alert) => alert.code)).toContain("WALL_HEIGHT_OUTSIDE_LIMIT");
  });

  it("is monotonic and summarizes the most restrictive technical status", () => {
    const makeBoardResult = (lengthMeters: number) =>
      calculate({
        ...ruleMetadata({ strategy: "BOARD_BY_AREA_COEFFICIENT", technicalUnit: "board", purchaseUnit: "package", acceptedInputUnits: ["m2"] }),
        parameters: { coverageSquareMetersPerBoard: 2.5, boardsPerPackage: 5, faces: 1, layers: 1, openingTreatment: "do_not_deduct", openingMinimumAreaSquareMeters: 0 },
      }, { walls: [{ ...context().walls[0], lengthMeters }] });

    const smaller = makeBoardResult(4);
    const larger = makeBoardResult(8);
    const blocked = calculateSteelFrameEngineRule({});

    expect(larger.quantities.raw.value).toBeGreaterThanOrEqual(smaller.quantities.raw.value);
    expect(larger.quantities.purchase.coveredTechnicalQuantity).toBeGreaterThanOrEqual(
      larger.quantities.withWaste.value,
    );
    expect(getSteelFrameEngineTechnicalStatusSummary([smaller, blocked])).toBe("blocked");
  });
});
