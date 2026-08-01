import { calculateSteelFrameCuttingPlan } from "./cutting-stock";
import {
  steelFrameEngineCalculationRequestSchema,
  type SteelFrameEngineCalculationRequest,
  type SteelFrameEngineRule,
} from "./schemas";
import type {
  SteelFrameEngineAlert,
  SteelFrameEngineCalculationContext,
  SteelFrameEngineCalculationExplanation,
  SteelFrameEngineCalculationResult,
  SteelFrameEngineCommercialBar,
  SteelFrameEnginePurchaseQuantity,
  SteelFrameEngineQuantityResult,
  SteelFrameEngineRuleSnapshot,
  SteelFrameEngineTechnicalPiece,
  SteelFrameEngineTechnicalStatus,
  SteelFrameEngineUnit,
  SteelFrameEngineWall,
} from "./types";
import {
  applySteelFrameEngineRounding,
  roundSteelFrameEngineNumber,
} from "./units";

type ParsedContext = SteelFrameEngineCalculationRequest["context"];

const classificationRank: Record<SteelFrameEngineTechnicalStatus, number> = {
  automatic_eligible: 0,
  preliminary: 1,
  technical_review_required: 2,
  blocked: 3,
};

const blockingPatternLabels = {
  alternate: "alternado",
  all_cells: "todas as celulas",
  fixed_lines: "linhas fixas",
  vertical_interval: "intervalo vertical",
  fixed_quantity: "quantidade fixa",
  manual: "manual",
} as const;

function highestClassification(
  ...classifications: SteelFrameEngineTechnicalStatus[]
): SteelFrameEngineTechnicalStatus {
  return classifications.reduce<SteelFrameEngineTechnicalStatus>(
    (current, next) =>
      classificationRank[next] > classificationRank[current] ? next : current,
    "automatic_eligible",
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(roundSteelFrameEngineNumber(value));
}

function unitText(value: number, unit: SteelFrameEngineUnit): string {
  return `${formatNumber(value)} ${unit}`;
}

function buildRuleSnapshot(rule: SteelFrameEngineRule): SteelFrameEngineRuleSnapshot {
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    strategy: rule.strategy,
    version: rule.version,
    approvalStatus: rule.approvalStatus,
    source: rule.source,
  };
}

function createQuantityResult({
  rawQuantity,
  technicalUnit,
  purchaseUnit,
  wastePercent,
  capacityPerPurchaseUnit,
}: {
  rawQuantity: number;
  technicalUnit: SteelFrameEngineUnit;
  purchaseUnit: SteelFrameEngineUnit;
  wastePercent: number;
  capacityPerPurchaseUnit: number;
}): SteelFrameEngineQuantityResult {
  const raw = Math.max(0, roundSteelFrameEngineNumber(rawQuantity));
  const quantityWithWaste = roundSteelFrameEngineNumber(raw * (1 + wastePercent / 100));
  const wasteQuantity = roundSteelFrameEngineNumber(quantityWithWaste - raw);
  const purchaseRounding = applySteelFrameEngineRounding(
    quantityWithWaste / capacityPerPurchaseUnit,
    "ceil",
  );
  const coveredTechnicalQuantity = roundSteelFrameEngineNumber(
    purchaseRounding.appliedValue * capacityPerPurchaseUnit,
  );

  return {
    raw: { value: raw, unit: technicalUnit },
    withWaste: { value: quantityWithWaste, unit: technicalUnit },
    waste: {
      configuredPercent: wastePercent,
      quantity: { value: wasteQuantity, unit: technicalUnit },
      reason: wastePercent > 0 ? "Perda configurada na regra." : null,
    },
    purchase: {
      quantity: purchaseRounding.appliedValue,
      unit: purchaseUnit,
      capacityPerPurchaseUnit: { value: capacityPerPurchaseUnit, unit: technicalUnit },
      coveredTechnicalQuantity,
      estimatedLeftover: {
        value: roundSteelFrameEngineNumber(
          Math.max(0, coveredTechnicalQuantity - quantityWithWaste),
        ),
        unit: technicalUnit,
      },
      rounding: purchaseRounding,
    },
  };
}

function createBarQuantityResult({
  rawLengthMeters,
  lengthWithWasteMeters,
  wastePercent,
  purchaseQuantity,
  totalCommercialLengthMeters,
  totalLeftoverMeters,
}: {
  rawLengthMeters: number;
  lengthWithWasteMeters: number;
  wastePercent: number;
  purchaseQuantity: number;
  totalCommercialLengthMeters: number;
  totalLeftoverMeters: number;
}): SteelFrameEngineQuantityResult {
  return {
    raw: { value: roundSteelFrameEngineNumber(rawLengthMeters), unit: "m" },
    withWaste: { value: roundSteelFrameEngineNumber(lengthWithWasteMeters), unit: "m" },
    waste: {
      configuredPercent: wastePercent,
      quantity: {
        value: roundSteelFrameEngineNumber(
          Math.max(0, lengthWithWasteMeters - rawLengthMeters),
        ),
        unit: "m",
      },
      reason: wastePercent > 0 ? "Reserva de perda configurada na regra." : null,
    },
    purchase: {
      quantity: purchaseQuantity,
      unit: "bar",
      capacityPerPurchaseUnit: { value: 0, unit: "m" },
      coveredTechnicalQuantity: roundSteelFrameEngineNumber(totalCommercialLengthMeters),
      estimatedLeftover: { value: roundSteelFrameEngineNumber(totalLeftoverMeters), unit: "m" },
      rounding: { mode: "ceil", multiple: 1, appliedValue: purchaseQuantity },
    },
  };
}

function createExplanation({
  title,
  strategy,
  summary,
  inputs = [],
  parameters = [],
  subtotals = [],
  purchase = [],
}: {
  title: string;
  strategy: SteelFrameEngineCalculationExplanation["strategy"];
  summary: string;
  inputs?: SteelFrameEngineCalculationExplanation["inputs"];
  parameters?: SteelFrameEngineCalculationExplanation["parameters"];
  subtotals?: SteelFrameEngineCalculationExplanation["subtotals"];
  purchase?: SteelFrameEngineCalculationExplanation["purchase"];
}): SteelFrameEngineCalculationExplanation {
  const text = [
    summary,
    ...inputs.map((line) => `${line.label}: ${line.value}.`),
    ...parameters.map((line) => `${line.label}: ${line.value}.`),
    ...subtotals.map((line) => `${line.label}: ${line.value}.`),
    ...purchase.map((line) => `${line.label}: ${line.value}.`),
  ].join(" ");

  return { title, strategy, summary, inputs, parameters, subtotals, purchase, text };
}

