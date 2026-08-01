import { describe, expect, it } from "vitest";
import { assessSteelFrameTechnicalComposition } from "./technical-rules";
import type {
  SteelFrameTechnicalCompositionRecord,
  SteelFrameTechnicalRuleRecord,
} from "./types";

function makeRule(overrides: Partial<SteelFrameTechnicalRuleRecord> = {}): SteelFrameTechnicalRuleRecord {
  return {
    id: "rule-1",
    created_by: "user-1",
    code: "NF-RULE-001",
    version: "1.0",
    name: "Limites aprovados da parede",
    rule_type: "validation",
    origin: "company",
    reference_name: "Memorial tecnico aprovado",
    reference_version: "1.0",
    permitted_use: "Parede externa estrutural",
    application_scope: {},
    conditions: {},
    parameters: {},
    limits: {},
    technical_responsible_name: "Responsavel tecnico",
    technical_responsible_registration: "CREA 000000",
    status: "approved",
    approved_by: "admin-1",
    approved_at: "2026-07-31T12:00:00.000Z",
    approval_notes: null,
    effective_from: "2026-07-01",
    effective_to: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

function makeComposition(overrides: Partial<SteelFrameTechnicalCompositionRecord> = {}): SteelFrameTechnicalCompositionRecord {
  const rule = makeRule();
  return {
    id: "composition-1",
    created_by: "user-1",
    code: "NF-WALL-001",
    version: "1.0",
    name: "Parede externa estrutural",
    application_type: "structural",
    profile_specification: "Conforme memorial aprovado",
    description: null,
    permitted_use: "Residencias dentro dos limites declarados",
    application_scope: {},
    conditions: {},
    limits: {
      maxWallHeightMeters: 3,
      maxFloors: 1,
      allowedStudSpacingMeters: [0.4],
      maxOpeningWidthMeters: 1.2,
      requiresWindValidation: true,
      requiresRoofReview: false,
      requiresTechnicalReview: false,
    },
    technical_responsible_name: "Responsavel tecnico",
    technical_responsible_registration: "CREA 000000",
    status: "approved",
    approved_by: "admin-1",
    approved_at: "2026-07-31T12:00:00.000Z",
    approval_notes: null,
    effective_from: "2026-07-01",
    effective_to: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    rules: [{ id: "link-1", composition_id: "composition-1", rule_id: rule.id, sort_order: 0, created_at: "2026-07-01T12:00:00.000Z", rule }],
    ...overrides,
  };
}

const baseInput = {
  estimate: { standard_wall_height_meters: 2.8, expected_floors: 1 },
  walls: [{ height_meters: 2.8, confirmation_status: "confirmed" as const }],
  openings: [{ width_meters: 0.9, confirmation_status: "confirmed" as const }],
  context: {
    wallUse: "structural" as const,
    studSpacingMeters: 0.4,
    windValidation: "confirmed" as const,
    roofComplexity: "simple" as const,
  },
};

describe("technical estimate validation", () => {
  it("keeps the estimate preliminary when no approved technical model was selected", () => {
    const result = assessSteelFrameTechnicalComposition({ ...baseInput, composition: null });

    expect(result.classification).toBe("preliminary");
    expect(result.missingInformation).toContain("Selecione uma composicao tecnica aprovada.");
  });

  it("only marks an estimate automatic when all approved limits and conditions are present", () => {
    const result = assessSteelFrameTechnicalComposition({ ...baseInput, composition: makeComposition() });

    expect(result.classification).toBe("automatic");
    expect(result.ruleSnapshot).toHaveLength(1);
    expect(result.summary).toContain("ORCAMENTO AUTOMATICO");
  });

  it("does not assume a 40 cm spacing when the submitted spacing was not confirmed", () => {
    const result = assessSteelFrameTechnicalComposition({
      ...baseInput,
      composition: makeComposition(),
      context: { ...baseInput.context, studSpacingMeters: null },
    });

    expect(result.classification).toBe("preliminary");
    expect(result.missingInformation).toContain("Informe o espacamento entre montantes confirmado no modelo.");
  });

  it("requires technical review when an approved limit is exceeded", () => {
    const result = assessSteelFrameTechnicalComposition({
      ...baseInput,
      composition: makeComposition(),
      walls: [{ height_meters: 3.2, confirmation_status: "confirmed" }],
    });

    expect(result.classification).toBe("technical_review_required");
    expect(result.findings.some((finding) => finding.code === "wall_height_limit")).toBe(true);
  });

  it("does not release a composition linked to an unapproved rule", () => {
    const result = assessSteelFrameTechnicalComposition({
      ...baseInput,
      composition: makeComposition({
        rules: [{
          id: "link-1",
          composition_id: "composition-1",
          rule_id: "rule-1",
          sort_order: 0,
          created_at: "2026-07-01T12:00:00.000Z",
          rule: makeRule({ status: "draft" }),
        }],
      }),
    });

    expect(result.classification).toBe("preliminary");
    expect(result.missingInformation).toContain("Todas as regras vinculadas precisam estar aprovadas e vigentes.");
  });

  it("keeps an expired approved composition out of automatic classification", () => {
    const result = assessSteelFrameTechnicalComposition({
      ...baseInput,
      composition: makeComposition({ effective_to: "2026-07-01" }),
    });

    expect(result.classification).toBe("preliminary");
    expect(result.missingInformation).toContain("A composicao selecionada nao possui vigencia ativa para esta data.");
  });
});
