import type { Interaction, Lead, MessageTemplate, Task } from "@/lib/types";

export function leadFixture(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    user_id: "user-1",
    name: "Solange Enfermeira",
    phone: "554884616671",
    email: "solange@example.com",
    first_contact_date: "2026-07-07",
    source: "Site",
    status: "Novo lead",
    priority: "Alta",
    city: "Biguacu",
    neighborhood: "Deltaville",
    approximate_address: null,
    project_type: "Casa em steel frame",
    interest_type: "Obra completa",
    approximate_area: 120,
    has_land: true,
    has_blueprint: true,
    has_previous_quote: false,
    desired_start_time: "30 dias",
    budget_range: "R$ 400k a R$ 600k",
    best_contact_time: "Tarde",
    assigned_to: "Tiago",
    partner_id: null,
    partner_name: null,
    visit_scheduled_at: "2026-07-10T14:00:00.000Z",
    visit_status: "Visita marcada",
    partner_notes: null,
    partner_visit_feedback: null,
    notes: "Cliente pediu visita e possui planta.",
    whatsapp_link: "https://wa.me/554884616671",
    google_business_link: null,
    related_links: null,
    potential_value: 500000,
    closing_probability: 65,
    lead_score: 90,
    wants_visit: true,
    has_urgency: true,
    last_contact_at: "2026-07-07T18:00:00.000Z",
    next_action_at: "2026-07-10T14:00:00.000Z",
    created_at: "2026-07-07T18:00:00.000Z",
    updated_at: "2026-07-07T18:10:00.000Z",
    ...overrides,
  };
}

export function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    lead_id: "lead-1",
    user_id: "user-1",
    title: "Confirmar visita",
    description: "Confirmar horario com cliente",
    due_date: "2026-07-09T14:00:00.000Z",
    priority: "Alta",
    status: "pendente",
    responsible: "Tiago",
    created_at: "2026-07-07T18:00:00.000Z",
    updated_at: "2026-07-07T18:00:00.000Z",
    ...overrides,
  };
}

export function interactionFixture(overrides: Partial<Interaction> = {}): Interaction {
  return {
    id: "interaction-1",
    lead_id: "lead-1",
    user_id: "user-1",
    interaction_type: "WhatsApp",
    responsible: "Tiago",
    description: "Cliente pediu orcamento e aceitou visita.",
    next_step: "Confirmar visita",
    next_contact_at: "2026-07-10T14:00:00.000Z",
    created_at: "2026-07-07T18:00:00.000Z",
    ...overrides,
  };
}

export function templateFixture(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: "template-1",
    user_id: "user-1",
    title: "Primeiro contato",
    category: "Primeiro contato",
    content: "Ola {nome}, podemos falar sobre sua obra em {cidade}/{bairro}?",
    created_at: "2026-07-07T18:00:00.000Z",
    updated_at: "2026-07-07T18:00:00.000Z",
    ...overrides,
  };
}