function createBlockedResult(message: string): SteelFrameEngineCalculationResult {
  return {
    strategy: null,
    classification: "blocked",
    rule: null,
    quantities: createQuantityResult({
      rawQuantity: 0,
      technicalUnit: "unit",
      purchaseUnit: "unit",
      wastePercent: 0,
      capacityPerPurchaseUnit: 1,
    }),
    technicalPieces: [],
    cuttingPlan: null,
    explanation: createExplanation({
      title: "Calculo bloqueado",
      strategy: null,
      summary: message,
    }),
    alerts: [{ code: "INVALID_CALCULATION_INPUT", severity: "critical", message }],
  };
}

function selectedWalls(rule: SteelFrameEngineRule, context: ParsedContext): SteelFrameEngineWall[] {
  if (!rule.scope.wallIds.length) {
    return context.walls;
  }

  return context.walls.filter((wall) => rule.scope.wallIds.includes(wall.id));
}

function selectedOpenings(
  rule: SteelFrameEngineRule,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
) {
  const wallIds = new Set(walls.map((wall) => wall.id));
  if (rule.scope.openingIds.length) {
    return context.openings.filter((opening) => rule.scope.openingIds.includes(opening.id));
  }

  return context.openings.filter((opening) => opening.wallId === null || wallIds.has(opening.wallId));
}

function getGrossArea(walls: SteelFrameEngineWall[]): number {
  return roundSteelFrameEngineNumber(
    walls.reduce(
      (total, wall) => total + wall.lengthMeters * wall.heightMeters * wall.quantity,
      0,
    ),
  );
}

function getOpeningArea(
  openings: ParsedContext["openings"],
  treatment: "do_not_deduct" | "deduct_all" | "deduct_above_area",
  minimumAreaSquareMeters: number,
): number {
  if (treatment === "do_not_deduct") {
    return 0;
  }

  return roundSteelFrameEngineNumber(
    openings.reduce((total, opening) => {
      const area = opening.widthMeters * opening.heightMeters * opening.quantity;
      if (treatment === "deduct_above_area" && area < minimumAreaSquareMeters) {
        return total;
      }
      return total + area;
    }, 0),
  );
}

function getApplicationArea({
  walls,
  openings,
  treatment,
  minimumAreaSquareMeters,
}: {
  walls: SteelFrameEngineWall[];
  openings: ParsedContext["openings"];
  treatment: "do_not_deduct" | "deduct_all" | "deduct_above_area";
  minimumAreaSquareMeters: number;
}) {
  const grossArea = getGrossArea(walls);
  const deductedOpeningArea = getOpeningArea(openings, treatment, minimumAreaSquareMeters);
  return {
    grossArea,
    deductedOpeningArea,
    netArea: roundSteelFrameEngineNumber(Math.max(0, grossArea - deductedOpeningArea)),
  };
}

function createTechnicalPieces(
  entries: Array<{ id: string; label: string; quantity: number; lengthMeters: number; source: string }>,
): SteelFrameEngineTechnicalPiece[] {
  return entries
    .filter((entry) => entry.quantity > 0 && entry.lengthMeters > 0)
    .map((entry) => ({
      ...entry,
      quantity: Math.ceil(entry.quantity),
      lengthMeters: roundSteelFrameEngineNumber(entry.lengthMeters),
    }))
    .sort((first, second) => first.id.localeCompare(second.id, "en"));
}

function createWasteReservePieces({
  totalWasteLengthMeters,
  commercialBars,
  idPrefix,
}: {
  totalWasteLengthMeters: number;
  commercialBars: SteelFrameEngineCommercialBar[];
  idPrefix: string;
}): SteelFrameEngineTechnicalPiece[] {
  if (totalWasteLengthMeters <= 0) {
    return [];
  }

  const maximumLength = Math.max(...commercialBars.map((bar) => bar.lengthMeters));
  const fullPieces = Math.floor(totalWasteLengthMeters / maximumLength);
  const remainder = roundSteelFrameEngineNumber(totalWasteLengthMeters - fullPieces * maximumLength);
  const entries: SteelFrameEngineTechnicalPiece[] = [];

  if (fullPieces > 0) {
    entries.push({
      id: `${idPrefix}:full`,
      label: "Reserva de perda configurada",
      quantity: fullPieces,
      lengthMeters: maximumLength,
      source: "Perda configurada na regra",
    });
  }
  if (remainder > 0) {
    entries.push({
      id: `${idPrefix}:remainder`,
      label: "Reserva de perda configurada",
      quantity: 1,
      lengthMeters: remainder,
      source: "Perda configurada na regra",
    });
  }

  return entries;
}

function determineClassification({
  rule,
  context,
  walls,
  openings,
  alerts,
}: {
  rule: SteelFrameEngineRule;
  context: ParsedContext;
  walls: SteelFrameEngineWall[];
  openings: ParsedContext["openings"];
  alerts: SteelFrameEngineAlert[];
}): SteelFrameEngineTechnicalStatus {
  let classification: SteelFrameEngineTechnicalStatus =
    rule.approvalStatus === "approved" ? "automatic_eligible" : "technical_review_required";

  if (context.missingInformation.length) {
    classification = highestClassification(classification, "preliminary");
    alerts.push({
      code: "MISSING_INFORMATION",
      severity: "warning",
      message: `Ha ${context.missingInformation.length} informacao(oes) pendente(s) no contexto.`,
    });
  }

  if (context.composition && context.composition.approvalStatus !== "approved") {
    classification = highestClassification(classification, "technical_review_required");
    alerts.push({
      code: "COMPOSITION_NOT_APPROVED",
      severity: "warning",
      message: "A composicao vinculada ainda nao esta aprovada para liberacao automatica.",
    });
  }

  const maxWallHeight = rule.limits.maxWallHeightMeters ?? context.composition?.maxWallHeightMeters;
  if (maxWallHeight !== null && maxWallHeight !== undefined) {
    const exceedsWallHeight = walls.some((wall) => wall.heightMeters > maxWallHeight);
    if (exceedsWallHeight) {
      classification = highestClassification(classification, "technical_review_required");
      alerts.push({
        code: "WALL_HEIGHT_OUTSIDE_LIMIT",
        severity: "warning",
        message: `Ha parede acima do limite configurado de ${formatNumber(maxWallHeight)} m.`,
      });
    }
  }

  if (rule.limits.maxOpeningWidthMeters !== null) {
    const exceedsOpeningWidth = openings.some(
      (opening) => opening.widthMeters > rule.limits.maxOpeningWidthMeters!,
    );
    if (exceedsOpeningWidth) {
      classification = highestClassification(classification, "technical_review_required");
      alerts.push({
        code: "OPENING_OUTSIDE_LIMIT",
        severity: "warning",
        message: "Ha abertura acima do limite configurado pela regra.",
      });
    }
  }

  if (rule.strategy === "MANUAL") {
    classification = highestClassification(classification, "technical_review_required");
    alerts.push({
      code: "MANUAL_OVERRIDE",
      severity: "warning",
      message: "Quantidade manual exige revisao tecnica antes da aprovacao final.",
    });
  }

  return classification;
}

