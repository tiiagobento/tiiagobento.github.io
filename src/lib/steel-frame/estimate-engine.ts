import {
  buildEngineRuleCandidate,
  validateSteelFrameCatalogRuleEngineContract,
} from "./catalog/schemas";
import type { SteelFrameCatalogRuleDraft } from "./catalog/types";
import { buildSteelFrameCalculationContext, getCurrentMaterialPrice } from "./costing";
import {
  calculateSteelFrameEngineRule,
  createSteelFrameEngineContext,
  type SteelFrameEngineCalculationResult,
  type SteelFrameEngineRule,
} from "./engine";
import type {
  SteelFrameCalculatedItemInput,
  SteelFrameMaterialRecord,
  SteelFrameOpeningRecord,
  SteelFrameWallSegmentRecord,
} from "./types";

type RuleEvaluation =
  | {
      ok: true;
      engineRule: SteelFrameEngineRule;
      result: SteelFrameEngineCalculationResult;
    }
  | {
      ok: false;
      errors: string[];
    };

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function specificationValue(specification: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = specification[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function buildSteelFrameEstimateEngineContext(
  walls: SteelFrameWallSegmentRecord[],
  openings: SteelFrameOpeningRecord[],
) {
  const missingInformation: string[] = [];
  if (!walls.length) missingInformation.push("Confirme ao menos uma parede para calcular os quantitativos.");
  if (walls.some((wall) => wall.confirmation_status !== "confirmed")) {
    missingInformation.push("Existem paredes com medidas ainda nao confirmadas.");
  }
  if (openings.some((opening) => opening.confirmation_status !== "confirmed")) {
    missingInformation.push("Existem aberturas com medidas ainda nao confirmadas.");
  }
  if (openings.some((opening) => opening.wall_segment_id === null)) {
    missingInformation.push("Vincule as aberturas as paredes correspondentes para melhorar o calculo.");
  }

  return createSteelFrameEngineContext({
    projectCount: 1,
    walls: walls.map((wall) => ({
      id: wall.id,
      label: wall.label,
      lengthMeters: Number(wall.length_meters),
      heightMeters: Number(wall.height_meters),
      quantity: wall.quantity,
      segments: [],
      cavityWidthMeters: positiveNumber(wall.source_data.cavity_width_meters),
      source: null,
    })),
    openings: openings.map((opening) => ({
      id: opening.id,
      wallId: opening.wall_segment_id,
      label: opening.label,
      openingType: opening.opening_type,
      widthMeters: Number(opening.width_meters),
      heightMeters: Number(opening.height_meters),
      quantity: opening.quantity,
      requiresReinforcement: opening.opening_type !== "other",
      reinforcementTemplate: null,
    })),
    junctions: [],
    composition: null,
    missingInformation,
  });
}

export function evaluateSteelFrameCatalogRule(
  rule: SteelFrameCatalogRuleDraft,
  walls: SteelFrameWallSegmentRecord[],
  openings: SteelFrameOpeningRecord[],
): RuleEvaluation {
  const contract = validateSteelFrameCatalogRuleEngineContract(rule);
  if (!contract.success) {
    return {
      ok: false,
      errors: contract.error.issues.map((issue) => `${issue.path.join(".") || "regra"}: ${issue.message}`),
    };
  }

  return {
    ok: true,
    engineRule: contract.data,
    result: calculateSteelFrameEngineRule({
      rule: contract.data,
      context: buildSteelFrameEstimateEngineContext(walls, openings),
    }),
  };
}

export function findSteelFrameRuleMaterialMatches(
  rule: SteelFrameCatalogRuleDraft,
  materials: SteelFrameMaterialRecord[],
) {
  return materials.filter((material) => {
    const specification = material.technical_specification ?? {};
    const linkedRuleId = specificationValue(specification, ["technical_rule_id", "rule_id"]);
    const linkedRuleCode = specificationValue(specification, ["technical_rule_code", "rule_code"]);
    const linkedStrategy = specificationValue(specification, ["strategy_type", "engine_strategy"]);
    return linkedRuleId === rule.id || linkedRuleCode === rule.code || linkedStrategy === rule.strategyType;
  });
}

export function buildSteelFrameEngineCalculatedItem({
  rule,
  result,
  material,
  walls,
  openings,
}: {
  rule: SteelFrameCatalogRuleDraft;
  result: SteelFrameEngineCalculationResult;
  material: SteelFrameMaterialRecord;
  walls: SteelFrameWallSegmentRecord[];
  openings: SteelFrameOpeningRecord[];
}): SteelFrameCalculatedItemInput {
  const price = getCurrentMaterialPrice(material);
  if (!price) throw new Error("O material selecionado nao possui preco vigente.");
  if (result.classification === "blocked") throw new Error("A regra esta bloqueada por dados tecnicos pendentes.");

  const automatic = result.classification === "automatic_eligible" && rule.status === "approved";
  return {
    materialId: material.id,
    label: material.name,
    category: material.category,
    unit: material.unit,
    // The baseline table has a legacy enum. The complete typed rule remains in sourceData.
    rule: {
      ruleType: "MANUAL",
      parameters: {},
      manualQuantity: result.quantities.purchase.quantity,
      wastePercent: 0,
      roundingMode: "none",
      roundingMultiple: 1,
    },
    sourceValues: buildSteelFrameCalculationContext(walls, openings),
    rawQuantity: result.quantities.raw.value,
    calculatedQuantity: result.quantities.purchase.quantity,
    unitCost: price.unitCost,
    requiresTechnicalReview: !automatic,
    confirmationStatus: automatic ? "confirmed" : "needs_confirmation",
    sourceData: {
      calculation_mode: "typed_engine_v1",
      engine_rule: buildEngineRuleCandidate(rule),
      engine_result: result,
      catalog_price_effective_from: price.effectiveFrom,
      catalog_currency: price.currency,
    },
  };
}

export function hasPersistedSteelFrameEngineRule(
  sourceData: Record<string, unknown>,
  rule: Pick<SteelFrameCatalogRuleDraft, "id" | "version">,
) {
  const engineRule = sourceData.engine_rule;
  if (!engineRule || typeof engineRule !== "object") return false;
  const record = engineRule as Record<string, unknown>;
  return record.id === rule.id && record.version === rule.version;
}
