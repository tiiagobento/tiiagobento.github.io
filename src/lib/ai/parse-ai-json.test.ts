// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseAIJsonResponse, parseAILeadAnalysisResponse } from "@/lib/ai/parse-ai-json";

const validAnalysis = {
  leads: [
    {
      name: "Solange",
      phone: "554884616671",
      city: "Biguacu",
      neighborhood: "Deltaville",
      source: "WhatsApp",
      project_type: "Casa em steel frame",
      interest_type: "Visita",
      has_land: true,
      has_blueprint: null,
      urgency: "Quer visita",
      notes: "Lead interessado em steel frame.",
      status: "Visita a marcar",
      priority: "Alta",
      next_step: "Agendar visita",
      lead_score: 82,
    },
  ],
  summary: "Lead quente com pedido de visita.",
  warnings: [],
};

describe("parseAIJsonResponse", () => {
  it("parses valid JSON", () => {
    expect(parseAIJsonResponse(JSON.stringify(validAnalysis))).toEqual(validAnalysis);
  });

  it("extracts JSON from markdown fences", () => {
    expect(parseAIJsonResponse(`\`\`\`json\n${JSON.stringify(validAnalysis)}\n\`\`\``)).toEqual(validAnalysis);
  });

  it("extracts the first balanced JSON object from extra text", () => {
    expect(parseAIJsonResponse(`resultado:\n${JSON.stringify(validAnalysis)}\nobrigado`)).toEqual(validAnalysis);
  });

  it("throws a friendly error for invalid JSON", () => {
    expect(() => parseAIJsonResponse("sem json aqui")).toThrow("A IA respondeu em um formato invalido. Tente novamente.");
  });
});

describe("parseAILeadAnalysisResponse", () => {
  it("validates lead analysis schema", () => {
    expect(parseAILeadAnalysisResponse({ text: JSON.stringify(validAnalysis) })).toEqual(validAnalysis);
  });
});