function requiredInputUnits(rule: SteelFrameEngineRule): SteelFrameEngineUnit[] {
  switch (rule.strategy) {
    case "STUD_BY_SPACING":
    case "TRACK_BY_WALL_LENGTH":
    case "BLOCKING_BY_STUD_PATTERN":
    case "CUTTING_STOCK_OPTIMIZATION":
      return ["m"];
    case "BOARD_BY_AREA_COEFFICIENT":
    case "MEMBRANE_BY_AREA":
    case "INSULATION_BY_AREA":
    case "FASTENER_BY_AREA":
      return ["m2"];
    case "FASTENER_BY_BOARD":
      return ["board"];
    case "FIXED_PER_OPENING":
    case "FIXED_PER_PROJECT":
      return ["unit"];
    case "MANUAL":
    case "PACKAGING_ROUNDING":
      return [rule.technicalUnit];
  }
}

function validateDeclaredUnits(rule: SteelFrameEngineRule): SteelFrameEngineAlert | null {
  const missingUnit = requiredInputUnits(rule).find(
    (unit) => !rule.acceptedInputUnits.includes(unit),
  );
  if (!missingUnit) {
    return null;
  }

  return {
    code: "INPUT_UNIT_NOT_ACCEPTED",
    severity: "critical",
    message: `A regra nao declara a unidade de entrada obrigatoria ${missingUnit}.`,
  };
}

function buildResult({
  rule,
  context,
  walls,
  openings,
  quantities,
  technicalPieces = [],
  cuttingPlan = null,
  explanation,
  alerts = [],
  classification,
}: {
  rule: SteelFrameEngineRule;
  context: ParsedContext;
  walls: SteelFrameEngineWall[];
  openings: ParsedContext["openings"];
  quantities: SteelFrameEngineQuantityResult;
  technicalPieces?: SteelFrameEngineTechnicalPiece[];
  cuttingPlan?: SteelFrameEngineCalculationResult["cuttingPlan"];
  explanation: SteelFrameEngineCalculationExplanation;
  alerts?: SteelFrameEngineAlert[];
  classification?: SteelFrameEngineTechnicalStatus;
}): SteelFrameEngineCalculationResult {
  const technicalAlerts = [...alerts];
  const contextualClassification = determineClassification({
    rule,
    context,
    walls,
    openings,
    alerts: technicalAlerts,
  });

  return {
    strategy: rule.strategy,
    classification: highestClassification(classification ?? "automatic_eligible", contextualClassification),
    rule: buildRuleSnapshot(rule),
    quantities,
    technicalPieces,
    cuttingPlan,
    explanation,
    alerts: technicalAlerts,
  };
}

function requiresWalls(
  rule: SteelFrameEngineRule,
  walls: SteelFrameEngineWall[],
): SteelFrameEngineCalculationResult | null {
  if (walls.length) {
    return null;
  }

  return {
    ...createBlockedResult(`A regra ${rule.name} precisa de pelo menos uma parede no escopo.`),
    strategy: rule.strategy,
    rule: buildRuleSnapshot(rule),
  };
}

