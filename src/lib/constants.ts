import type { LeadSource, LeadStatus, Priority, ProjectType } from "@/lib/types";

export const leadStatuses = [
  "Novo lead",
  "Aguardando resposta",
  "Em triagem",
  "Qualificado",
  "Visita a marcar",
  "Visita marcada",
  "Visita realizada",
  "Orcamento a enviar",
  "Orcamento enviado",
  "Em negociacao",
  "Fechado",
  "Perdido",
  "Sem resposta",
] as const satisfies readonly LeadStatus[];

export const pipelineStatuses = [
  "Novo lead",
  "Em triagem",
  "Qualificado",
  "Visita marcada",
  "Orcamento enviado",
  "Em negociacao",
  "Fechado",
  "Perdido",
] as const satisfies readonly LeadStatus[];

export const leadSources = [
  "Site",
  "Google Meu Negocio",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Indicacao",
  "Ligacao",
  "Anuncio pago",
  "Outro",
] as const satisfies readonly LeadSource[];

export const priorities = ["Alta", "Media", "Baixa"] as const satisfies readonly Priority[];

export const projectTypes = [
  "Casa em steel frame",
  "Sobrado",
  "Ampliacao",
  "Reforma",
  "Obra comercial",
  "Fachada",
  "Edicula",
  "Estrutura metalica",
  "Drywall",
  "Outro",
] as const satisfies readonly ProjectType[];

export const interactionTypes = [
  "WhatsApp",
  "Ligacao",
  "Visita",
  "E-mail",
  "Reuniao",
  "Orcamento enviado",
  "Observacao interna",
  "Follow-up",
] as const;

export const templateCategories = [
  "Primeiro contato",
  "Pedido de informações",
  "Cliente com planta",
  "Cliente sem planta",
  "Preço por m²",
  "Agendamento de visita",
  "Confirmação de visita",
  "Pós-visita",
  "Follow-up de orçamento",
  "Cliente sem resposta",
  "Reativação",
] as const;

export const templateVariables = [
  "{nome}",
  "{cidade}",
  "{bairro}",
  "{tipo_obra}",
  "{responsavel}",
  "{data_visita}",
  "{horario_visita}",
] as const;

export const profileRoles = ["admin", "partner", "user"] as const;

export const visitStatuses = [
  "Aguardando agendamento",
  "Visita marcada",
  "Visita realizada",
  "Cliente ausente",
  "Precisa reagendar",
  "Nao recomendado",
  "Aguardando orcamento",
] as const;
