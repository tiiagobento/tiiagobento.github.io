import { describe, expect, it } from "vitest";
import {
  steelFrameMaterialArchiveSchema,
  steelFrameMaterialPriceSchema,
  steelFrameMaterialUpdateSchema,
} from "./schemas";

const materialId = "11111111-1111-4111-8111-111111111111";

describe("Steel Frame material catalog lifecycle schemas", () => {
  it("normalizes material metadata without accepting incomplete records", () => {
    expect(steelFrameMaterialUpdateSchema.parse({
      materialId,
      name: "  Perfil montante  ",
      category: " Perfis ",
      unit: " barra ",
      sku: "  M90  ",
    })).toMatchObject({ name: "Perfil montante", category: "Perfis", unit: "barra", sku: "M90" });

    expect(() => steelFrameMaterialUpdateSchema.parse({ materialId, name: "", category: "", unit: "" })).toThrow();
  });

  it("requires an identifiable source for every new price", () => {
    expect(() => steelFrameMaterialPriceSchema.parse({
      materialId,
      unitCost: 42.5,
      effectiveFrom: "2026-08-03",
      sourceReference: "",
    })).toThrow("Informe a fonte do preco.");

    expect(steelFrameMaterialPriceSchema.parse({
      materialId,
      unitCost: 42.5,
      effectiveFrom: "2026-08-03",
      sourceReference: "Cotacao 21279",
    }).unitCost).toBe(42.5);
  });

  it("requires a reason before archiving", () => {
    expect(() => steelFrameMaterialArchiveSchema.parse({ materialId, reason: "x" })).toThrow();
    expect(steelFrameMaterialArchiveSchema.parse({ materialId, reason: "Produto descontinuado" }).reason).toBe("Produto descontinuado");
  });
});
