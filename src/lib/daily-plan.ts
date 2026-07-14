import {
  differenceInCalendarDays,
  differenceInMinutes,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Interaction, Lead, MessageTemplate, Priority, Task } from "@/lib/types";

export type DailyActionKind =
  | "scheduled"
  | "overdue"
  | "new-lead"
  | "contact-today"
  | "proposal-follow-up"
  | "stalled-negotiation"
  | "hot-lead"
  | "future-task";

export type DailyAction = {
  id: string;
  kind: DailyActionKind;
  title: string;
  reason: string;
  context: string;
  estimatedMinutes: number;
  score: number;
  priority: Priority;
  dueAt: string | null;
  overdueDays: number;
  leadId: string | null;
  taskId: string | null;
  leadName: string | null;
  stage: string;
  source: string | null;
  primaryAction: "whatsapp" | "view" | "complete";
  suggestedTemplateCategory: string | null;
  generated: boolean;
};

export type DailyPlanSummary = {
  total: number;
  priorities: number;
  followUps: number;
  visits: number;
  overdue: number;
  hotLeads: number;
  estimatedMinutes: number;
};

type BuildDailyPlanInput = {
  leads: Lead[];
  tasks: Task[];
  interactions?: Interaction[];
  templates?: MessageTemplate[];
  now?: Date;
};

const terminalStatuses = new Set<Lead["status"]>(["Fechado", "Perdido"]);
const contactPattern = /whats|mensagem|contato|follow|retomar|responder|orcamento|orçamento|cliente/i;
const scheduledPattern = /visita|reuniao|reunião|ligacao|ligação|video|vídeo/i;

export function buildDailyPlan({ leads, tasks, interactions = [], now = new Date() }: BuildDailyPlanInput) {
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const activeTasks = tasks.filter((task) => task.status !== "concluida");
  const leadsWithOpenTasks = new Set(activeTasks.map((task) => task.lead_id).filter(Boolean));
  const actions: DailyAction[] = activeTasks.map((task) => buildTaskAction(task, leadMap.get(task.lead_id ?? ""), now));

  for (const lead of leads) {
    if (terminalStatuses.has(lead.status) || leadsWithOpenTasks.has(lead.id)) continue;
    const action = buildLeadAction(lead, interactions, now);
    if (action) actions.push(action);
  }

  return actions.sort(compareDailyActions);
}

export function summarizeDailyPlan(actions: DailyAction[]): DailyPlanSummary {
  return {
    total: actions.length,
    priorities: actions.filter((action) => action.score >= 700).length,
    followUps: actions.filter((action) => ["overdue", "proposal-follow-up", "stalled-negotiation", "contact-today"].includes(action.kind)).length,
    visits: actions.filter((action) => /visita|reuni/i.test(`${action.title} ${action.context}`)).length,
    overdue: actions.filter((action) => action.overdueDays > 0).length,
    hotLeads: actions.filter((action) => action.kind === "hot-lead" || /lead quente/i.test(action.reason)).length,
    estimatedMinutes: actions.reduce((total, action) => total + action.estimatedMinutes, 0),
  };
}

export function reorganizeDailyPlan(actions: DailyAction[], strategy: "priority" | "quick-wins") {
  if (strategy === "priority") return [...actions].sort(compareDailyActions);
  return [...actions].sort((a, b) => {
    const rankDifference = actionRank(b) - actionRank(a);
    if (rankDifference) return rankDifference;
    if (a.estimatedMinutes !== b.estimatedMinutes) return a.estimatedMinutes - b.estimatedMinutes;
    return compareDailyActions(a, b);
  });
}

