import type {
  SteelFrameCalculatedItemRecord,
  SteelFrameCalculationContext,
  SteelFrameCalculationRuleType,
  SteelFrameCommercialComponentRecord,
  SteelFrameLaborItemRecord,
  SteelFrameMaterialRecord,
  SteelFrameOpeningRecord,
  SteelFrameOperationalCostRecord,
  SteelFrameWallSegmentRecord,
} from "./types";

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

export function formatSteelFrameCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

export function getCurrentMaterialPrice(material: SteelFrameMaterialRecord, referenceDate = new Date()) {
  const today = referenceDate.toISOString().slice(0, 10);
  const currentPrices = (material.prices ?? [])
    .filter((price) => price.effective_from <= today && (!price.effective_to || price.effective_to >= today))
    .sort((left, right) => {
      if (Boolean(left.preferred) !== Boolean(right.preferred)) return left.preferred ? -1 : 1;
      const effectiveOrder = right.effective_from.localeCompare(left.effective_from);
      if (effectiveOrder !== 0) return effectiveOrder;
      const createdOrder = (right.created_at ?? "").localeCompare(left.created_at ?? "");
      return createdOrder !== 0 ? createdOrder : right.id.localeCompare(left.id);
    });
  const price = currentPrices[0];

  return price
    ? {
        unitCost: toNumber(price.unit_cost),
        currency: price.currency,
        effectiveFrom: price.effective_from,
      }
    : null;
}

export function buildSteelFrameCalculationContext(
  walls: SteelFrameWallSegmentRecord[],
  openings: SteelFrameOpeningRecord[],
): SteelFrameCalculationContext {
  const wallLengthMeters = walls.reduce(
    (total, wall) => total + toNumber(wall.length_meters) * toNumber(wall.quantity),
    0,
  );
  const wallAreaSquareMeters = Math.max(
    0,
    walls.reduce((total, wall) => total + toNumber(wall.gross_area_square_meters), 0) - openings
      .filter((opening) => opening.subtract_from_wall_area)
      .reduce((total, opening) => total + toNumber(opening.opening_area_square_meters), 0),
  );
  const relevantOpenings = openings.filter((opening) => opening.subtract_from_wall_area);

  return {
    wallLengthMeters,
    wallAreaSquareMeters,
    openingCount: relevantOpenings.reduce((total, opening) => total + toNumber(opening.quantity), 0),
    openingLinearMeters: relevantOpenings.reduce(
      (total, opening) => total + 2 * (toNumber(opening.width_meters) + toNumber(opening.height_meters)) * toNumber(opening.quantity),
      0,
    ),
    boardCount: 0,
    studCount: 0,
    projectCount: 1,
  };
}

export function getCalculationContextIssue(
  ruleType: SteelFrameCalculationRuleType,
  context: SteelFrameCalculationContext,
) {
  if (["STUD_BY_SPACING", "TRACK_BY_LINEAR_LENGTH"].includes(ruleType) && context.wallLengthMeters <= 0) {
    return "Adicione paredes confirmadas antes de calcular este item.";
  }

  if (["BOARD_BY_AREA", "ROLL_BY_COVERAGE", "PACKAGE_BY_COVERAGE", "FASTENER_BY_AREA"].includes(ruleType) && context.wallAreaSquareMeters <= 0) {
    return "Adicione paredes e confira as aberturas antes de calcular por area.";
  }

  if (["FIXED_PER_OPENING", "LINEAR_BY_OPENING"].includes(ruleType) && context.openingCount <= 0) {
    return "Adicione portas ou janelas confirmadas antes de calcular este item.";
  }

  if (ruleType === "FASTENER_BY_BOARD" && context.boardCount <= 0) {
    return "Informe a quantidade de placas para calcular os fixadores.";
  }

  if (ruleType === "FASTENER_BY_STUD" && context.studCount <= 0) {
    return "Informe a quantidade de montantes para calcular os fixadores.";
  }

  return null;
}

export function sumSteelFrameDirectCosts({
  calculatedItems,
  laborItems,
  operationalCosts,
}: {
  calculatedItems: SteelFrameCalculatedItemRecord[];
  laborItems: SteelFrameLaborItemRecord[];
  operationalCosts: SteelFrameOperationalCostRecord[];
}) {
  const materialCost = calculatedItems.reduce((total, item) => total + toNumber(item.total_cost), 0);
  const laborCost = laborItems.reduce((total, item) => total + toNumber(item.total_cost), 0);
  const operationalCost = operationalCosts.reduce((total, item) => total + toNumber(item.amount), 0);

  return {
    materialCost,
    laborCost,
    operationalCost,
    directCost: materialCost + laborCost + operationalCost,
  };
}

export function getCommercialComponentValues(components: SteelFrameCommercialComponentRecord[]) {
  const byKey = new Map(components.map((component) => [component.component_key, toNumber(component.percentage)]));

  return {
    contingencyPercentOfCost: byKey.get("contingency") ?? null,
    taxPercentOfSale: byKey.get("tax") ?? null,
    salesCommissionPercentOfSale: byKey.get("sales_commission") ?? null,
    platformCommissionPercentOfSale: byKey.get("platform_commission") ?? null,
    targetMarginPercentOfSale: byKey.get("target_margin") ?? null,
    maxDiscountPercent: byKey.get("max_discount") ?? null,
  };
}
