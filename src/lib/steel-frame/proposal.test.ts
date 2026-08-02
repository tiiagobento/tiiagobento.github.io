import { describe, expect, it } from "vitest";
import {
  buildSteelFrameProposalCode,
  buildSteelFrameProposalFilename,
  buildSteelFrameProposalMaterialList,
  buildSteelFrameProposalPricing,
} from "./proposal";

const completeSnapshot = {
  calculatedItems: [{ total_cost: 1000 }],
  laborItems: [{ total_cost: 500 }],
  operationalCosts: [{ amount: 250 }],
  commercialComponents: [
    { component_key: "contingency", percentage: 5 },
    { component_key: "tax", percentage: 6 },
    { component_key: "sales_commission", percentage: 4 },
    { component_key: "platform_commission", percentage: 0 },
    { component_key: "target_margin", percentage: 20 },
    { component_key: "max_discount", percentage: 3 },
  ],
};

describe("steel frame proposal pricing", () => {
  it("creates a commercial proposal from persisted costs and explicit components", () => {
    const pricing = buildSteelFrameProposalPricing(completeSnapshot as never);

    expect(pricing.directCost).toBe(1750);
    expect(pricing.recommendedSalePrice).toBeGreaterThan(pricing.minimumSalePrice);
    expect(pricing.minimumPriceAfterDiscount).toBeGreaterThanOrEqual(pricing.minimumSalePrice);
  });

  it("refuses a zero-cost or incompletely configured proposal", () => {
    expect(() => buildSteelFrameProposalPricing({ ...completeSnapshot, calculatedItems: [], laborItems: [], operationalCosts: [] } as never)).toThrow(
      "Registre custos",
    );
    expect(() => buildSteelFrameProposalPricing({ ...completeSnapshot, commercialComponents: [] } as never)).toThrow(
      "Configure todos os componentes comerciais",
    );
  });

  it("builds traceable and filesystem-safe proposal identifiers", () => {
    const code = buildSteelFrameProposalCode(3, new Date("2026-07-31T09:07:29.000Z"));

    expect(code).toBe("NFSF-V3-20260731090729");
    expect(buildSteelFrameProposalFilename("Casa Sao Jose", code)).toBe("proposta-casa-sao-jose-nfsf-v3-20260731090729.pdf");
  });

  it("exposes technical quantities in a client proposal without exposing internal pricing", () => {
    const materials = buildSteelFrameProposalMaterialList([
      {
        label: "Montante Steel Frame 90 x 0,95 x 6.000 mm",
        category: "Estrutura",
        unit: "barra",
        calculated_quantity: 18,
        unit_cost: 123.45,
        total_cost: 2222.1,
      },
      {
        label: "",
        category: "Estrutura",
        unit: "un.",
        calculated_quantity: 2,
      },
      {
        label: "Parafuso ponta broca",
        category: "Fixadores",
        unit: "un.",
        calculated_quantity: 0,
      },
    ] as never);

    expect(materials).toEqual([
      {
        label: "Montante Steel Frame 90 x 0,95 x 6.000 mm",
        category: "Estrutura",
        unit: "barra",
        quantity: 18,
      },
    ]);
    expect(JSON.stringify(materials)).not.toContain("123.45");
    expect(JSON.stringify(materials)).not.toContain("2222.1");
  });
});
