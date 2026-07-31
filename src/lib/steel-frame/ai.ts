import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value ?? null);
const confidence = z.number().finite().min(0).max(1);

export const steelFrameAIEvidenceSchema = z.object({
  document_index: z.number().int().min(1).max(3).nullable().optional().transform((value) => value ?? null),
  page_number: z.number().int().positive().nullable().optional().transform((value) => value ?? null),
  source_text: nullableText(1000),
  bounding_box: z.object({
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }).nullable().optional().transform((value) => value ?? null),
});

const extractedWallSchema = z.object({
  label: z.string().trim().min(1).max(160),
  length_meters: z.number().finite().positive().max(1000).nullable().optional().transform((value) => value ?? null),
  height_meters: z.number().finite().positive().max(20).nullable().optional().transform((value) => value ?? null),
  quantity: z.number().int().positive().max(10000).nullable().optional().transform((value) => value ?? null),
  confidence,
  evidence: steelFrameAIEvidenceSchema,
});

const extractedOpeningSchema = z.object({
  label: z.string().trim().min(1).max(160),
  opening_type: z.enum(["door", "window", "garage", "opening", "other"]).default("other"),
  width_meters: z.number().finite().positive().max(50).nullable().optional().transform((value) => value ?? null),
  height_meters: z.number().finite().positive().max(20).nullable().optional().transform((value) => value ?? null),
  quantity: z.number().int().positive().max(10000).nullable().optional().transform((value) => value ?? null),
  wall_label: nullableText(160),
  confidence,
  evidence: steelFrameAIEvidenceSchema,
});

export const steelFrameDocumentAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(8000),
  estimate: z.object({
    title: nullableText(160),
    city: nullableText(120),
    neighborhood: nullableText(120),
    approximate_address: nullableText(255),
    project_type: nullableText(120),
    standard_wall_height_meters: z.number().finite().positive().max(12).nullable().optional().transform((value) => value ?? null),
    expected_floors: z.number().int().positive().max(10).nullable().optional().transform((value) => value ?? null),
  }),
  walls: z.array(extractedWallSchema).max(100).default([]),
  openings: z.array(extractedOpeningSchema).max(100).default([]),
  missing_information: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  warnings: z.array(z.string().trim().min(1).max(1000)).max(50).default([]),
  confidence,
});

export type SteelFrameDocumentAnalysis = z.infer<typeof steelFrameDocumentAnalysisSchema>;

export function buildSteelFrameDocumentAnalysisPrompt({
  documentNames,
  additionalContext,
}: {
  documentNames: string[];
  additionalContext: string;
}) {
  return `
Voce e um assistente tecnico-comercial da Nova Forma Steel Frame.
Analise somente os documentos recebidos para preparar um rascunho revisavel de orcamento.
Nao invente medidas, materiais, espessuras, precos, prazos, responsaveis ou especificacoes tecnicas.
Quando uma medida, nome de ambiente ou dado estiver ilegivel, cortado, ambiguuo ou ausente, use null e inclua uma pergunta em missing_information.
Nao transforme uma sugestao visual em dado confirmado.

Documentos recebidos, na ordem: ${documentNames.map((name, index) => `${index + 1}. ${name}`).join("; ")}
Contexto adicional do usuario: ${additionalContext.trim() || "Nao informado."}

Para cada parede ou abertura extraida, informe confidence entre 0 e 1 e a evidencia visivel: document_index, page_number quando houver, source_text curto e bounding_box apenas se a localizacao for claramente identificavel.
Se nao houver evidencia suficiente, deixe valores numericos como null e reduza confidence. Um item sem comprimento, altura ou quantidade deve permanecer para revisao, sem calculo automatico.
Resuma o que foi encontrado e crie perguntas curtas para as informacoes faltantes.

Retorne exclusivamente JSON valido, sem markdown ou texto externo, neste formato:
{
  "summary":"",
  "estimate":{
    "title":null,
    "city":null,
    "neighborhood":null,
    "approximate_address":null,
    "project_type":null,
    "standard_wall_height_meters":null,
    "expected_floors":null
  },
  "walls":[{
    "label":"",
    "length_meters":null,
    "height_meters":null,
    "quantity":null,
    "confidence":0,
    "evidence":{"document_index":null,"page_number":null,"source_text":null,"bounding_box":null}
  }],
  "openings":[{
    "label":"",
    "opening_type":"other",
    "width_meters":null,
    "height_meters":null,
    "quantity":null,
    "wall_label":null,
    "confidence":0,
    "evidence":{"document_index":null,"page_number":null,"source_text":null,"bounding_box":null}
  }],
  "missing_information":[],
  "warnings":[],
  "confidence":0
}
`.trim();
}