function calculateStuds(
  rule: Extract<SteelFrameEngineRule, { strategy: "STUD_BY_SPACING" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;

  const alerts: SteelFrameEngineAlert[] = [];
  const pieces: SteelFrameEngineTechnicalPiece[] = [];
  let regularStuds = 0;
  let edgeStuds = 0;
  let junctionStuds = 0;
  let openingStuds = 0;

  walls.forEach((wall) => {
    const intervals = Math.ceil(wall.lengthMeters / rule.parameters.spacingMeters);
    const interiorStuds = Math.max(0, intervals - 1);
    const perWallRegular = interiorStuds;
    const perWallEdges =
      rule.parameters.initialStudsPerWall + rule.parameters.endStudsPerWall;
    regularStuds += perWallRegular * wall.quantity;
    edgeStuds += perWallEdges * wall.quantity;
    pieces.push({
      id: `stud:regular:${wall.id}`,
      label: `Montantes regulares - ${wall.label}`,
      quantity: perWallRegular * wall.quantity,
      lengthMeters: wall.heightMeters,
      source: `${formatNumber(intervals)} intervalos de ${formatNumber(rule.parameters.spacingMeters)} m`,
    });
    pieces.push({
      id: `stud:edge:${wall.id}`,
      label: `Montantes de extremidade - ${wall.label}`,
      quantity: perWallEdges * wall.quantity,
      lengthMeters: wall.heightMeters,
      source: "Montantes inicial e final configurados na regra",
    });
  });

  const selectedWallIds = new Set(walls.map((wall) => wall.id));
  context.junctions
    .filter((junction) => junction.wallIds.some((wallId) => selectedWallIds.has(wallId)))
    .forEach((junction) => {
      if (!junction.extraStuds) return;
      const relatedWalls = walls.filter((wall) => junction.wallIds.includes(wall.id));
      const referenceHeight = Math.max(...relatedWalls.map((wall) => wall.heightMeters));
      junctionStuds += junction.extraStuds;
      pieces.push({
        id: `stud:junction:${junction.id}`,
        label: `Montantes de encontro - ${junction.type}`,
        quantity: junction.extraStuds,
        lengthMeters: referenceHeight,
        source: junction.description ?? "Encontro informado no modelo",
      });
    });

  openings.forEach((opening) => {
    if (!opening.requiresReinforcement) return;
    const template = opening.reinforcementTemplate;
    if (!template) {
      alerts.push({
        code: "OPENING_TEMPLATE_MISSING",
        severity: "critical",
        message: `A abertura ${opening.label} exige reforco, mas nao possui template configurado.`,
      });
      return;
    }
    if (template.approvalStatus !== "approved") {
      alerts.push({
        code: "OPENING_TEMPLATE_NOT_APPROVED",
        severity: "warning",
        message: `O template de reforco ${template.name} da abertura ${opening.label} ainda nao esta aprovado.`,
      });
    }
    if (
      template.maxOpeningWidthMeters !== null &&
      opening.widthMeters > template.maxOpeningWidthMeters
    ) {
      alerts.push({
        code: "OPENING_TEMPLATE_LIMIT_EXCEEDED",
        severity: "warning",
        message: `A abertura ${opening.label} excede o limite do template ${template.name}.`,
      });
    }

    const relatedWall = opening.wallId
      ? walls.find((wall) => wall.id === opening.wallId) ?? null
      : null;
    const referenceHeight = relatedWall?.heightMeters ?? Math.max(...walls.map((wall) => wall.heightMeters));
    if (!relatedWall && opening.wallId) {
      alerts.push({
        code: "OPENING_WALL_NOT_IN_SCOPE",
        severity: "warning",
        message: `A abertura ${opening.label} nao esta vinculada a uma parede selecionada; foi usada a maior altura do escopo.`,
      });
    }
    openingStuds += template.extraStudsPerOpening * opening.quantity;
    pieces.push({
      id: `stud:opening:${opening.id}`,
      label: `Montantes de reforco - ${opening.label}`,
      quantity: template.extraStudsPerOpening * opening.quantity,
      lengthMeters: referenceHeight,
      source: `Template de reforco ${template.name}`,
    });
  });

  const referenceHeight = Math.max(...walls.map((wall) => wall.heightMeters));
  const manualExtraStuds = rule.parameters.manualExtraStuds;
  if (manualExtraStuds > 0) {
    pieces.push({
      id: "stud:manual",
      label: "Montantes extras manuais",
      quantity: manualExtraStuds,
      lengthMeters: referenceHeight,
      source: "Ajuste manual configurado na regra",
    });
  }

  const basePieces = createTechnicalPieces(pieces);
  const basePieceCount = basePieces.reduce((total, piece) => total + piece.quantity, 0);
  const configuredCountWithWaste = Math.max(
    basePieceCount,
    applySteelFrameEngineRounding(
      basePieceCount * (1 + rule.wastePercent / 100),
      rule.roundingMode,
      rule.roundingMultiple,
    ).appliedValue,
  );
  const reservePieces = createWasteReservePieces({
    totalWasteLengthMeters:
      Math.max(0, configuredCountWithWaste - basePieceCount) * referenceHeight,
    commercialBars: rule.parameters.commercialStock.commercialBars,
    idPrefix: "stud:waste",
  });
  const technicalPieces = createTechnicalPieces([...basePieces, ...reservePieces]);
  const cuttingPlan = calculateSteelFrameCuttingPlan({
    pieces: technicalPieces,
    ...rule.parameters.commercialStock,
  });
  const rawLengthMeters = roundSteelFrameEngineNumber(
    basePieces.reduce((total, piece) => total + piece.quantity * piece.lengthMeters, 0),
  );
  const withWasteLengthMeters = roundSteelFrameEngineNumber(
    technicalPieces.reduce((total, piece) => total + piece.quantity * piece.lengthMeters, 0),
  );

  const missingTemplate = alerts.some((alert) => alert.code === "OPENING_TEMPLATE_MISSING");
  const templateNeedsReview = alerts.some((alert) =>
    ["OPENING_TEMPLATE_NOT_APPROVED", "OPENING_TEMPLATE_LIMIT_EXCEEDED"].includes(alert.code),
  );
  const classification = missingTemplate
    ? "blocked"
    : templateNeedsReview || manualExtraStuds > 0
      ? "technical_review_required"
      : "automatic_eligible";

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createBarQuantityResult({
      rawLengthMeters,
      lengthWithWasteMeters: withWasteLengthMeters,
      wastePercent: rule.wastePercent,
      purchaseQuantity: cuttingPlan.commercialBarsToPurchase,
      totalCommercialLengthMeters: cuttingPlan.totalCommercialLengthMeters,
      totalLeftoverMeters: cuttingPlan.totalLeftoverMeters,
    }),
    technicalPieces,
    cuttingPlan,
    alerts,
    classification,
    explanation: createExplanation({
      title: "Montantes por espacamento",
      strategy: rule.strategy,
      summary: `Foram calculados ${formatNumber(basePieceCount)} montantes antes da reserva de perda e ${formatNumber(cuttingPlan.commercialBarsToPurchase)} barras comerciais para compra.`,
      inputs: walls.map((wall) => ({
        label: wall.label,
        value: `${unitText(wall.lengthMeters, "m")} x ${unitText(wall.heightMeters, "m")} x ${formatNumber(wall.quantity)}`,
      })),
      parameters: [
        { label: "Espacamento maximo", value: unitText(rule.parameters.spacingMeters, "m") },
        {
          label: "Extremidades por parede",
          value: `${formatNumber(rule.parameters.initialStudsPerWall)} inicial(is) e ${formatNumber(rule.parameters.endStudsPerWall)} final(is)`,
        },
      ],
      subtotals: [
        { label: "Montantes regulares", value: unitText(regularStuds, "piece") },
        { label: "Montantes de extremidade", value: unitText(edgeStuds, "piece") },
        { label: "Montantes de encontros", value: unitText(junctionStuds, "piece") },
        { label: "Montantes de aberturas", value: unitText(openingStuds, "piece") },
        { label: "Ajuste manual", value: unitText(manualExtraStuds, "piece") },
        { label: "Metragem tecnica", value: unitText(rawLengthMeters, "m") },
      ],
      purchase: [
        { label: "Barras para compra", value: unitText(cuttingPlan.commercialBarsToPurchase, "bar") },
        { label: "Sobra estimada", value: unitText(cuttingPlan.totalLeftoverMeters, "m") },
      ],
    }),
  });
}

