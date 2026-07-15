"use client";

import * as React from "react";
import Link from "next/link";
import { addDays, addHours, differenceInMinutes, format, isToday, parseISO, set } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleGauge,
  Clock3,
  ExternalLink,
  Focus,
  ListChecks,
  MessageCircle,
  MoonStar,
  RefreshCw,
  Send,
  Sparkles,
  SunMedium,
  TimerReset,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { applyTemplate, buildWhatsAppUrl, isValidWhatsAppPhone } from "@/lib/business";
import {
  buildDailyPlan,
  reorganizeDailyPlan,
  summarizeDailyPlan,
  type DailyAction,
} from "@/lib/daily-plan";
import { getTemplatesWithDefaults } from "@/lib/default-message-templates";
import type { AutomationLevel } from "@/lib/automation-preferences";
import type { DailyAssistantMode } from "@/lib/validations/daily-assistant";
import { cn } from "@/lib/utils";
import type { Interaction, Lead, MessageTemplate, Task } from "@/lib/types";

export type DailyExecutionHandlers = {
  completeTask?: (id: string) => Promise<unknown>;
  saveTask?: (input: Partial<Task> & Pick<Task, "title" | "due_date" | "priority" | "status">) => Promise<unknown>;
  addInteraction?: (
    leadId: string,
    input: Omit<Interaction, "id" | "lead_id" | "created_at">,
    leadUpdates?: Partial<Pick<Lead, "status" | "priority">>,
  ) => Promise<unknown>;
  updateLead?: (id: string, input: Partial<Lead>) => Promise<unknown>;
};

type Props = {
  leads: Lead[];
  interactions: Interaction[];
  tasks: Task[];
  templates: MessageTemplate[];
  profileName?: string | null;
  isOnline: boolean;
  automationLevel: AutomationLevel;
  handlers?: DailyExecutionHandlers;
};

type AssistantMode = DailyAssistantMode;
type WhatsAppStep = "preview" | "result" | "reply-result";

type AssistantEntry = {
  id: string;
  message: string;
  source: "ai" | "plan";
  suggestedActionId: string | null;
  missingInformation: string[];
  suggestedQuestion: string | null;
};

type DayExecutionState = {
  date: string;
  plannedActionIds: string[];
  completedActionIds: string[];
  deferredActionIds: string[];
  startedAt: string | null;
};

