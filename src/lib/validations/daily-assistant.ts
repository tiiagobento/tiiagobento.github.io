import { z } from "zod";

export const dailyAssistantModeSchema = z.enum(["welcome", "start", "priorities", "overdue", "attention", "reorganized", "end"]);

export const dailyAssistantActionSchema = z.object({
  id: z.string().min(1).max(180),
  title: z.string().min(1).max(240),
  reason: z.string().min(1).max(800),
  context: z.string().max(1_200).default(""),
  stage: z.string().max(100).default("A confirmar"),
  source: z.string().max(100).nullable().default(null),
  estimated_minutes: z.number().int().min(1).max(240),
  score: z.number().int().min(0).max(2_000),
  lead_name: z.string().max(160).nullable().default(null),
});

export const dailyAssistantRequestSchema = z.object({
  mode: dailyAssistantModeSchema,
  profile_name: z.string().max(120).optional().default(""),
  actions: z.array(dailyAssistantActionSchema).max(12),
});

export const dailyAssistantResponseSchema = z.object({
  message: z.string().min(1).max(420),
  suggested_action_id: z.string().max(180).nullable().default(null),
  missing_information: z.array(z.string().min(1).max(100)).max(3).default([]),
  suggested_question: z.string().min(1).max(180).nullable().default(null),
});

export type DailyAssistantMode = z.infer<typeof dailyAssistantModeSchema>;
export type DailyAssistantRequest = z.infer<typeof dailyAssistantRequestSchema>;
export type DailyAssistantResponse = z.infer<typeof dailyAssistantResponseSchema>;
