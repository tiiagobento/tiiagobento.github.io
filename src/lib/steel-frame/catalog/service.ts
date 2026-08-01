import type { SteelFrameEngineRule } from "../engine";
import {
  buildEngineRuleCandidate,
  steelFrameCatalogMaterialPriceSchema,
  steelFrameCatalogRuleDraftSchema,
  validateSteelFrameCatalogRuleEngineContract,
} from "./schemas";
import type {
  SteelFrameCatalogCompatibility,
  SteelFrameCatalogCompatibilityValidation,
  SteelFrameCatalogMaterialPrice,
  SteelFrameCatalogPriceSelection,
  SteelFrameCatalogRuleDraft,
  SteelFrameCatalogRuleValidation,
  SteelFrameCatalogSelection,
  SteelFrameCatalogSnapshot,
  SteelFrameCatalogSnapshotInput,
} from "./types";

function issuePath(path: PropertyKey[]) {
  return path.map(String).join(".") || "form";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function compareNewest(left: SteelFrameCatalogMaterialPrice, right: SteelFrameCatalogMaterialPrice) {
  return right.effectiveFrom.localeCompare(left.effectiveFrom)
    || right.createdAt.localeCompare(left.createdAt)
    || left.id.localeCompare(right.id);
}

function isPriceValidOn(price: SteelFrameCatalogMaterialPrice, asOf: string) {
  return price.effectiveFrom <= asOf && (!price.effectiveTo || price.effectiveTo >= asOf);
}

function selectionMatches(
  selection: SteelFrameCatalogSelection,
  materialId: string | null,
  materialVariantId: string | null,
) {
  if (materialVariantId && selection.materialVariantId === materialVariantId) return true;
  return Boolean(materialId && selection.materialId === materialId);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function stableCatalogSnapshotJson(snapshot: SteelFrameCatalogSnapshot) {
  return JSON.stringify(stableValue(snapshot));
}

export async function sha256CatalogSnapshot(snapshot: SteelFrameCatalogSnapshot) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto nao esta disponivel para assinar o snapshot do catalogo.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableCatalogSnapshotJson(snapshot)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateSteelFrameCatalogRule(value: unknown): SteelFrameCatalogRuleValidation {
  const parsed = steelFrameCatalogRuleDraftSchema.safeParse(value);
  if (!parsed.success) {
    return {
      rule: null,
      engineRule: null,
      errors: parsed.error.issues.map((issue) => ({ path: issuePath(issue.path), message: issue.message })),
    };
  }

  const errors: Array<{ path: string; message: string }> = [];
  const engineResult = validateSteelFrameCatalogRuleEngineContract(parsed.data);
  if (!engineResult.success) {
    errors.push(
      ...engineResult.error.issues.map((issue) => ({
        path: issuePath(issue.path),
        message: `${issuePath(issue.path)}: ${issue.message}`,
      })),
    );
  }

  if (parsed.data.status === "approved") {
    if (!parsed.data.source.sourceId || !parsed.data.source.sourceDocumentId) {
      errors.push({ path: "source", message: "Uma regra aprovada precisa de fonte e documento tecnico de origem." });
    }
    if (!parsed.data.technicalResponsibleName || !parsed.data.technicalResponsibleRegistration) {
      errors.push({ path: "technicalResponsibleName", message: "Informe responsavel tecnico e registro antes de aprovar." });
    }
    if (!parsed.data.effectiveFrom) {
      errors.push({ path: "effectiveFrom", message: "Informe a vigencia da regra antes de aprovar." });
    }
  }

  return {
    rule: parsed.data,
    engineRule: engineResult.success ? engineResult.data : null,
    errors: unique(errors.map((error) => `${error.path}|${error.message}`)).map((value) => {
      const [path, ...message] = value.split("|");
      return { path, message: message.join("|") };
    }),
  };
}

export function toEngineRuleForCalculation(
  value: unknown,
  options: { allowPreliminary?: boolean } = {},
): SteelFrameEngineRule {
  const validation = validateSteelFrameCatalogRule(value);
  if (!validation.rule || !validation.engineRule || validation.errors.length) {
    throw new Error(validation.errors.map((error) => error.message).join(" ") || "Regra tecnica invalida.");
  }
  if (validation.rule.status !== "approved" && !options.allowPreliminary) {
    throw new Error("Somente regras tecnicas aprovadas podem alimentar um calculo final.");
  }
  return validation.engineRule as SteelFrameEngineRule;
}

export function selectSteelFrameCatalogPrice(
  priceCandidates: unknown[],
  asOf = new Date().toISOString().slice(0, 10),
): SteelFrameCatalogPriceSelection {
  const valid = priceCandidates
    .map((candidate) => steelFrameCatalogMaterialPriceSchema.safeParse(candidate))
    .filter((result): result is { success: true; data: SteelFrameCatalogMaterialPrice } => result.success)
    .map((result) => result.data)
    .filter((price) => isPriceValidOn(price, asOf));

  const pickNewest = (prices: SteelFrameCatalogMaterialPrice[]) => [...prices].sort(compareNewest)[0] ?? null;
  const manual = pickNewest(valid.filter((price) => price.isManualOverride));
  if (manual) {
    return { price: manual, selectionReason: "manual_override", alerts: [] };
  }

  const preferred = pickNewest(valid.filter((price) => price.preferred && price.eligibleForAutomaticSelection));
  if (preferred) {
    return { price: preferred, selectionReason: "preferred_vendor", alerts: [] };
  }

  const eligible = valid.filter((price) => price.eligibleForAutomaticSelection);
  if (eligible.length) {
    const lowest = [...eligible].sort((left, right) =>
      left.unitCost - right.unitCost || compareNewest(left, right),
    )[0]!;
    return { price: lowest, selectionReason: "lowest_valid_price", alerts: [] };
  }

  const newest = pickNewest(valid);
  if (newest) {
    return {
      price: newest,
      selectionReason: "newest_valid_price",
      alerts: ["Nenhum preco esta liberado para selecao automatica; foi usado o valor valido mais recente para revisao."],
    };
  }

  return {
    price: null,
    selectionReason: "missing_price",
    alerts: ["Nao ha preco valido para este material na data do calculo."],
  };
}

export function validateSteelFrameCatalogCompatibility(
  selections: SteelFrameCatalogSelection[],
  compatibilityRules: SteelFrameCatalogCompatibility[],
): SteelFrameCatalogCompatibilityValidation {
  const activeRules = compatibilityRules.filter((rule) => rule.status === "approved");
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of activeRules) {
    const sourceIsSelected = selections.some((selection) =>
      selectionMatches(selection, rule.sourceMaterialId, rule.sourceMaterialVariantId),
    );
    if (!sourceIsSelected) continue;

    const relatedIsSelected = selections.some((selection) =>
      selectionMatches(selection, rule.relatedMaterialId, rule.relatedMaterialVariantId),
    );
    if (rule.relationshipType === "requires" && !relatedIsSelected) {
      errors.push(`A compatibilidade ${rule.id} exige um componente relacionado que nao foi selecionado.`);
    }
    if (rule.relationshipType === "excludes" && relatedIsSelected) {
      errors.push(`A compatibilidade ${rule.id} bloqueia a combinacao de materiais selecionada.`);
    }
    if (rule.relationshipType === "replaces" && relatedIsSelected) {
      warnings.push(`A compatibilidade ${rule.id} indica uma substituicao que precisa de revisao comercial.`);
    }
  }

  return { errors: unique(errors), warnings: unique(warnings) };
}

export function buildSteelFrameCatalogSnapshot(input: SteelFrameCatalogSnapshotInput): SteelFrameCatalogSnapshot {
  const rules = input.rules
    .map((rule) => ({
      id: rule.id,
      code: rule.code,
      version: rule.version,
      strategyType: rule.strategyType,
      status: rule.status === "superseded" ? "deprecated" : rule.status,
      sourceId: rule.source.sourceId,
      sourceDocumentId: rule.source.sourceDocumentId,
      parameters: rule.parameters,
      limits: rule.limits,
    }))
    .sort((left, right) => left.code.localeCompare(right.code) || left.version.localeCompare(right.version) || left.id.localeCompare(right.id));

  const selectedPrices = input.selectedPrices
    .map((selection) => ({
      priceId: selection.price?.id ?? null,
      selectionReason: selection.selectionReason,
      unitCost: selection.price?.unitCost ?? null,
      currency: selection.price?.currency ?? null,
    }))
    .sort((left, right) => (left.priceId ?? "").localeCompare(right.priceId ?? ""));

  return {
    schemaVersion: 1,
    estimateId: input.estimateId,
    estimateVersionId: input.estimateVersionId,
    scenarioId: input.scenarioId,
    rules,
    selectedPrices,
    selectedMaterialIds: [...input.selectedMaterialIds].sort(),
    selectedMaterialVariantIds: [...input.selectedMaterialVariantIds].sort(),
  };
}

export function createEngineRuleCandidate(value: SteelFrameCatalogRuleDraft) {
  return buildEngineRuleCandidate(value);
}
