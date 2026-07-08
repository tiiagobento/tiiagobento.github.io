import { buildWhatsAppUrl, sanitizePhone, scoreLead } from "@/lib/business";
import type { Interaction, Lead, Task } from "@/lib/types";

function uuid() {
  return crypto.randomUUID();
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeLead(input: Partial<Lead> & Pick<Lead, "name" | "phone">): Lead {
  const now = new Date().toISOString();
  const nextAction = input.next_action_at ? new Date(input.next_action_at).toISOString() : null;
  const phone = sanitizePhone(input.phone);
  const lastContactAt = input.last_contact_at ? new Date(input.last_contact_at).toISOString() : null;
  const lead = {
    id: input.id ?? uuid(),
    name: input.name.trim(),
    phone,
    email: cleanText(input.email) as string | null,
    first_contact_date: input.first_contact_date ?? now.slice(0, 10),
    source: input.source ?? "Site",
    status: input.status ?? "Novo lead",
    priority: input.priority ?? "Media",
    city: cleanText(input.city) as string | null,
    neighborhood: cleanText(input.neighborhood) as string | null,
    approximate_address: cleanText(input.approximate_address) as string | null,
    project_type: input.project_type ?? null,
    interest_type: cleanText(input.interest_type) as string | null,
    approximate_area: cleanNumber(input.approximate_area),
    has_land: Boolean(input.has_land),
    has_blueprint: Boolean(input.has_blueprint),
    has_previous_quote: Boolean(input.has_previous_quote),
    wants_visit: Boolean(input.wants_visit),
    has_urgency: Boolean(input.has_urgency),
    desired_start_time: cleanText(input.desired_start_time) as string | null,
    budget_range: cleanText(input.budget_range) as string | null,
    best_contact_time: cleanText(input.best_contact_time) as string | null,
    assigned_to: (cleanText(input.assigned_to) as string | null) ?? "Tiago",
    partner_id: cleanText(input.partner_id) as string | null,
    partner_name: cleanText(input.partner_name) as string | null,
    visit_scheduled_at: input.visit_scheduled_at ? new Date(input.visit_scheduled_at).toISOString() : null,
    visit_status: input.visit_status ?? "Aguardando agendamento",
    partner_notes: cleanText(input.partner_notes) as string | null,
    partner_visit_feedback: cleanText(input.partner_visit_feedback) as string | null,
    notes: cleanText(input.notes) as string | null,
    whatsapp_link: (cleanText(input.whatsapp_link) as string | null) ?? buildWhatsAppUrl(phone),
    google_business_link: cleanText(input.google_business_link) as string | null,
    related_links: cleanText(input.related_links) as string | null,
    potential_value: cleanNumber(input.potential_value),
    closing_probability: cleanNumber(input.closing_probability),
    lead_score: 0,
    last_contact_at: lastContactAt,
    next_action_at: nextAction,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  } satisfies Lead;
  lead.lead_score = scoreLead(lead);
  return lead;
}

export function normalizeTask(input: Partial<Task> & Pick<Task, "title" | "due_date" | "priority" | "status">): Task {
  const now = new Date().toISOString();
  return {
    id: input.id ?? uuid(),
    lead_id: input.lead_id ?? null,
    title: input.title,
    description: input.description ?? null,
    due_date: new Date(input.due_date).toISOString(),
    priority: input.priority,
    status: input.status,
    responsible: input.responsible ?? "Tiago",
    created_at: input.created_at ?? now,
    updated_at: now,
  } satisfies Task;
}

export function buildFollowUpTaskFromInteraction({
  lead,
  leadId,
  interaction,
}: {
  lead: Lead;
  leadId: string;
  interaction: Omit<Interaction, "id" | "lead_id" | "created_at">;
}) {
  if (!interaction.next_contact_at) return null;

  return normalizeTask({
    lead_id: leadId,
    title: interaction.next_step ? `Follow-up: ${interaction.next_step}` : `Follow-up ${interaction.interaction_type}`,
    description: `Criada a partir da interacao: ${interaction.description}`,
    due_date: interaction.next_contact_at,
    priority: lead.priority ?? "Media",
    status: "pendente",
    responsible: interaction.responsible ?? lead.assigned_to ?? "Tiago",
  });
}
