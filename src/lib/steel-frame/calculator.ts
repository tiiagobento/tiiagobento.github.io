import {
  steelFrameCalculationRuleSchema,
  steelFrameCommercialComponentsSchema,
} from "./schemas";
import type {
  SteelFrameAreaSummary,
  SteelFrameCalculatedQuantity,
  SteelFrameCalculationContext,
  SteelFrameCalculationRule,
  SteelFrameCommercialComponents,
  SteelFrameCommercialPricing,
  SteelFrameOpeningInput,
  SteelFrameWallSegmentInput,
} from "./types";

const roundTo = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const roundCurrency = (value: number) => roundTo(value, 2);

const applyRounding = (
  value: number,
  mode: SteelFrameCalculationRule["roundingMode"] = "none",
  multiple = 1,
) => {
  if (mode === "none") {
    return roundTo(value);
  }

  const normalized = value / multiple;
  const rounded =
    mode === "ceil"
      ? Math.ceil(normalized)
      : mode === "floor"
        ? Math.floor(normalized)
        : Math.round(normalized);

  return roundTo(rounded * multiple);
};

export function calculateWallAreas(
  wallSegments: SteelFrameWallSegmentInput[],
  openings: SteelFrameOpeningInput[],
): SteelFrameAreaSummary {
  const warnings: string[] = [];
  const wallIds = new Set(wallSegments.flatMap((wall) => (wall.id ? [wall.id] : [])));

  const grossWallArea = wallSegments.reduce(
    (total, wall) => total + wall.lengthMeters * wall.heightMeters * wall.quantity,
    0,
  );

  const openingArea = openings.reduce((total, opening) => {
    if (!opening.subtractFromWallArea) {
      return total;
    }

    if (opening.wallSegmentId && !wallIds.has(opening.wallSegmentId)) {
      warnings.push(`A abertura "${opening.label}" nao esta vinculada a um trecho valido.`);
    }

    return total + opening.widthMeters * opening.heightMeters * opening.quantity;
  }, 0);

  const netWallArea = grossWallArea - openingArea;
  if (netWallArea < 0) {
    warnings.push("A area das aberturas e maior que a area informada das paredes. Revise as medidas.");
  }

  return {
    grossWallArea: roundTo(grossWallArea),
    openingArea: roundTo(openingArea),
    netWallArea: roundTo(Math.max(0, netWallArea)),
    warnings,
  };
}

export function calculateMaterialQuantity({
  rule,
  context,
}: {
  rule: SteelFrameCalculationRule;
  context: SteelFrameCalculationContext;
}): SteelFrameCalculatedQuantity {
  const parsedRule = steelFrameCalculationRuleSchema.parse(rule);
  const projectCount = context.projectCount ?? 1;
  const parameters = parsedRule.parameters;
  let rawQuantity = 0;
  let unit = "un";
  let explanation = "";

  switch (parsedRule.ruleType) {
    case "STUD_BY_SPACING": {
      const spacing = parameters.spacingMeters;
      rawQuantity = Math.ceil(context.wallLengthMeters / spacing) + 1;
      unit = "un";
      explanation = `Montantes por espacamento configurado de ${spacing} m.`;
      break;
    }
    case "TRACK_BY_LINEAR_LENGTH":
      rawQuantity = context.wallLengthMeters;
      unit = "m";
      explanation = "Guias pela metragem linear de parede confirmada.";
      break;
    case "BOARD_BY_AREA":
    case "ROLL_BY_COVERAGE":
    case "PACKAGE_BY_COVERAGE":
    case "FASTENER_BY_AREA": {
      const coverage = parameters.coveragePerUnit;
      rawQuantity = context.wallAreaSquareMeters / coverage;
      unit = parsedRule.ruleType === "FASTENER_BY_AREA" ? "un" : "un";
      explanation = `Quantidade por cobertura configurada de ${coverage} m2 por unidade.`;
      break;
    }
    case "FASTENER_BY_BOARD":
      rawQuantity = context.boardCount * parameters.unitsPerBoard;
      unit = "un";
      explanation = "Fixadores pela quantidade de placas calculada.";
      break;
    case "FASTENER_BY_STUD":
      rawQuantity = context.studCount * parameters.unitsPerStud;
      unit = "un";
      explanation = "Fixadores pela quantidade de montantes calculada.";
      break;
    case "FIXED_PER_OPENING":
      rawQuantity = context.openingCount * parameters.unitsPerOpening;
      unit = "un";
      explanation = "Item fixo por abertura confirmada.";
      break;
    case "FIXED_PER_PROJECT":
      rawQuantity = projectCount * parameters.unitsPerProject;
      unit = "un";
      explanation = "Item fixo por projeto.";
      break;
    case "LINEAR_BY_OPENING":
      rawQuantity = context.openingLinearMeters * parameters.unitsPerLinearMeter;
      unit = "m";
      explanation = "Item linear pelo perimetro das aberturas.";
      break;
    case "MANUAL":
      rawQuantity = parsedRule.manualQuantity ?? 0;
      unit = "un";
      explanation = "Quantidade definida manualmente e sujeita a revisao tecnica.";
      break;
  }

  const quantityWithWaste = rawQuantity * (1 + (parsedRule.wastePercent ?? 0) / 100);
  const finalQuantity = applyRounding(
    quantityWithWaste,
    parsedRule.roundingMode ?? "none",
    parsedRule.roundingMultiple ?? 1,
  );

  return {
    rawQuantity: roundTo(rawQuantity),
    quantityWithWaste: roundTo(quantityWithWaste),
    finalQuantity,
    unit,
    explanation,
  };
}

export function calculateCommercialPricing(
  components: SteelFrameCommercialComponents,
): SteelFrameCommercialPricing {
  const parsed = steelFrameCommercialComponentsSchema.parse(components);
  const warnings: string[] = [];
  const contingencyAmount = parsed.directCost * (parsed.contingencyPercentOfCost / 100);
  const protectedCost = parsed.directCost + contingencyAmount;
  const fixedSalePercent =
    parsed.taxPercentOfSale +
    parsed.salesCommissionPercentOfSale +
    parsed.platformCommissionPercentOfSale;
  const minimumDenominator = 1 - fixedSalePercent / 100;
  const recommendedDenominator = 1 - (fixedSalePercent + parsed.targetMarginPercentOfSale) / 100;

  if (parsed.directCost === 0) {
    warnings.push("O custo direto esta zerado. Revise itens de materiais, mao de obra e custos operacionais.");
  }

  const minimumSalePrice = protectedCost / minimumDenominator;
  const recommendedSalePrice = protectedCost / recommendedDenominator;
  const requestedDiscount = recommendedSalePrice * (parsed.maxDiscountPercent / 100);
  const priceGap = Math.max(0, recommendedSalePrice - minimumSalePrice);
  const maximumAllowedDiscountAmount = Math.min(requestedDiscount, priceGap);
  const minimumPriceAfterDiscount = recommendedSalePrice - maximumAllowedDiscountAmount;

  return {
    contingencyAmount: roundCurrency(contingencyAmount),
    minimumSalePrice: roundCurrency(minimumSalePrice),
    recommendedSalePrice: roundCurrency(recommendedSalePrice),
    maximumAllowedDiscountAmount: roundCurrency(maximumAllowedDiscountAmount),
    minimumPriceAfterDiscount: roundCurrency(minimumPriceAfterDiscount),
    warnings,
  };
}