function calculateTracks(
  rule: Extract<SteelFrameEngineRule, { strategy: "TRACK_BY_WALL_LENGTH" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;

  const entries: SteelFrameEngineTechnicalPiece[] = [];
  let lowerMeters = 0;
  let upperMeters = 0;
  let openingMeters = 0;
  let blockingMeters = 0;
  let lintelMeters = 0;
  let sillMeters = 0;
  let junctionMeters = 0;

  walls.forEach((wall) => {
    const wallLengthForAllInstances = wall.lengthMeters * wall.quantity;
    lowerMeters += wallLengthForAllInstances * rule.parameters.lowerRunsPerWall;
    upperMeters += wallLengthForAllInstances * rule.parameters.upperRunsPerWall;
    blockingMeters += wall.quantity * rule.parameters.blockingTrackMetersPerWall;
    if (rule.parameters.lowerRunsPerWall > 0) {
      entries.push({
        id: `track:lower:${wall.id}`,
        label: `Guia inferior - ${wall.label}`,
        quantity: wall.quantity * rule.parameters.lowerRunsPerWall,
        lengthMeters: wall.lengthMeters,
        source: "Guias inferiores configuradas na regra",
      });
    }
    if (rule.parameters.upperRunsPerWall > 0) {
      entries.push({
        id: `track:upper:${wall.id}`,
        label: `Guia superior - ${wall.label}`,
        quantity: wall.quantity * rule.parameters.upperRunsPerWall,
        lengthMeters: wall.lengthMeters,
        source: "Guias superiores configuradas na regra",
      });
    }
    if (rule.parameters.blockingTrackMetersPerWall > 0) {
      entries.push({
        id: `track:blocking:${wall.id}`,
        label: `Guia para bloqueadores - ${wall.label}`,
        quantity: wall.quantity,
        lengthMeters: rule.parameters.blockingTrackMetersPerWall,
        source: "Guias de bloqueador configuradas na regra",
      });
    }
  });

  openings.forEach((opening) => {
    const template = opening.reinforcementTemplate;
    const templateOpening = template?.openingTrackMetersPerOpening ?? 0;
    const templateBlocking = template?.blockingTrackMetersPerOpening ?? 0;
    const openingLength = rule.parameters.openingTrackMetersPerOpening + templateOpening;
    const lintelLength = rule.parameters.lintelTrackMetersPerOpening + (template?.lintelMetersPerOpening ?? 0);
    const sillLength = rule.parameters.sillTrackMetersPerOpening + (template?.sillMetersPerOpening ?? 0);
    const blockingLength = templateBlocking;
    openingMeters += opening.quantity * openingLength;
    lintelMeters += opening.quantity * lintelLength;
    sillMeters += opening.quantity * sillLength;
    blockingMeters += opening.quantity * blockingLength;
    [
      { key: "opening", label: "Guias de abertura", lengthMeters: openingLength },
      { key: "lintel", label: "Vergas", lengthMeters: lintelLength },
      { key: "sill", label: "Contravergas ou peitoris", lengthMeters: sillLength },
      { key: "blocking", label: "Guias de bloqueador em abertura", lengthMeters: blockingLength },
    ].forEach((entry) => {
      if (entry.lengthMeters > 0) {
        entries.push({
          id: `track:${entry.key}:${opening.id}`,
          label: `${entry.label} - ${opening.label}`,
          quantity: opening.quantity,
          lengthMeters: entry.lengthMeters,
          source: template ? `Template ${template.name}` : "Parametro da regra",
        });
      }
    });
  });

  const selectedWallIds = new Set(walls.map((wall) => wall.id));
  context.junctions
    .filter((junction) => junction.wallIds.some((wallId) => selectedWallIds.has(wallId)))
    .forEach((junction) => {
      if (!junction.extraTrackMeters) return;
      junctionMeters += junction.extraTrackMeters;
      entries.push({
        id: `track:junction:${junction.id}`,
        label: `Guia adicional de encontro - ${junction.type}`,
        quantity: 1,
        lengthMeters: junction.extraTrackMeters,
        source: junction.description ?? "Encontro informado no modelo",
      });
    });

  if (rule.parameters.manualTrackMeters > 0) {
    entries.push({
      id: "track:manual",
      label: "Guia adicional manual",
      quantity: 1,
      lengthMeters: rule.parameters.manualTrackMeters,
      source: "Ajuste manual configurado na regra",
    });
  }

  const basePieces = createTechnicalPieces(entries);
  const rawLengthMeters = roundSteelFrameEngineNumber(
    basePieces.reduce((total, piece) => total + piece.quantity * piece.lengthMeters, 0),
  );
  const reservePieces = createWasteReservePieces({
    totalWasteLengthMeters: rawLengthMeters * (rule.wastePercent / 100),
    commercialBars: rule.parameters.commercialStock.commercialBars,
    idPrefix: "track:waste",
  });
  const technicalPieces = createTechnicalPieces([...basePieces, ...reservePieces]);
  const cuttingPlan = calculateSteelFrameCuttingPlan({
    pieces: technicalPieces,
    ...rule.parameters.commercialStock,
  });
  const withWasteLengthMeters = roundSteelFrameEngineNumber(
    technicalPieces.reduce((total, piece) => total + piece.quantity * piece.lengthMeters, 0),
  );
  const classification = rule.parameters.manualTrackMeters > 0 ? "technical_review_required" : "automatic_eligible";

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createBarQuantityResult({
      rawLengthMeters,
      lengthWithWasteMeters: withWasteLengthMeters,
      wastePercent: rule.wastePercent,
      purchaseQuantity: cuttingPlan.commercialBarsToPurchase,
      totalCommercialLengthMeters: cuttingPlan.totalCommercialLengthMeters,
      totalLeftoverMeters: cuttingPlan.totalLeftoverMeters,
    }),
    technicalPieces,
    cuttingPlan,
    classification,
    explanation: createExplanation({
      title: "Guias por comprimento de parede",
      strategy: rule.strategy,
      summary: `As guias foram separadas por origem e consolidadas em ${unitText(rawLengthMeters, "m")} antes do plano de corte.`,
      subtotals: [
        { label: "Guia inferior", value: unitText(lowerMeters, "m") },
        { label: "Guia superior", value: unitText(upperMeters, "m") },
        { label: "Guias de abertura", value: unitText(openingMeters, "m") },
        { label: "Guias de bloqueadores", value: unitText(blockingMeters, "m") },
        { label: "Vergas", value: unitText(lintelMeters, "m") },
        { label: "Contravergas ou peitoris", value: unitText(sillMeters, "m") },
        { label: "Encontros", value: unitText(junctionMeters, "m") },
        { label: "Adicional manual", value: unitText(rule.parameters.manualTrackMeters, "m") },
      ],
      purchase: [
        { label: "Barras para compra", value: unitText(cuttingPlan.commercialBarsToPurchase, "bar") },
        { label: "Sobra estimada", value: unitText(cuttingPlan.totalLeftoverMeters, "m") },
      ],
    }),
  });
}

