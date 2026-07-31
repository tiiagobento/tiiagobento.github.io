import { calculateCommercialPricing } from "./calculator";
import {
  getCommercialComponentValues,
  sumSteelFrameDirectCosts,
} from "./costing";
import type { SteelFrameCostingSnapshot } from "./types";

export type SteelFrameProposalPricing = {
  directCost: number;
  materialCost: number;
  laborCost: number;
  operationalCost: number;
  contingencyAmount: number;
  minimumSalePrice: number;
  recommendedSalePrice: number;
  maximumAllowedDiscountAmount: number;
  minimumPriceAfterDiscount: number;
  warnings: string[];
};

const requiredCommercialComponentKeys = [
  "contingencyPercentOfCost",
  "taxPercentOfSale",
  "salesCommissionPercentOfSale",
  "platformCommissionPercentOfSale",
  "targetMarginPercentOfSale",
  "maxDiscountPercent",
] as const;

export function buildSteelFrameProposalPricing(snapshot: SteelFrameCostingSnapshot): SteelFrameProposalPricing {
  const costs = sumSteelFrameDirectCosts(snapshot);
  if (costs.directCost <= 0) {
    throw new Error("Registre custos de materiais, mao de obra ou operacao antes de gerar a proposta.");
  }

  const componentValues = getCommercialComponentValues(snapshot.commercialComponents);
  const missingComponents = requiredCommercialComponentKeys.filter((key) => componentValues[key] === null);
  if (missingComponents.length) {
    throw new Error("Configure todos os componentes comerciais antes de gerar a proposta.");
  }

  const pricing = calculateCommercialPricing({
    directCost: costs.directCost,
    contingencyPercentOfCost: componentValues.contingencyPercentOfCost ?? 0,
    taxPercentOfSale: componentValues.taxPercentOfSale ?? 0,
    salesCommissionPercentOfSale: componentValues.salesCommissionPercentOfSale ?? 0,
    platformCommissionPercentOfSale: componentValues.platformCommissionPercentOfSale ?? 0,
    targetMarginPercentOfSale: componentValues.targetMarginPercentOfSale ?? 0,
    maxDiscountPercent: componentValues.maxDiscountPercent ?? 0,
  });

  return {
    ...costs,
    ...pricing,
  };
}

export function buildSteelFrameProposalCode(versionNumber: number, date = new Date()) {
  const timestamp = date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `NFSF-V${versionNumber}-${timestamp}`;
}

export function buildSteelFrameProposalFilename(title: string, proposalCode: string) {
  const safeTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `proposta-${safeTitle || "steel-frame"}-${proposalCode.toLowerCase()}.pdf`;
}
