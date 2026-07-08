import { z } from "zod";
import { interactionTypes, leadSources, leadStatuses, priorities, projectTypes } from "@/lib/constants";
import { sanitizePhone } from "@/lib/business";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente"),
  phone: z
    .string()
    .transform((value) => sanitizePhone(value))
    .refine((value) => value.length >= 10, "Informe um telefone/WhatsApp valido"),
  email: z.preprocess(emptyToUndefined, z.string().email("E-mail invalido").optional()),
  first_contact_date: z.string().min(1, "Informe a data do primeiro contato"),
  source: z.enum(leadSources),
  status: z.enum(leadStatuses),
  priority: z.enum(priorities),
  city: optionalText,
  neighborhood: optionalText,
  approximate_address: optionalText,
  project_type: z.preprocess(emptyToUndefined, z.enum(projectTypes).optional()),
  interest_type: optionalText,
  approximate_area: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  has_land: z.coerce.boolean().optional(),
  has_blueprint: z.coerce.boolean().optional(),
  has_previous_quote: z.coerce.boolean().optional(),
  wants_visit: z.coerce.boolean().optional(),
  has_urgency: z.coerce.boolean().optional(),
  desired_start_time: optionalText,
  budget_range: optionalText,
  best_contact_time: optionalText,
  assigned_to: optionalText,
  notes: optionalText,
  whatsapp_link: optionalText,
  google_business_link: optionalText,
  related_links: optionalText,
  potential_value: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  closing_probability: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional()),
  next_action_at: z.string().optional(),
});

export type LeadFormInput = z.input<typeof leadSchema>;
export type LeadFormValues = z.output<typeof leadSchema>;

export const interactionSchema = z.object({
  interaction_type: z.enum(interactionTypes),
  responsible: optionalText,
  description: z.string().min(2, "Descreva a interacao"),
  next_step: optionalText,
  next_contact_at: z.string().nullable().optional(),
});

export type InteractionFormValues = z.output<typeof interactionSchema>;

export const taskSchema = z.object({
  lead_id: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  due_date: z.string().min(1),
  priority: z.enum(priorities),
  status: z.enum(["pendente", "concluida", "atrasada"]),
  responsible: z.string().optional(),
});
