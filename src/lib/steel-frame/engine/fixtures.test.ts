import { describe, expect, it } from "vitest";

import {
  anaPaulaHistoricalFixture,
  compareAnaPaulaHistoricalQuantities,
  compareRafaPracticalMethod,
  createRafaPracticalStudRequest,
  rafaCalibrationFixture,
} from "./fixtures";
import { calculateSteelFrameEngineRule } from "./engine";

const source = {
  name: "Levantamento de teste",
  version: "1.0",
  documentReference: null,
  pageReference: null,
  approvedBy: null,
};

describe("steel frame engine calibration fixtures", () => {
  it("keeps Rafa's incomplete historical method explicitly pending", () => {
    const comparison = compareRafaPracticalMethod();

    expect(comparison.status).toBe("pending_information");
    if (comparison.status !== "pending_information") {
      throw new Error("O fixture Rafa deveria permanecer pendente sem geometria.");
    }
    expect(comparison.pendingInformation).toContain(
      "Comprimento de cada parede do levantamento original.",
    );
    expect(rafaCalibrationFixture.knownParameters.commercialBarLengthMeters).toBe(6);
  });

  it("runs the practical Rafa parameters only when geometry is supplied", () => {
    const walls = [
      {
        id: "rafa-wall",
        label: "Parede de calibracao",
        lengthMeters: 4,
        heightMeters: 3,
        quantity: 1,
        segments: [],
        cavityWidthMeters: null,
        source,
      },
    ];
    const request = createRafaPracticalStudRequest({ walls });
    const result = calculateSteelFrameEngineRule(request);
    const comparison = compareRafaPracticalMethod({ walls, openings: [] });

    expect(result.classification).toBe("technical_review_required");
    expect(result.technicalPieces.reduce((sum, piece) => sum + piece.quantity, 0)).toBe(11);
    expect(comparison.status).toBe("calculated");
  });

  it("compares Ana Paula historical quantities without forcing calculated values", () => {
    const comparison = compareAnaPaulaHistoricalQuantities({
      studs: 34,
      tracks: 12,
      roofScrews: 80,
    });
    const pending = comparison.find((item) => item.key === "glasrocBoards");
    const matching = comparison.find((item) => item.key === "studs");
    const different = comparison.find((item) => item.key === "tracks");

    expect(anaPaulaHistoricalFixture.documentedQuantities.rockwoolPackages).toBe(7);
    expect(matching).toMatchObject({ expected: 34, calculated: 34, difference: 0 });
    expect(different).toMatchObject({ expected: 10, calculated: 12, difference: 2 });
    expect(pending).toMatchObject({ calculated: null, difference: null });
  });
});
