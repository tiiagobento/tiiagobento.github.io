import { describe, expect, it } from "vitest";

import {
  applySteelFrameEngineRounding,
  convertSteelFrameEngineLength,
  convertSteelFrameEngineMeasurement,
  getSteelFrameEngineUnitDimension,
} from "./units";

describe("steel frame engine units", () => {
  it("converts configured length units explicitly", () => {
    expect(convertSteelFrameEngineLength(3000, "mm", "m")).toBe(3);
    expect(convertSteelFrameEngineLength(2.5, "m", "cm")).toBe(250);
    expect(getSteelFrameEngineUnitDimension("m2")).toBe("area");
  });

  it("does not perform implicit conversions between incompatible dimensions", () => {
    expect(() => convertSteelFrameEngineMeasurement(1, "m", "m2")).toThrow(
      "unidades incompativeis",
    );
    expect(() => convertSteelFrameEngineMeasurement(1, "board", "package")).toThrow(
      "Nao existe conversao explicita",
    );
  });

  it("centralizes deterministic rounding", () => {
    expect(applySteelFrameEngineRounding(7.1, "ceil").appliedValue).toBe(8);
    expect(applySteelFrameEngineRounding(7.9, "floor").appliedValue).toBe(7);
    expect(applySteelFrameEngineRounding(7.4, "nearest", 0.5).appliedValue).toBe(7.5);
  });
});