function buildTaskAction(task: Task, lead: Lead | undefined, now: Date): DailyAction {
  const due = parseISO(task.due_date);
  const today = startOfDay(now);
  const overdue = isBefore(due, today);
  const dueToday = isSameDay(due, now);
  const hasDefinedTime = `${due.getHours()}:${String(due.getMinutes()).padStart(2, "0")}` !== "12:00";
  const scheduled = dueToday && hasDefinedTime && scheduledPattern.test(`${task.title} ${task.description ?? ""}`);
  const overdueDays = overdue ? Math.max(1, differenceInCalendarDays(today, due)) : 0;
  const kind: DailyActionKind = scheduled ? "scheduled" : overdue ? "overdue" : dueToday ? "contact-today" : "future-task";
  const priorityBoost = task.priority === "Alta" ? 55 : task.priority === "Media" ? 25 : 0;
  const baseScore = scheduled ? 1_000 : overdue ? 900 + Math.min(overdueDays * 8, 72) : dueToday ? 700 : 300;
  const leadBoost = lead ? Math.round(lead.lead_score * 0.7) : 0;
  const isContact = Boolean(lead && contactPattern.test(`${task.title} ${task.description ?? ""}`));

  return {
    id: `task:${task.id}`,
    kind,
    title: task.title,
    reason: scheduled
      ? `Compromisso com horario marcado para hoje${lead ? ` com ${lead.name}` : ""}.`
      : overdue
        ? `${overdueDays === 1 ? "Esta acao esta" : `Esta acao esta ha ${overdueDays} dias`} atrasada e ainda esta pendente.`
        : dueToday
          ? "Acao programada para hoje e ainda nao concluida."
          : `Tarefa futura de prioridade ${task.priority.toLowerCase()}.`,
    context: task.description?.trim() || leadContext(lead),
    estimatedMinutes: estimateMinutes(task.title, task.description),
    score: baseScore + priorityBoost + leadBoost,
    priority: task.priority,
    dueAt: task.due_date,
    overdueDays,
    leadId: lead?.id ?? task.lead_id ?? null,
    taskId: task.id,
    leadName: lead?.name ?? null,
    stage: lead?.status ?? "Tarefa interna",
    source: lead?.source ?? null,
    primaryAction: isContact ? "whatsapp" : scheduled || lead ? "view" : "complete",
    suggestedTemplateCategory: lead ? chooseTemplateCategory(lead, kind) : null,
    generated: false,
  };
}

function buildLeadAction(lead: Lead, interactions: Interaction[], now: Date): DailyAction | null {
  const lastContactDays = daysSinceLastContactAt(lead, now);
  const ageMinutes = Math.max(0, differenceInMinutes(now, parseISO(lead.created_at)));
  const hasNoInteraction = !lead.last_contact_at && !interactions.some((interaction) => interaction.lead_id === lead.id);
  const nextAction = lead.next_action_at ? parseISO(lead.next_action_at) : null;
  const nextActionDue = Boolean(nextAction && !isAfter(nextAction, now));
  const nextActionOverdue = Boolean(nextAction && isBefore(nextAction, startOfDay(now)));
  const newLead = ["Novo lead", "Em triagem", "Aguardando resposta"].includes(lead.status) && hasNoInteraction;
  const proposal = lead.status === "Orcamento enviado" && lastContactDays >= 2;
  const stalledNegotiation = lead.status === "Em negociacao" && lastContactDays >= 3;
  const hot = lead.lead_score >= 70 && isStaleLeadAt(lead, now);

  let kind: DailyActionKind | null = null;
  let score = 0;
  let title = "";
  let reason = "";

  if (nextActionDue) {
    kind = nextActionOverdue ? "overdue" : "contact-today";
    const overdueDays = nextActionOverdue && nextAction ? Math.max(1, differenceInCalendarDays(startOfDay(now), nextAction)) : 0;
    score = nextActionOverdue ? 930 + Math.min(overdueDays * 8, 64) : 760;
    title = `Retomar contato com ${lead.name}`;
    reason = nextActionOverdue
      ? `O proximo contato combinado esta atrasado ha ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}.`
      : "O proximo contato deste lead esta programado para hoje.";
  } else if (newLead) {
    kind = "new-lead";
    score = 840 + Math.min(lead.lead_score, 100) + (lead.source === "Site" ? 35 : 0);
    title = `Responder ${lead.name} pelo WhatsApp`;
    reason = ageMinutes < 60
      ? `Lead ${lead.lead_score >= 70 ? "quente " : ""}recebido por ${lead.source} ha ${Math.max(1, ageMinutes)} minutos e ainda sem atendimento.`
      : `Lead ${lead.lead_score >= 70 ? "quente " : ""}recebido por ${lead.source} e ainda sem atendimento registrado.`;
  } else if (proposal) {
    kind = "proposal-follow-up";
    score = 650 + Math.min(lastContactDays * 10, 80) + Math.round(lead.lead_score * 0.5);
    title = `Retomar o orcamento com ${lead.name}`;
    reason = `Orcamento enviado sem contato registrado ha ${lastContactDays} ${lastContactDays === 1 ? "dia" : "dias"}.`;
  } else if (stalledNegotiation) {
    kind = "stalled-negotiation";
    score = 610 + Math.min(lastContactDays * 9, 72) + Math.round(lead.lead_score * 0.5);
    title = `Destravar negociacao com ${lead.name}`;
    reason = `Negociacao sem movimentacao ha ${lastContactDays} ${lastContactDays === 1 ? "dia" : "dias"}.`;
  } else if (hot) {
    kind = "hot-lead";
    score = 720 + lead.lead_score;
    title = `Retomar ${lead.name}`;
    reason = `Lead quente com score ${lead.lead_score} e sem contato ha ${lastContactDays} ${lastContactDays === 1 ? "dia" : "dias"}.`;
  }

  if (!kind) return null;
  const overdueDays = kind === "overdue" && nextAction ? Math.max(1, differenceInCalendarDays(startOfDay(now), nextAction)) : 0;

  return {
    id: `lead:${lead.id}:${kind}`,
    kind,
    title,
    reason,
    context: leadContext(lead),
    estimatedMinutes: kind === "new-lead" ? 3 : 4,
    score: score + priorityScore(lead.priority),
    priority: lead.priority,
    dueAt: lead.next_action_at ?? null,
    overdueDays,
    leadId: lead.id,
    taskId: null,
    leadName: lead.name,
    stage: lead.status,
    source: lead.source,
    primaryAction: "whatsapp",
    suggestedTemplateCategory: chooseTemplateCategory(lead, kind),
    generated: true,
  };
}