function calculateBlocking(
  rule: Extract<SteelFrameEngineRule, { strategy: "BLOCKING_BY_STUD_PATTERN" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;

  const entries: SteelFrameEngineTechnicalPiece[] = [];
  const explanationLines: SteelFrameEngineCalculationExplanation["subtotals"] = [];
  let rawQuantity = 0;

  walls.forEach((wall) => {
    const studPositions = Math.ceil(wall.lengthMeters / rule.parameters.spacingMeters) + 1;
    const cells = Math.max(0, studPositions - 1);
    let perWall = 0;
    switch (rule.parameters.pattern) {
      case "alternate":
        perWall = Math.ceil(cells / 2) * rule.parameters.lines;
        break;
      case "all_cells":
        perWall = cells * rule.parameters.lines;
        break;
      case "fixed_lines":
        perWall = rule.parameters.fixedQuantityPerWall * rule.parameters.lines;
        break;
      case "vertical_interval":
        perWall =
          rule.parameters.verticalIntervalMeters === null
            ? 0
            : Math.ceil(wall.heightMeters / rule.parameters.verticalIntervalMeters) * cells;
        break;
      case "fixed_quantity":
        perWall = rule.parameters.fixedQuantityPerWall;
        break;
      case "manual":
        perWall = rule.parameters.manualQuantityPerWall;
        break;
    }
    rawQuantity += perWall * wall.quantity;
    entries.push({
      id: `blocking:${wall.id}`,
      label: `Bloqueadores - ${wall.label}`,
      quantity: perWall * wall.quantity,
      lengthMeters: rule.parameters.pieceLengthMeters,
      source: `Padrao ${blockingPatternLabels[rule.parameters.pattern]} configurado na regra`,
    });
    explanationLines.push({
      label: wall.label,
      value: `${formatNumber(cells)} celulas e ${formatNumber(perWall * wall.quantity)} bloqueadores`,
    });
  });

  const basePieces = createTechnicalPieces(entries);
  const rawLengthMeters = roundSteelFrameEngineNumber(rawQuantity * rule.parameters.pieceLengthMeters);
  const reservePieces = createWasteReservePieces({
    totalWasteLengthMeters: rawLengthMeters * (rule.wastePercent / 100),
    commercialBars: rule.parameters.commercialStock.commercialBars,
    idPrefix: "blocking:waste",
  });
  const technicalPieces = createTechnicalPieces([...basePieces, ...reservePieces]);
  const cuttingPlan = calculateSteelFrameCuttingPlan({
    pieces: technicalPieces,
    ...rule.parameters.commercialStock,
  });
  const withWasteLengthMeters = roundSteelFrameEngineNumber(
    technicalPieces.reduce((total, piece) => total + piece.quantity * piece.lengthMeters, 0),
  );
  const classification = rule.parameters.pattern === "manual" ? "technical_review_required" : "automatic_eligible";

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createBarQuantityResult({
      rawLengthMeters,
      lengthWithWasteMeters: withWasteLengthMeters,
      wastePercent: rule.wastePercent,
      purchaseQuantity: cuttingPlan.commercialBarsToPurchase,
      totalCommercialLengthMeters: cuttingPlan.totalCommercialLengthMeters,
      totalLeftoverMeters: cuttingPlan.totalLeftoverMeters,
    }),
    technicalPieces,
    cuttingPlan,
    classification,
    explanation: createExplanation({
      title: "Bloqueadores por padrao de montantes",
      strategy: rule.strategy,
      summary: `O padrao ${blockingPatternLabels[rule.parameters.pattern]} produziu ${formatNumber(rawQuantity)} bloqueadores antes da reserva de perda.`,
      parameters: [
        { label: "Espacamento usado para as celulas", value: unitText(rule.parameters.spacingMeters, "m") },
        { label: "Comprimento por bloqueador", value: unitText(rule.parameters.pieceLengthMeters, "m") },
        { label: "Linhas configuradas", value: formatNumber(rule.parameters.lines) },
      ],
      subtotals: explanationLines,
      purchase: [
        { label: "Barras para compra", value: unitText(cuttingPlan.commercialBarsToPurchase, "bar") },
        { label: "Sobra estimada", value: unitText(cuttingPlan.totalLeftoverMeters, "m") },
      ],
    }),
  });
}

function calculateBoard(
  rule: Extract<SteelFrameEngineRule, { strategy: "BOARD_BY_AREA_COEFFICIENT" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;
  const area = getApplicationArea({
    walls,
    openings,
    treatment: rule.parameters.openingTreatment,
    minimumAreaSquareMeters: rule.parameters.openingMinimumAreaSquareMeters,
  });
  const rawBoardQuantity =
    (area.netArea * rule.parameters.faces * rule.parameters.layers) /
    rule.parameters.coverageSquareMetersPerBoard;

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity: rawBoardQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.boardsPerPackage,
    }),
    explanation: createExplanation({
      title: "Placas por area e coeficiente",
      strategy: rule.strategy,
      summary: `A area de aplicacao de ${unitText(area.netArea, "m2")} foi convertida em placas com cobertura configurada.`,
      inputs: [
        { label: "Area bruta", value: unitText(area.grossArea, "m2") },
        { label: "Area de vaos descontada", value: unitText(area.deductedOpeningArea, "m2") },
      ],
      parameters: [
        { label: "Cobertura por placa", value: unitText(rule.parameters.coverageSquareMetersPerBoard, "m2") },
        { label: "Faces", value: formatNumber(rule.parameters.faces) },
        { label: "Camadas", value: formatNumber(rule.parameters.layers) },
      ],
      purchase: [
        {
          label: "Embalagens para compra",
          value: unitText(
            createQuantityResult({
              rawQuantity: rawBoardQuantity,
              technicalUnit: rule.technicalUnit,
              purchaseUnit: rule.purchaseUnit,
              wastePercent: rule.wastePercent,
              capacityPerPurchaseUnit: rule.parameters.boardsPerPackage,
            }).purchase.quantity,
            rule.purchaseUnit,
          ),
        },
      ],
    }),
  });
}

