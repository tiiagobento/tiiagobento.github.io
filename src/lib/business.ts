import { differenceInCalendarDays, format, isBefore, parseISO, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Lead } from "@/lib/types";

export function sanitizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (phone.trim().startsWith("+")) return digits;
  if (digits.startsWith("00") && digits.length > 11) return digits.slice(2);
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function isValidWhatsAppPhone(phone: string) {
  const sanitized = sanitizePhone(phone);
  return /^\d{10,15}$/.test(sanitized);
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const sanitized = sanitizePhone(phone);
  if (!isValidWhatsAppPhone(sanitized)) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${sanitized}${text}`;
}

export function scoreLead(input: Partial<Lead>) {
  let score = 0;
  if (sanitizePhone(input.phone ?? "").length >= 10) score += 10;
  if (input.city || input.neighborhood) score += 10;
  if (input.has_land) score += 15;
  if (input.has_blueprint) score += 20;
  if (input.approximate_area) score += 10;
  if (input.wants_visit || input.status === "Visita a marcar" || input.status === "Visita marcada") score += 15;
  if (input.desired_start_time) score += 10;
  if (input.has_urgency || input.priority === "Alta") score += 10;
  return Math.min(score, 100);
}

export function scoreLabel(score: number) {
  if (score >= 70) return "Lead quente";
  if (score >= 40) return "Lead morno";
  return "Lead frio";
}

export function daysSinceLastContact(lead: Lead) {
  const date = lead.last_contact_at ?? lead.first_contact_date ?? lead.created_at;
  return differenceInCalendarDays(new Date(), parseISO(date));
}

export function isStaleLead(lead: Lead) {
  if (lead.status === "Fechado" || lead.status === "Perdido") return false;
  return daysSinceLastContact(lead) > 3;
}

export function isOverdueLead(lead: Lead) {
  if (!lead.next_action_at || lead.status === "Fechado" || lead.status === "Perdido") return false;
  return isBefore(parseISO(lead.next_action_at), startOfToday());
}

export function applyTemplate(template: string, lead: Partial<Lead>) {
  const visitDate = lead.visit_scheduled_at ? parseISO(lead.visit_scheduled_at) : lead.next_action_at ? parseISO(lead.next_action_at) : null;
  const values: Record<string, string> = {
    "{nome}": lead.name ?? "",
    "{cidade}": lead.city ?? "",
    "{bairro}": lead.neighborhood ?? "",
    "{tipo_obra}": lead.project_type ?? "",
    "{responsavel}": lead.assigned_to ?? "Tiago",
    "{data_visita}": visitDate ? format(visitDate, "dd/MM/yyyy", { locale: ptBR }) : "",
    "{horario_visita}": visitDate ? format(visitDate, "HH:mm", { locale: ptBR }) : "",
    "{empresa}": "Nova Forma Steel Frame",
    "{proximo_passo}": lead.next_action_at ? "agendar o proximo contato" : "",
  };

  return template
    .replace(/\{nome\}|\{cidade\}|\{bairro\}|\{tipo_obra\}|\{responsavel\}|\{data_visita\}|\{horario_visita\}|\{empresa\}|\{proximo_passo\}/g, (variable) => values[variable] ?? "");
}