export function DailyExecutionAssistant({
  leads,
  interactions,
  tasks,
  templates,
  profileName,
  isOnline,
  automationLevel,
  handlers,
}: Props) {
  const todayKey = localDateKey();
  const basePlan = React.useMemo(() => buildDailyPlan({ leads, interactions, tasks }), [interactions, leads, tasks]);
  const [strategy, setStrategy] = React.useState<"priority" | "quick-wins">("priority");
  const orderedPlan = React.useMemo(() => reorganizeDailyPlan(basePlan, strategy), [basePlan, strategy]);
  const [dayState, setDayState] = React.useState<DayExecutionState>(() => emptyDayState(todayKey));
  const [assistantExpanded, setAssistantExpanded] = React.useState(true);
  const [assistantMode, setAssistantMode] = React.useState<AssistantMode>("welcome");
  const [assistantEntries, setAssistantEntries] = React.useState<AssistantEntry[]>([]);
  const [assistantProcessing, setAssistantProcessing] = React.useState(false);
  const [suggestedActionId, setSuggestedActionId] = React.useState<string | null>(null);
  const [focusOpen, setFocusOpen] = React.useState(false);
  const [fullDayOpen, setFullDayOpen] = React.useState(false);
  const [deferAction, setDeferAction] = React.useState<DailyAction | null>(null);
  const [whatsAppAction, setWhatsAppAction] = React.useState<DailyAction | null>(null);
  const [whatsAppStep, setWhatsAppStep] = React.useState<WhatsAppStep>("preview");
  const [message, setMessage] = React.useState("");
  const [generatingMessage, setGeneratingMessage] = React.useState(false);
  const [savingOutcome, setSavingOutcome] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(dayStorageKey(todayKey));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DayExecutionState;
        if (parsed.date === todayKey) setDayState(parsed);
      } catch {
        window.localStorage.removeItem(dayStorageKey(todayKey));
      }
    }
  }, [todayKey]);

  React.useEffect(() => {
    setDayState((current) => {
      const next = {
        ...current,
        plannedActionIds: Array.from(new Set([...current.plannedActionIds, ...orderedPlan.map((action) => action.id)])),
      };
      persistDayState(next);
      return next;
    });
  }, [orderedPlan]);

  const completedIds = React.useMemo(() => new Set(dayState.completedActionIds), [dayState.completedActionIds]);
  const deferredIds = React.useMemo(() => new Set(dayState.deferredActionIds), [dayState.deferredActionIds]);
  const visiblePlan = orderedPlan.filter((action) => !completedIds.has(action.id) && !deferredIds.has(action.id));
  const summary = summarizeDailyPlan(visiblePlan);
  const currentAction = visiblePlan[0] ?? null;
  const completedCount = dayState.completedActionIds.length;
  const plannedTotal = Math.max(dayState.plannedActionIds.length, visiblePlan.length + completedCount);
  const progress = plannedTotal ? Math.min(100, Math.round((completedCount / plannedTotal) * 100)) : 0;
  const firstName = profileName?.trim().split(" ")[0] || "Tiago";
  const assistantMessage = buildAssistantMessage(assistantMode, summary, currentAction, completedCount, firstName, strategy);
  const recommendedAction = visiblePlan.find((action) => action.id === suggestedActionId) ?? currentAction;

  React.useEffect(() => {
    if (assistantEntries.length || !currentAction) return;
    setAssistantEntries([{
      id: `welcome:${currentAction.id}`,
      message: buildAssistantMessage("welcome", summary, currentAction, completedCount, firstName, strategy),
      source: "plan",
      suggestedActionId: currentAction.id,
      missingInformation: getMissingLeadFields(leads.find((lead) => lead.id === currentAction.leadId)),
      suggestedQuestion: null,
    }]);
  }, [assistantEntries.length, completedCount, currentAction, firstName, leads, strategy, summary]);

  function updateDayState(updater: (current: DayExecutionState) => DayExecutionState) {
    setDayState((current) => {
      const next = updater(current);
      persistDayState(next);
      return next;
    });
  }

  function markCompleted(action: DailyAction) {
    updateDayState((current) => ({
      ...current,
      completedActionIds: Array.from(new Set([...current.completedActionIds, action.id])),
      deferredActionIds: current.deferredActionIds.filter((id) => id !== action.id),
    }));
  }

  function startDay() {
    updateDayState((current) => ({ ...current, startedAt: current.startedAt ?? new Date().toISOString() }));
    void runAssistantShortcut("start");
    if (currentAction) setFocusOpen(true);
  }

  async function completeAction(action: DailyAction) {
    if (!handlers?.completeTask || !action.taskId) {
      if (action.primaryAction === "whatsapp") {
        await prepareWhatsApp(action);
        return;
      }
      toast.info("Abra o contexto para confirmar o resultado desta acao.");
      return;
    }
    try {
      await handlers.completeTask(action.taskId);
      markCompleted(action);
      toast.success("Acao concluida. A proxima prioridade ja esta pronta.");
    } catch {
      toast.error("Nao foi possivel concluir a acao.");
    }
  }

  async function postponeAction(action: DailyAction, option: "1h" | "3h" | "tomorrow") {
    if (!handlers?.saveTask) {
      toast.error("Nao foi possivel acessar as tarefas agora.");
      return;
    }
    const originalTask = action.taskId ? tasks.find((task) => task.id === action.taskId) : null;
    const dueDate = option === "tomorrow"
      ? set(addDays(new Date(), 1), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 })
      : addHours(new Date(), option === "1h" ? 1 : 3);

    try {
      await handlers.saveTask({
        ...(originalTask ?? {}),
        id: originalTask?.id,
        lead_id: action.leadId,
        title: originalTask?.title ?? action.title,
        description: originalTask?.description ?? `${action.reason}\n${action.context}`,
        due_date: dueDate.toISOString(),
        priority: originalTask?.priority ?? action.priority,
        status: "pendente",
        responsible: originalTask?.responsible ?? "Tiago",
        created_at: originalTask?.created_at,
      });
      updateDayState((current) => ({
        ...current,
        deferredActionIds: Array.from(new Set([...current.deferredActionIds, action.id])),
      }));
      setDeferAction(null);
      toast.success(option === "tomorrow" ? "Acao transferida para amanha." : `Acao adiada por ${option}.`);
    } catch {
      toast.error("Nao foi possivel reagendar a acao.");
    }
  }

  async function transferRemainingToTomorrow() {
    if (!handlers?.saveTask || !visiblePlan.length) return;
    const tomorrow = set(addDays(new Date(), 1), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
    try {
      for (const [index, action] of visiblePlan.entries()) {
        const originalTask = action.taskId ? tasks.find((task) => task.id === action.taskId) : null;
        await handlers.saveTask({
          ...(originalTask ?? {}),
          id: originalTask?.id,
          lead_id: action.leadId,
          title: originalTask?.title ?? action.title,
          description: originalTask?.description ?? `${action.reason}\n${action.context}`,
          due_date: addHours(tomorrow, index).toISOString(),
          priority: originalTask?.priority ?? action.priority,
          status: "pendente",
          responsible: originalTask?.responsible ?? "Tiago",
          created_at: originalTask?.created_at,
        });
      }
      updateDayState((current) => ({
        ...current,
        deferredActionIds: Array.from(new Set([...current.deferredActionIds, ...visiblePlan.map((action) => action.id)])),
      }));
      toast.success(`${visiblePlan.length} acoes foram transferidas para amanha.`);
    } catch {
      toast.error("Nao foi possivel transferir todas as acoes. Revise a fila antes de sair.");
    }
  }

  async function prepareWhatsApp(action: DailyAction) {
    const lead = leads.find((item) => item.id === action.leadId);
    if (!lead) {
      toast.error("Este item nao possui um lead valido.");
      return;
    }
    if (!isValidWhatsAppPhone(lead.phone)) {
      toast.error("O telefone deste lead esta incompleto. Revise a ficha antes de abrir o WhatsApp.");
      return;
    }

    const fallback = buildFallbackMessage(lead, action, templates);
    const recentHistory = interactions
      .filter((interaction) => interaction.lead_id === lead.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((interaction) => `${interaction.interaction_type}: ${interaction.description}`)
      .join("\n");
    setWhatsAppAction(action);
    setWhatsAppStep("preview");
    setMessage(fallback);
    setGeneratingMessage(true);

    if (!isOnline) {
      setGeneratingMessage(false);
      toast.info("Voce esta offline. Preparei a mensagem com um template salvo no aplicativo.");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          objective: action.title,
          context: `${action.reason}\n${action.context}${recentHistory ? `\nHistorico recente:\n${recentHistory}` : ""}`,
          tone: "cordial",
          lead: {
            name: lead.name,
            city: lead.city,
            neighborhood: lead.neighborhood,
            project_type: lead.project_type,
            status: lead.status,
            source: lead.source,
            has_land: lead.has_land,
            has_blueprint: lead.has_blueprint,
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok || !payload.message?.trim()) throw new Error(payload.error || "IA indisponivel");
      setMessage(payload.message.trim());
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      toast.info(timedOut ? "A IA demorou para responder. Mantive uma mensagem segura do template." : "A IA esta indisponivel. Mantive uma mensagem segura do template.");
    } finally {
      window.clearTimeout(timeout);
      setGeneratingMessage(false);
    }
  }

  function openWhatsApp() {
    const lead = leads.find((item) => item.id === whatsAppAction?.leadId);
    if (!lead || !whatsAppAction) return;
    const url = buildWhatsAppUrl(lead.phone, message.trim());
    if (!url) {
      toast.error("Telefone invalido. Revise a ficha do lead.");
      return;
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("O navegador bloqueou a abertura do WhatsApp. Permita pop-ups e tente novamente.");
      return;
    }
    setWhatsAppStep("result");
  }

  async function registerWhatsAppOutcome(outcome: "sent" | "waiting" | "interested" | "visit" | "quote" | "lost") {
    if (!whatsAppAction || !handlers?.addInteraction) {
      toast.error("Nao foi possivel acessar o historico do lead.");
      return;
    }
    const lead = leads.find((item) => item.id === whatsAppAction.leadId);
    if (!lead) return;

    const result = outcomeConfig(outcome);
    setSavingOutcome(true);
    try {
      await handlers.addInteraction(
        lead.id,
        {
          interaction_type: "WhatsApp",
          responsible: lead.assigned_to ?? "Tiago",
          description: result.description,
          next_step: result.nextStep,
          next_contact_at: result.followUpDays ? addDays(new Date(), result.followUpDays).toISOString() : null,
        },
        { status: result.status },
      );
      if (whatsAppAction.taskId && handlers.completeTask) await handlers.completeTask(whatsAppAction.taskId);
      markCompleted(whatsAppAction);
      setWhatsAppAction(null);
      toast.success(result.successMessage);
    } catch {
      toast.error("Nao foi possivel registrar o resultado. A mensagem nao foi perdida.");
    } finally {
      setSavingOutcome(false);
    }
  }

  async function runAssistantShortcut(mode: AssistantMode) {
    const nextStrategy = mode === "reorganized"
      ? (strategy === "priority" ? "quick-wins" : "priority")
      : strategy;
    if (mode === "reorganized") {
      setStrategy(nextStrategy);
    }
    setAssistantMode(mode);
    const fallback = buildAssistantMessage(mode, summary, currentAction, completedCount, firstName, nextStrategy);
    const localSuggestion: AssistantEntry = {
      id: `plan:${mode}:${Date.now()}`,
      message: fallback,
      source: "plan",
      suggestedActionId: currentAction?.id ?? null,
      missingInformation: getMissingLeadFields(leads.find((lead) => lead.id === currentAction?.leadId)),
      suggestedQuestion: null,
    };

    if (!isOnline) {
      appendAssistantEntry(localSuggestion);
      return;
    }

    setAssistantProcessing(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("/api/ai/daily-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          profile_name: profileName ?? "",
          actions: visiblePlan.slice(0, 12).map((action) => ({
            id: action.id,
            title: action.title,
            reason: action.reason,
            context: action.context,
            stage: action.stage,
            source: action.source,
            estimated_minutes: action.estimatedMinutes,
            score: action.score,
            lead_name: action.leadName,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        suggested_action_id?: string | null;
        missing_information?: string[];
        suggested_question?: string | null;
      } | null;
      if (!response.ok || !payload?.message?.trim()) throw new Error("IA indisponivel");

      const actionId = visiblePlan.some((action) => action.id === payload.suggested_action_id) ? payload.suggested_action_id ?? null : null;
      setSuggestedActionId(actionId);
      appendAssistantEntry({
        id: `ai:${mode}:${Date.now()}`,
        message: payload.message.trim(),
        source: "ai",
        suggestedActionId: actionId,
        missingInformation: payload.missing_information ?? [],
        suggestedQuestion: payload.suggested_question ?? null,
      });
    } catch {
      appendAssistantEntry(localSuggestion);
    } finally {
      window.clearTimeout(timeout);
      setAssistantProcessing(false);
    }
  }

  function appendAssistantEntry(entry: AssistantEntry) {
    setAssistantEntries((current) => [...current, entry].slice(-5));
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="now-title" className="daily-action-glow relative overflow-hidden rounded-xl border border-primary/15 bg-card shadow-[0_24px_65px_-42px_rgb(13_43_54/0.72)]">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
        <div className="grid gap-0 xl:grid-cols-[1fr_280px]">
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-accent">
                  <CircleGauge className="size-4" />
                  Prioridade atual
                </div>
                <h2 id="now-title" className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">O que fazer agora</h2>
              </div>
              <DayProgress completed={completedCount} total={plannedTotal} value={progress} />
            </div>
            {currentAction ? (
              <ActionPanel
                action={currentAction}
                lead={leads.find((lead) => lead.id === currentAction.leadId)}
                onPrepareWhatsApp={prepareWhatsApp}
                onComplete={completeAction}
                onDefer={setDeferAction}
              />
            ) : (
              <AllDoneState onOpenLeads={() => setAssistantMode("attention")} />
            )}
          </div>
          <div className="border-t bg-primary px-5 py-5 text-primary-foreground xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase text-white/55">Contexto do dia</p>
            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
              <ContextStat label="Prioridades" value={summary.priorities} />
              <ContextStat label="Atrasadas" value={summary.overdue} tone={summary.overdue ? "warning" : "default"} />
              <ContextStat label="Tempo estimado" value={`${summary.estimatedMinutes} min`} />
            </div>
            <Button type="button" variant="accent" className="mt-4 min-h-11 w-full" onClick={startDay} disabled={!currentAction}>
              <Focus className="size-4" />
              Entrar no modo foco
            </Button>
          </div>
        </div>
      </section>

      <section id="nova-forma-ia" aria-labelledby="assistant-title" className="scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b bg-secondary/35 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-5 text-accent" />
            </span>
            <div className="min-w-0">
              <h2 id="assistant-title" className="font-semibold">Nova Forma IA</h2>
              <p className="truncate text-xs text-muted-foreground">Assistente de execucao · {isOnline ? "IA e dados atualizados" : "modo offline com regras locais"}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={assistantExpanded ? "Minimizar assistente" : "Expandir assistente"} onClick={() => setAssistantExpanded((value) => !value)}>
            {assistantExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
        {assistantExpanded ? (
          <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[1fr_1.2fr]">
            <div className="rounded-xl border border-primary/10 bg-primary px-4 py-4 text-primary-foreground shadow-sm sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-white/60">Orientacoes recentes</p>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/75">Dados reais do CRM</span>
              </div>
              <div className="space-y-3" aria-live="polite">
                {(assistantEntries.length ? assistantEntries : [{
                  id: "fallback",
                  message: assistantMessage,
                  source: "plan" as const,
                  suggestedActionId: recommendedAction?.id ?? null,
                  missingInformation: getMissingLeadFields(leads.find((lead) => lead.id === recommendedAction?.leadId)),
                  suggestedQuestion: null,
                }]).map((entry, index, entries) => {
                  const action = visiblePlan.find((item) => item.id === entry.suggestedActionId) ?? (index === entries.length - 1 ? recommendedAction : null);
                  const lead = leads.find((item) => item.id === action?.leadId);
                  return (
                    <div key={entry.id} className="rounded-xl border border-white/10 bg-white/6 p-3.5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", entry.source === "ai" ? "bg-accent text-accent-foreground" : "bg-white/12 text-white/75")}>
                          {entry.source === "ai" ? "Sugestao da IA" : "Plano comercial"}
                        </span>
                        {action ? <span className="text-[11px] text-white/58">Aproximadamente {action.estimatedMinutes} min</span> : null}
                      </div>
                      <p className="text-sm leading-6 text-white/85">{entry.message}</p>
                      {entry.missingInformation.length ? <p className="mt-2 text-xs leading-5 text-white/62">Confirmar: {entry.missingInformation.join(", ")}.</p> : null}
                      {entry.suggestedQuestion ? <p className="mt-2 rounded-lg bg-white/8 px-3 py-2 text-xs leading-5 text-white/82">Pergunta sugerida: {entry.suggestedQuestion}</p> : null}
                      {action && lead ? <AssistantLeadCard action={action} lead={lead} onPrepareWhatsApp={prepareWhatsApp} onDefer={setDeferAction} /> : null}
                    </div>
                  );
                })}
                {assistantProcessing ? (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-xs text-white/72">
                    <RefreshCw className="size-3.5 animate-spin text-accent" /> Nova Forma IA esta organizando a proxima decisao.
                  </div>
                ) : null}
              </div>
              {assistantMode === "end" && visiblePlan.length ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <Button type="button" variant="accent" size="sm" onClick={transferRemainingToTomorrow}>Transferir para amanha</Button>
                  <Button type="button" variant="outline" size="sm" className="border-white/20 bg-white/8 text-white hover:bg-white/14" onClick={() => setFullDayOpen(true)}>Revisar individualmente</Button>
                </div>
              ) : null}
              {currentAction ? (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{currentAction.leadName ?? currentAction.title}</p>
                    <p className="truncate text-xs text-white/58">{currentAction.stage} · {currentAction.estimatedMinutes} min</p>
                  </div>
                  <Button type="button" variant="accent" size="sm" onClick={() => currentAction.primaryAction === "whatsapp" ? prepareWhatsApp(currentAction) : setFocusOpen(true)}>
                    Executar
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Atalhos</p>
              <div className="flex flex-wrap gap-2">
                <AssistantShortcut icon={SunMedium} label="Comecar meu dia" onClick={startDay} />
                <AssistantShortcut icon={Sparkles} label="O que faco agora?" onClick={() => void runAssistantShortcut("welcome")} />
                <AssistantShortcut icon={ListChecks} label="Mostrar prioridades" onClick={() => void runAssistantShortcut("priorities")} />
                <AssistantShortcut icon={MessageCircle} label="Preparar WhatsApp" onClick={() => {
                  const action = visiblePlan.find((item) => item.primaryAction === "whatsapp");
                  if (action) {
                    void runAssistantShortcut("welcome");
                    void prepareWhatsApp(action);
                  }
                  else toast.info("Nenhuma mensagem prioritaria neste momento.");
                }} />
                <AssistantShortcut icon={AlertTriangle} label="Ver tarefas atrasadas" onClick={() => void runAssistantShortcut("overdue")} />
                <AssistantShortcut icon={RefreshCw} label="Reorganizar meu dia" onClick={() => void runAssistantShortcut("reorganized")} />
                <AssistantShortcut icon={UserRoundSearch} label="Leads precisam de atencao" onClick={() => void runAssistantShortcut("attention")} />
                <AssistantShortcut icon={MoonStar} label="Encerrar meu dia" onClick={() => void runAssistantShortcut("end")} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {automationLevel === "assisted" ? "Modo assistido: cada alteracao exige sua confirmacao." : automationLevel === "automatic" ? "Modo automatico: apenas organizacoes internas seguras sao automaticas." : "Modo semiautomatico: mensagens e resultados sempre aguardam sua confirmacao."}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section id="meu-dia" aria-labelledby="my-day-title" className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">Plano executavel</p>
            <h2 id="my-day-title" className="mt-1 text-xl font-semibold">Meu dia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.priorities} prioridades · {summary.followUps} follow-ups · {summary.visits} visitas · {summary.overdue} atrasadas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setFullDayOpen(true)}>
              <ListChecks className="size-4" />
              Ver todo o dia
            </Button>
            <Button type="button" onClick={() => setFocusOpen(true)} disabled={!currentAction}>
              <Focus className="size-4" />
              Modo foco
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-3">
          {visiblePlan.slice(0, 3).map((action, index) => (
            <button key={action.id} type="button" onClick={() => index === 0 ? setFocusOpen(true) : setFullDayOpen(true)} className="group flex min-h-24 items-start gap-3 rounded-xl border bg-secondary/30 p-3 text-left transition hover:border-primary/20 hover:bg-secondary/55 hover:shadow-sm">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", index === 0 ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground ring-1 ring-border")}>{index + 1}</span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-semibold group-hover:text-primary">{action.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{action.estimatedMinutes} min · {action.stage}</span>
              </span>
            </button>
          ))}
          {!visiblePlan.length ? <p className="col-span-full rounded-xl border border-dashed bg-secondary/25 p-4 text-sm text-muted-foreground">Nenhuma acao pendente. Novas tarefas e leads entram automaticamente neste plano.</p> : null}
        </div>
      </section>

      <Dialog open={focusOpen} onOpenChange={setFocusOpen}>
        <DialogContent className="max-h-[96dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-0 sm:w-[calc(100%-2rem)]">
          <div className="border-b bg-primary p-5 text-primary-foreground sm:p-6">
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-accent">
                <Focus className="size-4" />
                Modo foco
              </div>
              <DialogTitle className="text-xl text-white">Uma acao por vez</DialogTitle>
              <DialogDescription className="text-white/65">Sem ruido. Conclua, adie ou abra o contexto e o plano apresenta o proximo passo.</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <DayProgress completed={completedCount} total={plannedTotal} value={progress} inverse />
            </div>
          </div>
          <div className="p-4 sm:p-7">
            {currentAction ? (
              <ActionPanel
                action={currentAction}
                lead={leads.find((lead) => lead.id === currentAction.leadId)}
                focus
                onPrepareWhatsApp={prepareWhatsApp}
                onComplete={completeAction}
                onDefer={setDeferAction}
              />
            ) : (
              <AllDoneState onOpenLeads={() => setFocusOpen(false)} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullDayOpen} onOpenChange={setFullDayOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Plano completo de hoje</DialogTitle>
            <DialogDescription>Compromissos e atrasos permanecem no topo. Sugestoes sem prazo nunca passam na frente deles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {visiblePlan.map((action, index) => (
              <div key={action.id} className="flex items-start gap-3 rounded-xl border bg-secondary/25 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-xs font-bold ring-1 ring-border">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{action.title}</p>
                    {action.overdueDays ? <Badge variant="danger">{action.overdueDays}d atrasada</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{action.estimatedMinutes} min</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deferAction)} onOpenChange={(open) => !open && setDeferAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nao consegue fazer agora?</DialogTitle>
            <DialogDescription>Escolha apenas quando esta acao deve voltar. O restante do dia sera reorganizado automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="min-h-12 justify-start" onClick={() => deferAction && postponeAction(deferAction, "1h")}>
              <TimerReset className="size-4" /> Em 1 hora
            </Button>
            <Button type="button" variant="outline" className="min-h-12 justify-start" onClick={() => deferAction && postponeAction(deferAction, "3h")}>
              <Clock3 className="size-4" /> Em 3 horas
            </Button>
            <Button type="button" variant="outline" className="min-h-12 justify-start" onClick={() => deferAction && postponeAction(deferAction, "tomorrow")}>
              <CalendarClock className="size-4" /> Amanha as 9h
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(whatsAppAction)} onOpenChange={(open) => !open && setWhatsAppAction(null)}>
        <DialogContent className="max-w-2xl">
          {whatsAppStep === "preview" ? (
            <>
              <DialogHeader>
                <DialogTitle>Mensagem preparada para revisao</DialogTitle>
                <DialogDescription>A IA ou o template apenas preparou o texto. Revise antes de abrir o WhatsApp.</DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                Confirme nome, contexto e proximo passo. Nenhuma mensagem sera enviada automaticamente.
              </div>
              <Textarea aria-label="Mensagem para WhatsApp" value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-48" />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setWhatsAppAction(null)}>Cancelar</Button>
                <Button type="button" onClick={openWhatsApp} disabled={generatingMessage || !message.trim()}>
                  {generatingMessage ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {generatingMessage ? "Personalizando..." : "Abrir WhatsApp"}
                </Button>
              </div>
            </>
          ) : whatsAppStep === "result" ? (
            <>
              <DialogHeader>
                <DialogTitle>Voce conseguiu enviar a mensagem?</DialogTitle>
                <DialogDescription>O CRM so registra o contato depois da sua confirmacao.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Button type="button" className="min-h-12 justify-start" disabled={savingOutcome} onClick={() => registerWhatsAppOutcome("sent")}>
                  <Check className="size-4" /> Sim, foi enviada
                </Button>
                <Button type="button" variant="outline" className="min-h-12 justify-start" disabled={savingOutcome} onClick={() => setWhatsAppStep("reply-result")}>
                  <MessageCircle className="size-4" /> Enviei e o cliente respondeu
                </Button>
                <Button type="button" variant="outline" className="min-h-12 justify-start" onClick={() => setWhatsAppAction(null)}>
                  Ainda nao enviei
                </Button>
                <Button type="button" variant="ghost" className="min-h-12 justify-start" onClick={() => {
                  const action = whatsAppAction;
                  setWhatsAppAction(null);
                  setDeferAction(action);
                }}>
                  Quero adiar
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Qual foi o resultado?</DialogTitle>
                <DialogDescription>Escolha uma opcao para atualizar o lead e preparar o acompanhamento.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                <OutcomeButton label="Aguardando nova resposta" onClick={() => registerWhatsAppOutcome("waiting")} disabled={savingOutcome} />
                <OutcomeButton label="Demonstrou interesse" onClick={() => registerWhatsAppOutcome("interested")} disabled={savingOutcome} />
                <OutcomeButton label="Visita agendada" onClick={() => registerWhatsAppOutcome("visit")} disabled={savingOutcome} />
                <OutcomeButton label="Pediu orcamento" onClick={() => registerWhatsAppOutcome("quote")} disabled={savingOutcome} />
                <OutcomeButton label="Nao tem interesse" onClick={() => registerWhatsAppOutcome("lost")} disabled={savingOutcome} destructive />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionPanel({
  action,
  lead,
  focus = false,
  onPrepareWhatsApp,
  onComplete,
  onDefer,
}: {
  action: DailyAction;
  lead?: Lead;
  focus?: boolean;
  onPrepareWhatsApp: (action: DailyAction) => Promise<void>;
  onComplete: (action: DailyAction) => Promise<void>;
  onDefer: (action: DailyAction) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={action.overdueDays ? "danger" : action.score >= 700 ? "warning" : "secondary"}>{actionLabel(action)}</Badge>
        <Badge variant="outline">{action.stage}</Badge>
        {action.dueAt ? <span className="text-xs font-medium text-muted-foreground">{formatActionDate(action.dueAt)}</span> : null}
      </div>
      <h3 className={cn("mt-3 font-semibold text-foreground", focus ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl")}>{action.title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{action.reason}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4 text-accent" /> Estimativa: {action.estimatedMinutes} minutos</span>
        {lead ? <span>{[lead.source, lead.city, lead.neighborhood].filter(Boolean).join(" · ")}</span> : null}
      </div>
      {action.context ? <p className="mt-3 rounded-xl border bg-secondary/30 px-3 py-2.5 text-sm text-muted-foreground">{action.context}</p> : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {action.primaryAction === "whatsapp" ? (
          <Button type="button" variant="accent" className="min-h-12 sm:min-h-10" onClick={() => onPrepareWhatsApp(action)}>
            <MessageCircle className="size-4" /> Preparar WhatsApp
          </Button>
        ) : action.leadId ? (
          <Button asChild className="min-h-12 sm:min-h-10">
            <Link href={`/leads/${action.leadId}`}><ExternalLink className="size-4" /> Abrir contexto</Link>
          </Button>
        ) : (
          <Button type="button" className="min-h-12 sm:min-h-10" onClick={() => onComplete(action)}><CheckCircle2 className="size-4" /> Concluir</Button>
        )}
        {action.leadId && action.primaryAction === "whatsapp" ? (
          <Button asChild variant="outline" className="min-h-12 sm:min-h-10">
            <Link href={`/leads/${action.leadId}`}><ExternalLink className="size-4" /> Ver contexto</Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="min-h-12 sm:min-h-10" onClick={() => onDefer(action)}><TimerReset className="size-4" /> Adiar</Button>
        {action.taskId ? <Button type="button" variant="ghost" className="min-h-12 sm:min-h-10" onClick={() => onComplete(action)}><Check className="size-4" /> Concluir</Button> : null}
        <Button type="button" variant="ghost" className="min-h-12 sm:min-h-10" onClick={() => onDefer(action)}>Nao consigo fazer agora</Button>
      </div>
    </div>
  );
}

function AssistantLeadCard({
  action,
  lead,
  onPrepareWhatsApp,
  onDefer,
}: {
  action: DailyAction;
  lead: Lead;
  onPrepareWhatsApp: (action: DailyAction) => Promise<void>;
  onDefer: (action: DailyAction) => void;
}) {
  const hot = lead.lead_score >= 70;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{lead.name}</p>
          <p className="mt-0.5 text-xs text-white/62">{hot ? "Lead quente" : lead.status} · {lead.source}</p>
        </div>
        <span className="shrink-0 text-[11px] text-white/58">{leadWaitLabel(lead)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {action.primaryAction === "whatsapp" ? (
          <Button type="button" variant="accent" size="sm" onClick={() => void onPrepareWhatsApp(action)}>
            <MessageCircle className="size-3.5" /> Preparar WhatsApp
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/8 text-white hover:bg-white/14">
          <Link href={`/leads/${lead.id}`}><ExternalLink className="size-3.5" /> Ver contexto</Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => onDefer(action)}>
          <TimerReset className="size-3.5" /> Adiar
        </Button>
      </div>
    </div>
  );
}

function DayProgress({ completed, total, value, inverse = false }: { completed: number; total: number; value: number; inverse?: boolean }) {
  return (
    <div className="min-w-44">
      <div className={cn("mb-1.5 flex items-center justify-between text-xs", inverse ? "text-white/70" : "text-muted-foreground")}>
        <span>{completed} de {total} concluidas</span>
        <span>{value}%</span>
      </div>
      <Progress value={value} className={cn("h-2", inverse && "bg-white/15")} />
    </div>
  );
}

function ContextStat({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "warning" }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/6 px-3 py-2.5", tone === "warning" && "border-amber-300/20 bg-amber-300/8")}>
      <p className="text-[11px] text-white/55">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function AssistantShortcut({ icon: Icon, label, onClick }: { icon: typeof Sparkles; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary/25 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
      <Icon className="size-3.5 text-accent" /> {label}
    </button>
  );
}

function OutcomeButton({ label, onClick, disabled, destructive = false }: { label: string; onClick: () => void; disabled: boolean; destructive?: boolean }) {
  return <Button type="button" variant={destructive ? "destructive" : "outline"} className="min-h-12 justify-start" onClick={onClick} disabled={disabled}>{label}</Button>;
}

function AllDoneState({ onOpenLeads }: { onOpenLeads: () => void }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-secondary/25 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="size-6" /></span>
      <h3 className="mt-3 text-lg font-semibold">Fila principal em dia</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">Nao ha uma acao urgente agora. Novos leads, tarefas e follow-ups entram automaticamente quando precisarem de atencao.</p>
      <Button asChild variant="outline" className="mt-4"><Link href="/leads" onClick={onOpenLeads}>Revisar leads</Link></Button>
    </div>
  );
}

function buildFallbackMessage(lead: Lead, action: DailyAction, templates: MessageTemplate[]) {
  const available = getTemplatesWithDefaults(templates);
  const category = action.suggestedTemplateCategory;
  const template = available.find((item) => item.category === category && /natural/i.test(item.title))
    ?? available.find((item) => item.category === category)
    ?? available.find((item) => item.category === "Primeiro contato");
  if (template) return applyTemplate(template.content, lead).replace(/\s+([,.!?])/g, "$1").replace(/ {2,}/g, " ").trim();
  const firstName = lead.name.split(" ")[0] || lead.name;
  return `Oi, ${firstName}! Tudo bem? Aqui e o Tiago da Nova Forma Steel Frame. Queria retomar nossa conversa e entender qual e o melhor proximo passo para sua obra.`;
}

function buildAssistantMessage(mode: AssistantMode, summary: ReturnType<typeof summarizeDailyPlan>, action: DailyAction | null, completed: number, name: string, strategy: "priority" | "quick-wins") {
  if (mode === "start") return `Bom dia, ${name}. Hoje voce tem ${summary.overdue} acoes atrasadas, ${summary.followUps} follow-ups e ${summary.visits} compromissos de visita ou reuniao. Preparei uma sequencia com ${summary.total} acoes. A primeira deve levar aproximadamente ${action?.estimatedMinutes ?? 0} minutos.`;
  if (mode === "priorities") return action ? `Suas prioridades estao ordenadas por horario, atraso e risco comercial. A primeira e “${action.title}” porque ${lowerFirst(action.reason)}` : "Nao ha prioridades pendentes neste momento.";
  if (mode === "overdue") return summary.overdue ? `Existem ${summary.overdue} acoes atrasadas. Elas permanecem no topo ate serem concluidas ou reagendadas, sem culpabilizar voce pelo atraso.` : "Boa noticia: nao ha tarefas ou follow-ups atrasados agora.";
  if (mode === "attention") return summary.hotLeads ? `Encontrei ${summary.hotLeads} leads quentes na fila de atencao. A ordem considera score, tempo sem contato e etapa comercial.` : "Nenhum lead quente esta esquecido. Continue pelo plano atual.";
  if (mode === "reorganized") return strategy === "quick-wins" ? "Reorganizei tarefas de urgencia equivalente para mostrar primeiro as mais rapidas. Horarios e atrasos reais continuam protegidos no topo." : "Voltei para a ordem comercial padrao, priorizando compromissos, atrasos e risco de perder oportunidades.";
  if (mode === "end") return `Hoje voce concluiu ${completed} acoes. Permanecem ${summary.total}; nenhuma sera descartada. Voce pode reagendar agora ou deixar o CRM reorganizar a fila de amanha.`;
  return action ? `Recomendo comecar por “${action.title}”. ${action.reason} O contexto foi resumido e a execucao esta a um toque.` : `Seu plano esta em dia, ${name}. Vou continuar observando novos leads, prazos e follow-ups.`;
}

function getMissingLeadFields(lead?: Lead) {
  if (!lead) return [];

  return [
    !lead.city && "cidade",
    !lead.neighborhood && "bairro",
    lead.has_land == null && "terreno",
    lead.has_blueprint == null && "planta/projeto",
    !lead.desired_start_time && "prazo para iniciar",
  ].filter(Boolean).slice(0, 3) as string[];
}

function leadWaitLabel(lead: Lead) {
  const reference = lead.last_contact_at ?? lead.created_at;
  const minutes = Math.max(0, differenceInMinutes(new Date(), parseISO(reference)));
  if (minutes < 60) return `Aguardando ha ${Math.max(1, minutes)} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Aguardando ha ${hours} h`;

  return `Sem contato ha ${Math.floor(hours / 24)} dias`;
}

function outcomeConfig(outcome: "sent" | "waiting" | "interested" | "visit" | "quote" | "lost") {
  const map = {
    sent: { description: "Mensagem enviada pelo plano diario.", nextStep: "Verificar retorno do cliente", followUpDays: 2, status: "Aguardando resposta" as const, successMessage: "Contato registrado e follow-up criado." },
    waiting: { description: "Cliente respondeu; conversa aguardando nova resposta.", nextStep: "Retomar conversa", followUpDays: 2, status: "Aguardando resposta" as const, successMessage: "Resultado registrado e acompanhamento preparado." },
    interested: { description: "Cliente respondeu e demonstrou interesse.", nextStep: "Qualificar dados e combinar proximo passo", followUpDays: 1, status: "Qualificado" as const, successMessage: "Lead qualificado e proximo passo criado." },
    visit: { description: "Cliente respondeu e confirmou interesse em visita.", nextStep: "Confirmar data e horario da visita", followUpDays: 1, status: "Visita marcada" as const, successMessage: "Visita registrada e confirmacao adicionada ao plano." },
    quote: { description: "Cliente respondeu e solicitou orcamento.", nextStep: "Preparar ou validar orcamento", followUpDays: 1, status: "Orcamento a enviar" as const, successMessage: "Solicitacao de orcamento registrada." },
    lost: { description: "Cliente informou que nao tem interesse neste momento.", nextStep: undefined, followUpDays: 0, status: "Perdido" as const, successMessage: "Resultado confirmado e lead atualizado." },
  };
  return map[outcome];
}

function actionLabel(action: DailyAction) {
  if (action.kind === "scheduled") return "Compromisso com horario";
  if (action.overdueDays) return `${action.overdueDays}d atrasada`;
  if (action.kind === "new-lead") return "Novo lead";
  if (action.kind === "hot-lead") return "Lead quente";
  if (action.kind === "proposal-follow-up") return "Orcamento aguardando";
  if (action.kind === "stalled-negotiation") return "Negociacao parada";
  return action.priority;
}

function formatActionDate(value: string) {
  const date = parseISO(value);
  return isToday(date) ? `Hoje, ${format(date, "HH:mm", { locale: ptBR })}` : format(date, "dd/MM, HH:mm", { locale: ptBR });
}

function localDateKey() {
  return format(new Date(), "yyyy-MM-dd");
}

function dayStorageKey(date: string) {
  return `novaforma:daily-execution:${date}`;
}

function emptyDayState(date: string): DayExecutionState {
  return { date, plannedActionIds: [], completedActionIds: [], deferredActionIds: [], startedAt: null };
}

function persistDayState(state: DayExecutionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(dayStorageKey(state.date), JSON.stringify(state));
}

function lowerFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}
