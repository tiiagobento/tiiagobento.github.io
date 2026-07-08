export type LeadStatus =
  | "Novo lead"
  | "Aguardando resposta"
  | "Em triagem"
  | "Qualificado"
  | "Visita a marcar"
  | "Visita marcada"
  | "Visita realizada"
  | "Orcamento a enviar"
  | "Orcamento enviado"
  | "Em negociacao"
  | "Fechado"
  | "Perdido"
  | "Sem resposta";

export type Priority = "Alta" | "Media" | "Baixa";

export type LeadSource =
  | "Site"
  | "Google Meu Negocio"
  | "WhatsApp"
  | "Instagram"
  | "Facebook"
  | "Indicacao"
  | "Ligacao"
  | "Anuncio pago"
  | "Outro";

export type ProjectType =
  | "Casa em steel frame"
  | "Sobrado"
  | "Ampliacao"
  | "Reforma"
  | "Obra comercial"
  | "Fachada"
  | "Edicula"
  | "Estrutura metalica"
  | "Drywall"
  | "Outro";

export type ProfileRole = "admin" | "partner" | "user";

export type VisitStatus =
  | "Aguardando agendamento"
  | "Visita marcada"
  | "Visita realizada"
  | "Cliente ausente"
  | "Precisa reagendar"
  | "Nao recomendado"
  | "Aguardando orcamento";

export type Profile = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: ProfileRole;
  created_at?: string | null;
};

export type Lead = {
  id: string;
  user_id?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  first_contact_date: string;
  source: LeadSource;
  status: LeadStatus;
  priority: Priority;
  city?: string | null;
  neighborhood?: string | null;
  approximate_address?: string | null;
  project_type?: ProjectType | null;
  interest_type?: string | null;
  approximate_area?: number | null;
  has_land?: boolean | null;
  has_blueprint?: boolean | null;
  has_previous_quote?: boolean | null;
  desired_start_time?: string | null;
  budget_range?: string | null;
  best_contact_time?: string | null;
  assigned_to?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  visit_scheduled_at?: string | null;
  visit_status?: VisitStatus | null;
  partner_notes?: string | null;
  partner_visit_feedback?: string | null;
  notes?: string | null;
  whatsapp_link?: string | null;
  google_business_link?: string | null;
  related_links?: string | null;
  potential_value?: number | null;
  closing_probability?: number | null;
  lead_score: number;
  wants_visit?: boolean | null;
  has_urgency?: boolean | null;
  last_contact_at?: string | null;
  next_action_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  lead_id: string;
  user_id?: string | null;
  interaction_type: string;
  responsible?: string | null;
  description: string;
  next_step?: string | null;
  next_contact_at?: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  lead_id?: string | null;
  user_id?: string | null;
  title: string;
  description?: string | null;
  due_date: string;
  priority: Priority;
  status: "pendente" | "concluida" | "atrasada";
  responsible?: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageTemplate = {
  id: string;
  user_id?: string | null;
  title: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
};
