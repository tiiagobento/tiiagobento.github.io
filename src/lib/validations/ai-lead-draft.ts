import { z } from "zod";

const nullableString = z.preprocess((value) => {
  if (value === undefined || value === "") return null;
  if (value === null) return null;
  return String(value);
}, z.string().nullable());
const nullableNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}, z.number().nullable());
const nullableBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "sim", "yes", "1"].includes(normalized)) return true;
  if (["false", "nao", "não", "no", "0"].includes(normalized)) return false;
  return null;
}, z.boolean().nullable());
const aiString = z.preprocess((value) => {
  if (value === undefined || value === null) return "";
  return String(value);
}, z.string());
const aiStringArray = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [String(value)];
}, z.array(z.string()));
const scoreValue = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return 0;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}, z.number().min(0).max(100));

const confidenceValue = z.number().min(0).max(1);

export const aiLeadDraftSchema = z.object({
  lead: z.object({
    name: nullableString,
    phone: nullableString,
    email: nullableString,
    first_contact_date: nullableString,
    source: nullableString,
    status: nullableString,
    priority: nullableString,
    city: nullableString,
    neighborhood: nullableString,
    approximate_address: nullableString,
    project_type: nullableString,
    interest_type: nullableString,
    approximate_area: nullableNumber,
    has_land: nullableBoolean,
    has_blueprint: nullableBoolean,
    has_previous_quote: nullableBoolean,
    desired_start_time: nullableString,
    budget_range: nullableString,
    best_contact_time: nullableString,
    notes: nullableString,
    potential_value: nullableNumber,
    closing_probability: nullableNumber,
  }),
  ai_summary: z.string(),
  bruno_visit_summary: z.string(),
  missing_information: z.array(z.string()),
  suggested_questions: z.array(z.string()),
  confidence: z.object({
    overall: confidenceValue,
    name: confidenceValue,
    phone: confidenceValue,
    city: confidenceValue,
    project_type: confidenceValue,
    budget_range: confidenceValue,
  }),
});

export type AILeadDraft = z.infer<typeof aiLeadDraftSchema>;

export const aiExtractedLeadSchema = z.object({
  name: aiString.default(""),
  phone: aiString.default(""),
  city: aiString.default(""),
  neighborhood: aiString.default(""),
  source: aiString.default(""),
  project_type: aiString.default(""),
  interest_type: aiString.default(""),
  has_land: nullableBoolean,
  has_blueprint: nullableBoolean,
  urgency: aiString.default(""),
  notes: aiString.default(""),
  status: aiString.default("Novo lead"),
  priority: aiString.default("Media"),
  next_step: aiString.default(""),
  lead_score: scoreValue.default(0),
});

export const aiLeadAnalysisSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const leads = Array.isArray(record.leads)
    ? record.leads
    : record.lead && typeof record.lead === "object"
      ? [record.lead]
      : [];

  return {
    ...record,
    leads,
    summary: record.summary ?? record.ai_summary ?? "",
    warnings: record.warnings ?? record.missing_information ?? [],
  };
}, z.object({
  leads: z.array(aiExtractedLeadSchema),
  summary: aiString.default(""),
  warnings: aiStringArray.default([]),
}));

export type AIExtractedLead = z.infer<typeof aiExtractedLeadSchema>;
export type AILeadAnalysisResult = z.infer<typeof aiLeadAnalysisSchema>;