function chooseTemplateCategory(lead: Lead, kind: DailyActionKind) {
  if (kind === "new-lead") {
    if (lead.source === "Site") return "Cliente vindo do site";
    if (lead.source === "Google Meu Negocio") return "Cliente de Google Meu Negocio";
    return "Primeiro contato";
  }
  if (kind === "proposal-follow-up" || lead.status === "Orcamento enviado") return "Follow-up de orcamento";
  if (kind === "stalled-negotiation" || lead.status === "Em negociacao") return "Fechamento/negociacao";
  if (lead.wants_visit || ["Visita a marcar", "Visita marcada"].includes(lead.status)) return "Agendamento de visita";
  if (lead.has_blueprint) return "Cliente com planta";
  if (lead.lead_score >= 70) return "Cliente quente";
  return "Cliente sem resposta";
}

function compareDailyActions(a: DailyAction, b: DailyAction) {
  const rankDifference = actionRank(b) - actionRank(a);
  if (rankDifference) return rankDifference;
  if (b.score !== a.score) return b.score - a.score;
  if (a.dueAt && b.dueAt) return parseISO(a.dueAt).getTime() - parseISO(b.dueAt).getTime();
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return a.title.localeCompare(b.title, "pt-BR");
}

function actionRank(action: DailyAction) {
  if (action.kind === "scheduled") return 8;
  if (action.kind === "overdue") return 7;
  if (action.kind === "new-lead" || action.kind === "hot-lead") return 6;
  if (action.kind === "contact-today") return 5;
  if (action.kind === "proposal-follow-up") return 4;
  if (action.kind === "stalled-negotiation") return 3;
  return 1;
}

function priorityScore(priority: Priority) {
  if (priority === "Alta") return 60;
  if (priority === "Media") return 25;
  return 0;
}

function estimateMinutes(title: string, description?: string | null) {
  const content = `${title} ${description ?? ""}`;
  if (/visita|reuniao|reunião/i.test(content)) return 45;
  if (/orcamento|orçamento|proposta/i.test(content)) return 15;
  if (/ligacao|ligação/i.test(content)) return 10;
  if (/whats|mensagem|follow|contato|responder/i.test(content)) return 3;
  return 5;
}

function leadContext(lead?: Lead) {
  if (!lead) return "Acao interna sem lead relacionado.";
  const location = [lead.city, lead.neighborhood].filter(Boolean).join(" / ");
  const details = [location, lead.project_type, lead.approximate_area ? `${lead.approximate_area} m2` : null].filter(Boolean);
  return details.length ? details.join(" · ") : "Informacoes da obra ainda incompletas.";
}

function daysSinceLastContactAt(lead: Lead, now: Date) {
  const date = lead.last_contact_at ?? lead.first_contact_date ?? lead.created_at;
  return differenceInCalendarDays(now, parseISO(date.length === 10 ? `${date}T12:00:00` : date));
}

function isStaleLeadAt(lead: Lead, now: Date) {
  if (terminalStatuses.has(lead.status)) return false;
  return daysSinceLastContactAt(lead, now) > 3;
}
