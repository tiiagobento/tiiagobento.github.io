import { steelFrameTechnicalLimitsSchema } from "./schemas";
import type {
  SteelFrameEstimateRecord,
  SteelFrameOpeningRecord,
  SteelFrameTechnicalAssessmentResult,
  SteelFrameTechnicalClassification,
  SteelFrameTechnicalCompositionRecord,
  SteelFrameTechnicalFinding,
  SteelFrameTechnicalLimits,
  SteelFrameTechnicalRuleRecord,
  SteelFrameTechnicalValidationContext,
  SteelFrameWallSegmentRecord,
} from "./types";

type TechnicalAssessmentInput = {
  estimate: Pick<SteelFrameEstimateRecord, "standard_wall_height_meters" | "expected_floors">;
  walls: Array<Pick<SteelFrameWallSegmentRecord, "height_meters" | "confirmation_status">>;
  openings: Array<Pick<SteelFrameOpeningRecord, "width_meters" | "confirmation_status">>;
  composition: SteelFrameTechnicalCompositionRecord | null;
  context: SteelFrameTechnicalValidationContext;
  geometryWarnings?: string[];
};

function asLimits(value: unknown): SteelFrameTechnicalLimits {
  const parsed = steelFrameTechnicalLimitsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

function numberValues(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function minimumLimit(values: Array<number | null | undefined>) {
  const validValues = numberValues(values);
  return validValues.length ? Math.min(...validValues) : null;
}

function resolveAllowedSpacing(limits: SteelFrameTechnicalLimits[]) {
  const groups = limits
    .map((limit) => limit.allowedStudSpacingMeters?.filter((value) => Number.isFinite(value) && value > 0) ?? [])
    .filter((group) => group.length > 0);
  if (!groups.length) return [];
  return groups[0].filter((spacing) => groups.every((group) => group.some((value) => Math.abs(value - spacing) < 0.001)));
}

function hasExplicitBoolean(limits: SteelFrameTechnicalLimits[], key: keyof SteelFrameTechnicalLimits) {
  return limits.some((limit) => typeof limit[key] === "boolean");
}

function isRequired(limits: SteelFrameTechnicalLimits[], key: keyof SteelFrameTechnicalLimits) {
  return limits.some((limit) => limit[key] === true);
}

function isEffectiveToday(row: { effective_from: string | null; effective_to: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  return Boolean(row.effective_from && row.effective_from <= today && (!row.effective_to || row.effective_to >= today));
}

function classificationSummary(classification: SteelFrameTechnicalClassification) {
  switch (classification) {
    case "automatic":
      return "ORCAMENTO AUTOMATICO: a geometria informada esta dentro do modelo tecnico aprovado selecionado.";
    case "technical_review_required":
      return "REVISAO TECNICA OBRIGATORIA: ha limite excedido, conflito tecnico ou condicao que exige validacao do responsavel tecnico.";
    default:
      return "ORCAMENTO PRELIMINAR: faltam confirmacoes ou um modelo tecnico aprovado completo para liberar a classificacao automatica.";
  }
}

function ruleSnapshot(rules: SteelFrameTechnicalRuleRecord[]) {
  return rules.map((rule) => ({
    id: rule.id,
    code: rule.code,
    version: rule.version,
    name: rule.name,
    origin: rule.origin,
    referenceName: rule.reference_name,
    referenceVersion: rule.reference_version,
    status: rule.status,
  }));
}

function addFinding(findings: SteelFrameTechnicalFinding[], severity: SteelFrameTechnicalFinding["severity"], code: string, message: string) {
  findings.push({ severity, code, message });
}

function addMissing(missingInformation: string[], message: string) {
  if (!missingInformation.includes(message)) missingInformation.push(message);
}

// This validator is deliberately conservative: it checks only explicit, approved
// constraints. It does not derive structural sizing from a standard or from AI.
export function assessSteelFrameTechnicalComposition({
  estimate,
  walls,
  openings,
  composition,
  context,
  geometryWarnings = [],
}: TechnicalAssessmentInput): SteelFrameTechnicalAssessmentResult {
  const findings: SteelFrameTechnicalFinding[] = [];
  const missingInformation: string[] = [];
  const linkedRules = composition?.rules
    ?.map((link) => link.rule)
    .filter((rule): rule is SteelFrameTechnicalRuleRecord => Boolean(rule)) ?? [];

  if (!composition) {
    addMissing(missingInformation, "Selecione uma composicao tecnica aprovada.");
    return {
      classification: "preliminary",
      summary: classificationSummary("preliminary"),
      findings,
      missingInformation,
      ruleSnapshot: [],
    };
  }

  if (composition.status !== "approved") {
    addMissing(missingInformation, "A composicao selecionada ainda nao esta aprovada.");
  }
  if (!composition.profile_specification?.trim()) {
    addMissing(missingInformation, "O modelo aprovado nao declara a especificacao de perfil.");
  }
  if (!composition.technical_responsible_name?.trim() || !composition.technical_responsible_registration?.trim()) {
    addMissing(missingInformation, "O modelo aprovado nao identifica responsavel tecnico e registro profissional.");
  }
  if (!isEffectiveToday(composition)) {
    addMissing(missingInformation, "A composicao selecionada nao possui vigencia ativa para esta data.");
  }
  if (!linkedRules.length) {
    addMissing(missingInformation, "Vincule pelo menos uma regra tecnica aprovada a composicao.");
  }
  const unapprovedRules = linkedRules.filter((rule) => rule.status !== "approved");
  if (unapprovedRules.length) {
    addMissing(missingInformation, "Todas as regras vinculadas precisam estar aprovadas e vigentes.");
  }
  if (linkedRules.some((rule) => !isEffectiveToday(rule))) {
    addMissing(missingInformation, "Todas as regras vinculadas precisam estar aprovadas e vigentes.");
  }

  const limits = [asLimits(composition.limits), ...linkedRules.map((rule) => asLimits(rule.limits))];
  const maximumWallHeight = minimumLimit(limits.map((limit) => limit.maxWallHeightMeters));
  const maximumFloors = minimumLimit(limits.map((limit) => limit.maxFloors));
  const maximumOpeningWidth = minimumLimit(limits.map((limit) => limit.maxOpeningWidthMeters));
  const allowedSpacing = resolveAllowedSpacing(limits);
  const hasSpacingConflict = limits.some((limit) => (limit.allowedStudSpacingMeters?.length ?? 0) > 0) && !allowedSpacing.length;

  if (maximumWallHeight === null) addMissing(missingInformation, "O modelo aprovado nao declara a altura maxima permitida.");
  if (maximumFloors === null) addMissing(missingInformation, "O modelo aprovado nao declara a quantidade maxima de pavimentos.");
  if (maximumOpeningWidth === null) addMissing(missingInformation, "O modelo aprovado nao declara a largura maxima de abertura.");
  if (!allowedSpacing.length && !hasSpacingConflict) addMissing(missingInformation, "O modelo aprovado nao declara os espacamentos permitidos.");
  if (!hasExplicitBoolean(limits, "requiresWindValidation")) addMissing(missingInformation, "O modelo aprovado nao declara a condicao de validacao de vento.");
  if (!hasExplicitBoolean(limits, "requiresRoofReview")) addMissing(missingInformation, "O modelo aprovado nao declara a condicao de cobertura.");
  if (!hasExplicitBoolean(limits, "requiresTechnicalReview")) addMissing(missingInformation, "O modelo aprovado nao declara se exige revisao tecnica obrigatoria.");

  if (!walls.length) addMissing(missingInformation, "Adicione ao menos um trecho de parede confirmado.");
  if (walls.some((wall) => wall.confirmation_status !== "confirmed")) addMissing(missingInformation, "Confirme as medidas dos trechos de parede.");
  if (openings.some((opening) => opening.confirmation_status !== "confirmed")) addMissing(missingInformation, "Confirme as medidas das aberturas.");
  if (context.wallUse === "unknown") addMissing(missingInformation, "Informe se a parede e estrutural ou de vedacao.");
  if (context.studSpacingMeters === null || context.studSpacingMeters <= 0) addMissing(missingInformation, "Informe o espacamento entre montantes confirmado no modelo.");
  if (context.windValidation === "unknown") addMissing(missingInformation, "Informe a situacao da validacao de vento.");
  if (context.roofComplexity === "unknown") addMissing(missingInformation, "Informe a condicao da cobertura.");

  const confirmedWallHeights = numberValues(walls.map((wall) => Number(wall.height_meters)));
  const maximumObservedWallHeight = confirmedWallHeights.length
    ? Math.max(...confirmedWallHeights)
    : Number(estimate.standard_wall_height_meters) || null;
  const expectedFloors = estimate.expected_floors;
  const maximumObservedOpeningWidth = Math.max(0, ...numberValues(openings.map((opening) => Number(opening.width_meters))));
  const critical = () => true;

  if (hasSpacingConflict) {
    addFinding(findings, "critical", "conflicting_stud_spacing", "As regras aprovadas vinculadas possuem espacamentos compativeis em conflito.");
  }
  if (maximumWallHeight !== null && maximumObservedWallHeight !== null && maximumObservedWallHeight > maximumWallHeight) {
    addFinding(findings, "critical", "wall_height_limit", `A maior altura informada (${maximumObservedWallHeight} m) excede o limite aprovado (${maximumWallHeight} m).`);
  }
  if (expectedFloors === null || expectedFloors === undefined) {
    addMissing(missingInformation, "Informe a quantidade de pavimentos prevista.");
  } else if (maximumFloors !== null && expectedFloors > maximumFloors) {
    addFinding(findings, "critical", "floors_limit", `A quantidade de pavimentos (${expectedFloors}) excede o limite aprovado (${maximumFloors}).`);
  }
  if (maximumOpeningWidth !== null && maximumObservedOpeningWidth > maximumOpeningWidth) {
    addFinding(findings, "critical", "opening_width_limit", `A maior abertura informada (${maximumObservedOpeningWidth} m) excede o limite aprovado (${maximumOpeningWidth} m).`);
  }
  if (context.studSpacingMeters !== null && allowedSpacing.length && !allowedSpacing.some((spacing) => Math.abs(spacing - context.studSpacingMeters!) < 0.001)) {
    addFinding(findings, "critical", "stud_spacing_limit", `O espacamento informado (${context.studSpacingMeters} m) nao consta entre os espacamentos aprovados.`);
  }
  if (context.wallUse === "structural" && composition.application_type === "non_structural") {
    addFinding(findings, "critical", "application_type", "Uma parede estrutural nao pode usar uma composicao aprovada apenas para vedacao.");
  }
  if (context.wallUse === "non_structural" && composition.application_type === "structural") {
    addMissing(missingInformation, "Confirme com o responsavel tecnico se a composicao estrutural se aplica a esta vedacao.");
  }
  if (isRequired(limits, "requiresWindValidation") && context.windValidation !== "confirmed") {
    addFinding(findings, "critical", "wind_validation", "O modelo exige validacao de vento confirmada antes da liberacao automatica.");
  }
  if (isRequired(limits, "requiresRoofReview") && context.roofComplexity === "complex") {
    addFinding(findings, "critical", "roof_review", "A cobertura complexa exige revisao tecnica para esta composicao.");
  }
  if (isRequired(limits, "requiresTechnicalReview")) {
    addFinding(findings, "critical", "mandatory_review", "A composicao aprovada exige revisao tecnica para qualquer aplicacao.");
  }
  for (const warning of geometryWarnings) {
    addFinding(findings, "critical", "geometry_warning", warning);
  }

  const classification: SteelFrameTechnicalClassification = findings.some((finding) => finding.severity === "critical" && critical())
    ? "technical_review_required"
    : missingInformation.length
      ? "preliminary"
      : "automatic";

  return {
    classification,
    summary: classificationSummary(classification),
    findings,
    missingInformation,
    ruleSnapshot: ruleSnapshot(linkedRules),
  };
}