function calculateMembrane(
  rule: Extract<SteelFrameEngineRule, { strategy: "MEMBRANE_BY_AREA" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;
  const area = getApplicationArea({
    walls,
    openings,
    treatment: rule.parameters.openingTreatment,
    minimumAreaSquareMeters: rule.parameters.openingMinimumAreaSquareMeters,
  });
  const rawArea =
    area.netArea *
    rule.parameters.faces *
    rule.parameters.layers *
    (1 + rule.parameters.overlapPercent / 100);

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity: rawArea,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit:
        rule.parameters.coverageSquareMetersPerRoll * rule.parameters.rollsPerPurchaseUnit,
    }),
    explanation: createExplanation({
      title: "Membrana por area",
      strategy: rule.strategy,
      summary: `A membrana considera ${formatNumber(rule.parameters.overlapPercent)}% de sobreposicao antes da perda configurada.`,
      inputs: [{ label: "Area de aplicacao", value: unitText(area.netArea, "m2") }],
      parameters: [
        { label: "Cobertura por rolo", value: unitText(rule.parameters.coverageSquareMetersPerRoll, "m2") },
        { label: "Rolos por compra", value: formatNumber(rule.parameters.rollsPerPurchaseUnit) },
      ],
    }),
  });
}

function calculateInsulation(
  rule: Extract<SteelFrameEngineRule, { strategy: "INSULATION_BY_AREA" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;
  const alerts: SteelFrameEngineAlert[] = [];
  if (rule.parameters.compatibleCavityWidthsMeters.length) {
    walls.forEach((wall) => {
      if (wall.cavityWidthMeters === null) {
        alerts.push({
          code: "CAVITY_WIDTH_MISSING",
          severity: "warning",
          message: `A largura da cavidade da parede ${wall.label} precisa ser confirmada.`,
        });
        return;
      }
      if (!rule.parameters.compatibleCavityWidthsMeters.includes(wall.cavityWidthMeters)) {
        alerts.push({
          code: "INSULATION_CAVITY_INCOMPATIBLE",
          severity: "warning",
          message: `O isolamento nao possui compatibilidade declarada para a cavidade da parede ${wall.label}.`,
        });
      }
    });
  }
  const area = getApplicationArea({
    walls,
    openings,
    treatment: rule.parameters.openingTreatment,
    minimumAreaSquareMeters: rule.parameters.openingMinimumAreaSquareMeters,
  });
  const rawArea = area.netArea * rule.parameters.faces * rule.parameters.layers;
  const incompatible = alerts.length > 0;

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity: rawArea,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.coverageSquareMetersPerPackage,
    }),
    alerts,
    classification: incompatible ? "technical_review_required" : "automatic_eligible",
    explanation: createExplanation({
      title: "Isolamento por area",
      strategy: rule.strategy,
      summary: `O isolamento foi calculado sobre ${unitText(area.netArea, "m2")} de area configurada.`,
      parameters: [
        {
          label: "Cobertura por embalagem",
          value: unitText(rule.parameters.coverageSquareMetersPerPackage, "m2"),
        },
      ],
    }),
  });
}

function calculateFastenerByArea(
  rule: Extract<SteelFrameEngineRule, { strategy: "FASTENER_BY_AREA" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const missingWalls = requiresWalls(rule, walls);
  if (missingWalls) return missingWalls;
  const area = getApplicationArea({
    walls,
    openings,
    treatment: rule.parameters.openingTreatment,
    minimumAreaSquareMeters: rule.parameters.openingMinimumAreaSquareMeters,
  });
  const rawQuantity = area.netArea * rule.parameters.unitsPerSquareMeter;

  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.unitsPerBox,
    }),
    explanation: createExplanation({
      title: "Fixadores por area",
      strategy: rule.strategy,
      summary: `O consumo foi aplicado sobre ${unitText(area.netArea, "m2")} de area.`,
      parameters: [
        { label: "Consumo", value: `${formatNumber(rule.parameters.unitsPerSquareMeter)} por m2` },
        { label: "Unidades por caixa", value: formatNumber(rule.parameters.unitsPerBox) },
      ],
    }),
  });
}

function calculateFastenerByBoard(
  rule: Extract<SteelFrameEngineRule, { strategy: "FASTENER_BY_BOARD" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const rawQuantity = rule.parameters.boardQuantity * rule.parameters.unitsPerBoard;
  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.unitsPerBox,
    }),
    explanation: createExplanation({
      title: "Fixadores por placa",
      strategy: rule.strategy,
      summary: `Foram considerados ${formatNumber(rule.parameters.boardQuantity)} placas e ${formatNumber(rule.parameters.unitsPerBoard)} fixadores por placa.`,
    }),
  });
}

function calculateFixedPerOpening(
  rule: Extract<SteelFrameEngineRule, { strategy: "FIXED_PER_OPENING" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const openingCount = openings.reduce((total, opening) => total + opening.quantity, 0);
  const rawQuantity = openingCount * rule.parameters.unitsPerOpening;
  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.unitsPerPurchaseUnit,
    }),
    explanation: createExplanation({
      title: "Item fixo por abertura",
      strategy: rule.strategy,
      summary: `Foram consideradas ${formatNumber(openingCount)} aberturas no escopo da regra.`,
    }),
  });
}

function calculateFixedPerProject(
  rule: Extract<SteelFrameEngineRule, { strategy: "FIXED_PER_PROJECT" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const rawQuantity = context.projectCount * rule.parameters.unitsPerProject;
  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.unitsPerPurchaseUnit,
    }),
    explanation: createExplanation({
      title: "Item fixo por projeto",
      strategy: rule.strategy,
      summary: `Foram considerados ${formatNumber(context.projectCount)} projeto(s) no escopo.`,
    }),
  });
}

function calculateManual(
  rule: Extract<SteelFrameEngineRule, { strategy: "MANUAL" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity: rule.parameters.technicalQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.unitsPerPurchaseUnit,
    }),
    classification: "technical_review_required",
    explanation: createExplanation({
      title: "Quantidade manual",
      strategy: rule.strategy,
      summary: "A quantidade foi informada manualmente e permanece sujeita a revisao tecnica.",
      parameters: [{ label: "Justificativa", value: rule.parameters.justification }],
    }),
  });
}

