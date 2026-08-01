import { describe, expect, it } from "vitest";

import { calculateSteelFrameCuttingPlan } from "./cutting-stock";

const commercialBars = [
  { id: "bar-6", label: "Barra 6 m", lengthMeters: 6, availableQuantity: null },
];

describe("steel frame engine cutting stock", () => {
  it("optimizes a deterministic one-dimensional cut plan with kerf", () => {
    const input = {
      pieces: [
        { id: "piece-a", label: "Peca A", quantity: 2, lengthMeters: 3, source: "Parede" },
        { id: "piece-b", label: "Peca B", quantity: 1, lengthMeters: 2.8, source: "Parede" },
      ],
      commercialBars,
      kerfMeters: 0.01,
      reusableLeftovers: [],
      minimumReusableLeftoverMeters: 0.1,
    };

    const first = calculateSteelFrameCuttingPlan(input);
    const second = calculateSteelFrameCuttingPlan(input);

    expect(first).toEqual(second);
    expect(first.commercialBarsToPurchase).toBe(2);
    expect(first.totalRequiredPieceLengthMeters).toBe(8.8);
    expect(first.totalKerfLossMeters).toBe(0.01);
    expect(first.bars.every((bar) => bar.usedLengthMeters <= bar.lengthMeters)).toBe(true);
  });

  it("uses registered leftovers before purchasing a new bar", () => {
    const plan = calculateSteelFrameCuttingPlan({
      pieces: [
        { id: "blocking", label: "Bloqueador", quantity: 1, lengthMeters: 1.2, source: "Parede" },
      ],
      commercialBars,
      kerfMeters: 0,
      reusableLeftovers: [
        { id: "left-1", label: "Sobra 1,5 m", lengthMeters: 1.5, source: "Estoque" },
      ],
      minimumReusableLeftoverMeters: 0.2,
    });

    expect(plan.commercialBarsToPurchase).toBe(0);
    expect(plan.bars[0]?.sourceType).toBe("leftover");
    expect(plan.totalLeftoverMeters).toBe(0.3);
  });

  it("does not create a plan when no configured stock can fit a piece", () => {
    expect(() =>
      calculateSteelFrameCuttingPlan({
        pieces: [
          { id: "long", label: "Peca longa", quantity: 1, lengthMeters: 6.1, source: "Parede" },
        ],
        commercialBars,
        kerfMeters: 0,
        reusableLeftovers: [],
        minimumReusableLeftoverMeters: 0,
      }),
    ).toThrow("Nenhuma barra comercial");
  });

  it("keeps every calculated cut within its assigned stock bar", () => {
    const plan = calculateSteelFrameCuttingPlan({
      pieces: [
        { id: "fractional", label: "Peca fracionada", quantity: 5, lengthMeters: 1.19, source: "Teste" },
      ],
      commercialBars,
      kerfMeters: 0.01,
      reusableLeftovers: [],
      minimumReusableLeftoverMeters: 0.2,
    });

    expect(plan.bars.every((bar) => bar.usedLengthMeters <= bar.lengthMeters)).toBe(true);
    expect(plan.totalLeftoverMeters).toBeGreaterThanOrEqual(0);
  });
});
