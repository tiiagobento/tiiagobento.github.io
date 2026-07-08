import { z } from "zod";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const nullableBoolean = z.boolean().nullable();

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
  name: z.string(),
  phone: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  source: z.string(),
  project_type: z.string(),
  interest_type: z.string(),
  has_land: nullableBoolean,
  has_blueprint: nullableBoolean,
  urgency: z.string(),
  notes: z.string(),
  status: z.string(),
  priority: z.string(),
  next_step: z.string(),
  lead_score: z.number().min(0).max(100),
});

export const aiLeadAnalysisSchema = z.object({
  leads: z.array(aiExtractedLeadSchema),
  summary: z.string(),
  warnings: z.array(z.string()),
});

export type AIExtractedLead = z.infer<typeof aiExtractedLeadSchema>;
export type AILeadAnalysisResult = z.infer<typeof aiLeadAnalysisSchema>;