function calculateCuttingStock(
  rule: Extract<SteelFrameEngineRule, { strategy: "CUTTING_STOCK_OPTIMIZATION" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  const cuttingPlan = calculateSteelFrameCuttingPlan({
    pieces: rule.parameters.pieces,
    commercialBars: rule.parameters.commercialBars,
    kerfMeters: rule.parameters.kerfMeters,
    reusableLeftovers: rule.parameters.reusableLeftovers,
    minimumReusableLeftoverMeters: rule.parameters.minimumReusableLeftoverMeters,
  });
  const rawLengthMeters = cuttingPlan.totalRequiredPieceLengthMeters;
  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createBarQuantityResult({
      rawLengthMeters,
      lengthWithWasteMeters: rawLengthMeters,
      wastePercent: rule.wastePercent,
      purchaseQuantity: cuttingPlan.commercialBarsToPurchase,
      totalCommercialLengthMeters: cuttingPlan.totalCommercialLengthMeters,
      totalLeftoverMeters: cuttingPlan.totalLeftoverMeters,
    }),
    technicalPieces: rule.parameters.pieces,
    cuttingPlan,
    explanation: createExplanation({
      title: "Otimizacao de corte",
      strategy: rule.strategy,
      summary: `O plano usa ${formatNumber(cuttingPlan.commercialBarsToPurchase)} barras comerciais e preserva ${unitText(cuttingPlan.totalLeftoverMeters, "m")} de sobra.`,
      purchase: [
        { label: "Perda de corte", value: unitText(cuttingPlan.totalKerfLossMeters, "m") },
        { label: "Aproveitamento", value: `${formatNumber(cuttingPlan.utilizationPercent)}%` },
      ],
    }),
  });
}

function calculatePackagingRounding(
  rule: Extract<SteelFrameEngineRule, { strategy: "PACKAGING_ROUNDING" }>,
  context: ParsedContext,
  walls: SteelFrameEngineWall[],
  openings: ParsedContext["openings"],
): SteelFrameEngineCalculationResult {
  return buildResult({
    rule,
    context,
    walls,
    openings,
    quantities: createQuantityResult({
      rawQuantity: rule.parameters.technicalQuantity,
      technicalUnit: rule.technicalUnit,
      purchaseUnit: rule.purchaseUnit,
      wastePercent: rule.wastePercent,
      capacityPerPurchaseUnit: rule.parameters.unitsPerPurchaseUnit,
    }),
    explanation: createExplanation({
      title: "Arredondamento de embalagem",
      strategy: rule.strategy,
      summary: "A compra foi arredondada para cima para cobrir toda a necessidade tecnica declarada.",
    }),
  });
}

function calculateParsedRequest(
  request: SteelFrameEngineCalculationRequest,
): SteelFrameEngineCalculationResult {
  const { rule, context } = request;
  const unitAlert = validateDeclaredUnits(rule);
  if (unitAlert) {
    const result = createBlockedResult(unitAlert.message);
    return {
      ...result,
      strategy: rule.strategy,
      rule: buildRuleSnapshot(rule),
      alerts: [unitAlert],
    };
  }

  const walls = selectedWalls(rule, context);
  const openings = selectedOpenings(rule, context, walls);

  switch (rule.strategy) {
    case "STUD_BY_SPACING":
      return calculateStuds(rule, context, walls, openings);
    case "TRACK_BY_WALL_LENGTH":
      return calculateTracks(rule, context, walls, openings);
    case "BLOCKING_BY_STUD_PATTERN":
      return calculateBlocking(rule, context, walls, openings);
    case "BOARD_BY_AREA_COEFFICIENT":
      return calculateBoard(rule, context, walls, openings);
    case "MEMBRANE_BY_AREA":
      return calculateMembrane(rule, context, walls, openings);
    case "INSULATION_BY_AREA":
      return calculateInsulation(rule, context, walls, openings);
    case "FASTENER_BY_AREA":
      return calculateFastenerByArea(rule, context, walls, openings);
    case "FASTENER_BY_BOARD":
      return calculateFastenerByBoard(rule, context, walls, openings);
    case "FIXED_PER_OPENING":
      return calculateFixedPerOpening(rule, context, walls, openings);
    case "FIXED_PER_PROJECT":
      return calculateFixedPerProject(rule, context, walls, openings);
    case "MANUAL":
      return calculateManual(rule, context, walls, openings);
    case "CUTTING_STOCK_OPTIMIZATION":
      return calculateCuttingStock(rule, context, walls, openings);
    case "PACKAGING_ROUNDING":
      return calculatePackagingRounding(rule, context, walls, openings);
  }
}

export function calculateSteelFrameEngineRule(input: unknown): SteelFrameEngineCalculationResult {
  const parsed = steelFrameEngineCalculationRequestSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return createBlockedResult(firstIssue?.message ?? "A regra de calculo e invalida.");
  }

  try {
    return calculateParsedRequest(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao calcular a regra tecnica.";
    const result = createBlockedResult(message);
    return {
      ...result,
      strategy: parsed.data.rule.strategy,
      rule: buildRuleSnapshot(parsed.data.rule),
    };
  }
}

export function calculateSteelFrameEngineBatch(input: unknown[]): SteelFrameEngineCalculationResult[] {
  return input.map(calculateSteelFrameEngineRule);
}

export function isSteelFrameEngineResultApprovedForAutomaticUse(
  result: SteelFrameEngineCalculationResult,
): boolean {
  return result.classification === "automatic_eligible";
}

export function getSteelFrameEngineTechnicalStatusSummary(
  results: SteelFrameEngineCalculationResult[],
): SteelFrameEngineTechnicalStatus {
  return results.reduce<SteelFrameEngineTechnicalStatus>(
    (status, result) => highestClassification(status, result.classification),
    "automatic_eligible",
  );
}

export function createSteelFrameEngineContext(
  context: Partial<SteelFrameEngineCalculationContext>,
): SteelFrameEngineCalculationContext {
  return {
    projectCount: context.projectCount ?? 1,
    walls: context.walls ?? [],
    openings: context.openings ?? [],
    junctions: context.junctions ?? [],
    composition: context.composition ?? null,
    missingInformation: context.missingInformation ?? [],
  };
}
