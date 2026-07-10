"use client";

import * as React from "react";
import Link from "next/link";
import {
  addDays,
  addHours,
  addMinutes,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  parseISO,
  startOfToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit,
  ExternalLink,
  Filter,
  Lightbulb,
  MessageSquareText,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/empty-state";
import { LeadPriorityBadge } from "@/components/lead-badges";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCrmData } from "@/hooks/use-crm-data";
import { copyTextToClipboard } from "@/lib/clipboard";
import { priorities } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus, Priority, Task } from "@/lib/types";

type TaskStatusFilter = "Todos" | "Pendentes" | "Atrasadas" | "Concluidas";
type TaskPriorityFilter = "Todas" | Priority;
type TaskFormState = {
  id?: string;
  lead_id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  priority: Priority;
  status: Task["status"];
  responsible: string;
  created_at?: string;
};

export default function TasksPage() {
  const { tasks, leads, loading, completeTask, deleteTask, saveTask, saveTasks, updateLead } = useCrmData();
  const [creatingForLead, setCreatingForLead] = React.useState<string | null>(null);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<TaskStatusFilter>("Todos");
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriorityFilter>("Todas");
  const [dateFilter, setDateFilter] = React.useState("");

  if (loading) return <LoadingSkeleton />;

  const siteLeads = leads
    .filter((lead) => lead.source === "Site" && ["Novo lead", "Aguardando resposta", "Em triagem"].includes(lead.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredTasks = tasks.filter((task) => {
    const taskDate = parseISO(task.due_date);
    const overdue = isTaskOverdue(task);
    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Pendentes" && task.status === "pendente" && !overdue) ||
      (statusFilter === "Atrasadas" && overdue) ||
      (statusFilter === "Concluidas" && task.status === "concluida");
    const matchesPriority = priorityFilter === "Todas" || task.priority === priorityFilter;
    const matchesDate = !dateFilter || isSameDay(taskDate, parseLocalDate(dateFilter));
    return matchesStatus && matchesPriority && matchesDate;
  });

  const openTasks = filteredTasks.filter((task) => task.status !== "concluida");
  const overdueTasks = openTasks.filter(isTaskOverdue).sort(sortTasksByDueDate);
  const todayTasks = openTasks.filter((task) => !isTaskOverdue(task) && isToday(parseISO(task.due_date))).sort(sortTasksByDueDate);
  const upcomingTasks = openTasks
    .filter((task) => !isTaskOverdue(task) && !isToday(parseISO(task.due_date)) && isAfter(parseISO(task.due_date), startOfToday()))
    .sort(sortTasksByDueDate);
  const completedTasks = filteredTasks.filter((task) => task.status === "concluida").sort(sortTasksByDueDateDesc);

  async function createAutomation(lead: Lead) {
    const plan = buildSiteLeadAutomation(lead);
    const firstStep = plan.tasks[0];
    setCreatingForLead(lead.id);
    try {
      await saveTasks(plan.tasks);
      await updateLead(lead.id, {
        status: lead.status === "Novo lead" ? ("Em triagem" as LeadStatus) : lead.status,
        next_action_at: firstStep.due_date,
      });
    } finally {
      setCreatingForLead(null);
    }
  }

  async function saveTaskFromForm(form: TaskFormState) {
    await saveTask({
      id: form.id,
      lead_id: form.lead_id === "none" ? null : form.lead_id,
      title: form.title,
      description: form.description,
      due_date: combineDateTime(form.date, form.time),
      priority: form.priority,
      status: form.status,
      responsible: form.responsible,
      created_at: form.created_at,
    });
    setEditingTask(null);
  }

  function clearFilters() {
    setStatusFilter("Todos");
    setPriorityFilter("Todas");
    setDateFilter("");
  }

  return (
    <div className="space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Acoes comerciais</h1>
            <p className="mt-1 max-w-3xl text-sm text-white/72">
              Organize follow-ups, visitas, retomadas de orcamento e proximos passos comerciais com tarefas reais vinculadas aos leads.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TaskMetric title="Hoje" value={todayTasks.length} />
        <TaskMetric title="Atrasadas" value={overdueTasks.length} tone={overdueTasks.length ? "danger" : "default"} />
        <TaskMetric title="Proximas" value={upcomingTasks.length} />
        <TaskMetric title="Concluidas" value={completedTasks.length} tone="success" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-accent" />
              <CardTitle>Novos leads do site</CardTitle>
            </div>
            <CardDescription>Escolha um lead para gerar uma sequencia de atendimento com tarefas, horarios e roteiro de mensagem.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {siteLeads.length ? (
              siteLeads.slice(0, 6).map((lead) => (
                <AutomationLeadCard key={lead.id} lead={lead} tasks={tasks} creating={creatingForLead === lead.id} onCreate={() => createAutomation(lead)} />
              ))
            ) : (
              <EmptyState icon={ClipboardList} title="Sem novos leads do site" description="Quando um lead chegar pelo site com status inicial, ele aparece aqui para receber o roteiro automatizado." />
            )}
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="size-5 text-accent" />
              <CardTitle>Roteiro padrao recomendado</CardTitle>
            </div>
            <CardDescription>Fluxo pensado para Nova Forma Steel Frame, do primeiro WhatsApp ate a visita ou proximo passo tecnico.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {defaultPlaybook.map((step, index) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</div>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <div className="space-y-4">
          <TaskForm task={editingTask} leads={leads} onCancel={() => setEditingTask(null)} onSave={saveTaskFromForm} />
          <TaskFilters
            status={statusFilter}
            priority={priorityFilter}
            date={dateFilter}
            onStatusChange={setStatusFilter}
            onPriorityChange={setPriorityFilter}
            onDateChange={setDateFilter}
            onClear={clearFilters}
          />
        </div>

        <div className="space-y-4">
          <TaskSection
            title="Acoes de hoje"
            description="Tarefas abertas com vencimento hoje."
            tasks={todayTasks}
            leads={leads}
            empty="Nenhuma acao para hoje."
            onEdit={setEditingTask}
            onComplete={completeTask}
            onDelete={deleteTask}
          />
          <TaskSection
            title="Acoes atrasadas"
            description="Pendencias abertas com data menor que hoje."
            tasks={overdueTasks}
            leads={leads}
            empty="Nenhuma acao atrasada."
            tone="danger"
            onEdit={setEditingTask}
            onComplete={completeTask}
            onDelete={deleteTask}
          />
          <TaskSection
            title="Proximas acoes"
            description="Follow-ups e compromissos futuros."
            tasks={upcomingTasks}
            leads={leads}
            empty="Nenhuma proxima acao agendada."
            onEdit={setEditingTask}
            onComplete={completeTask}
            onDelete={deleteTask}
          />
          <TaskSection
            title="Acoes concluidas"
            description="Historico recente de tarefas finalizadas."
            tasks={completedTasks}
            leads={leads}
            empty="Nenhuma acao concluida ainda."
            tone="success"
            onEdit={setEditingTask}
            onComplete={completeTask}
            onDelete={deleteTask}
          />
        </div>
      </section>
    </div>
  );
}

function TaskMetric({ title, value, tone = "default" }: { title: string; value: number; tone?: "default" | "danger" | "success" }) {
  return (
    <Card className={cn("transition duration-200 hover:-translate-y-0.5 hover:shadow-lg", tone === "danger" && "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/18", tone === "success" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/18")}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <span className={cn("flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground", tone === "danger" && "bg-red-100 text-red-700", tone === "success" && "bg-emerald-100 text-emerald-700")}>
          <CalendarClock className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function TaskFilters({
  status,
  priority,
  date,
  onStatusChange,
  onPriorityChange,
  onDateChange,
  onClear,
}: {
  status: TaskStatusFilter;
  priority: TaskPriorityFilter;
  date: string;
  onStatusChange: (value: TaskStatusFilter) => void;
  onPriorityChange: (value: TaskPriorityFilter) => void;
  onDateChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4 text-accent" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Status">
          <Select value={status} onValueChange={(value) => onStatusChange(value as TaskStatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Todos", "Pendentes", "Atrasadas", "Concluidas"].map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select value={priority} onValueChange={(value) => onPriorityChange(value as TaskPriorityFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas</SelectItem>
              {priorities.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </Field>
        <Button type="button" variant="outline" className="w-full" onClick={onClear}>
          <X className="size-4" />
          Limpar filtros
        </Button>
      </CardContent>
    </Card>
  );
}

function TaskForm({
  task,
  leads,
  onSave,
  onCancel,
}: {
  task: Task | null;
  leads: Lead[];
  onSave: (task: TaskFormState) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<TaskFormState>(() => buildEmptyTaskForm());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(task ? taskToForm(task) : buildEmptyTaskForm());
  }, [task]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o titulo da tarefa.");
      return;
    }
    if (!form.date) {
      toast.error("Informe a data da tarefa.");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      if (!task) setForm(buildEmptyTaskForm());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {task ? <Edit className="size-4 text-accent" /> : <Plus className="size-4 text-accent" />}
          {task ? "Editar tarefa" : "Nova tarefa"}
        </CardTitle>
        <CardDescription>{task ? "Atualize o proximo passo comercial." : "Crie uma acao especifica para follow-up, visita ou orcamento."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Lead relacionado">
            <Select value={form.lead_id} onValueChange={(value) => setForm((current) => ({ ...current, lead_id: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem lead vinculado</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Titulo">
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Confirmar visita tecnica" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <Field label="Horario opcional">
              <Input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
            </Field>
          </div>
          <Field label="Prioridade">
            <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as Priority }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as Task["status"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="concluida">Concluida</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsavel">
            <Input value={form.responsible} onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))} placeholder="Tiago" />
          </Field>
          <Field label="Descricao">
            <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Contexto do proximo passo" />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            {task ? (
              <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
            <Button className="w-full" disabled={saving}>
              {saving ? "Salvando..." : task ? "Salvar alteracoes" : "Criar tarefa"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TaskSection({
  title,
  description,
  tasks,
  leads,
  empty,
  tone,
  onEdit,
  onComplete,
  onDelete,
}: {
  title: string;
  description: string;
  tasks: Task[];
  leads: Lead[];
  empty: string;
  tone?: "danger" | "success";
  onEdit: (task: Task) => void;
  onComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <Card className={cn("overflow-hidden", tone === "danger" && "border-red-200", tone === "success" && "border-emerald-200")}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={tone === "danger" ? "danger" : tone === "success" ? "success" : "secondary"}>{tasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length ? (
          tasks.map((task) => {
            const lead = leads.find((item) => item.id === task.lead_id);
            return <TaskCard key={task.id} task={task} lead={lead} overdue={isTaskOverdue(task)} onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />;
          })
        ) : (
          <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  lead,
  overdue,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: Task;
  lead?: Lead;
  overdue: boolean;
  onEdit: (task: Task) => void;
  onComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [completing, setCompleting] = React.useState(false);
  const displayDate = formatTaskDate(task.due_date);

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md", overdue && "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/18")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{task.title}</h3>
            <LeadPriorityBadge priority={task.priority} />
            <TaskStatusBadge task={task} overdue={overdue} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{task.description || "Sem descricao."}</p>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
            <TaskMeta label="Lead" value={lead?.name ?? "Sem lead relacionado"} />
            <TaskMeta label="Data" value={displayDate.date} />
            <TaskMeta label="Horario" value={displayDate.time} />
            <TaskMeta label="Responsavel" value={task.responsible || "Tiago"} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {lead ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/leads/${lead.id}`}>
                  <ExternalLink className="size-4" />
                  Lead
                </Link>
              </Button>
              <WhatsAppButton lead={lead} size="sm" />
            </>
          ) : null}
          {task.status !== "concluida" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={completing}
              onClick={async () => {
                setCompleting(true);
                try {
                  await onComplete(task.id);
                } finally {
                  setCompleting(false);
                }
              }}
            >
              <CheckCircle2 className="size-4" />
              Concluir
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
            <Edit className="size-4" />
            Editar
          </Button>
          <DeleteTaskDialog task={task} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}

function TaskStatusBadge({ task, overdue }: { task: Task; overdue: boolean }) {
  if (task.status === "concluida") return <Badge variant="success">Concluida</Badge>;
  if (overdue) return <Badge variant="danger">Atrasada</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

function TaskMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-secondary/45 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function DeleteTaskDialog({ task, onDelete }: { task: Task; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2 className="size-4 text-destructive" />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acao remove permanentemente a tarefa <strong>{task.title}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={async (event) => {
              event.preventDefault();
              setDeleting(true);
              try {
                await onDelete(task.id);
                setOpen(false);
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AutomationLeadCard({
  lead,
  tasks,
  creating,
  onCreate,
}: {
  lead: Lead;
  tasks: Task[];
  creating: boolean;
  onCreate: () => Promise<void>;
}) {
  const plan = buildSiteLeadAutomation(lead);
  const alreadyCreated = tasks.some((task) => task.lead_id === lead.id && task.title.startsWith("Roteiro site"));

  async function copyScript() {
    try {
      await copyTextToClipboard(plan.script);
      toast.success("Roteiro copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel copiar o roteiro.");
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{lead.name}</h3>
            {alreadyCreated ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-900/50">
                <CheckCircle2 className="size-3" />
                roteiro criado
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Cidade e bairro a confirmar"} - {lead.phone}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{plan.reason}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyScript}>
            <Copy className="size-4" />
            Copiar roteiro
          </Button>
          <Button size="sm" disabled={creating || alreadyCreated} onClick={onCreate}>
            <Sparkles className="size-4" />
            {creating ? "Criando..." : alreadyCreated ? "Criado" : "Criar acoes"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/leads/${lead.id}`}>
              <ExternalLink className="size-4" />
              Ver lead
            </Link>
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="grid gap-3 lg:grid-cols-[1fr_.9fr]">
        <div className="rounded-xl border bg-secondary/45 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="size-4 text-accent" />
            Mensagem sugerida
          </div>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{plan.script}</p>
        </div>
        <div className="space-y-2">
          {plan.tasks.map((task, index) => (
            <div key={task.title} className="rounded-xl border bg-background/70 p-3 shadow-xs">
              <p className="text-sm font-medium">
                {index + 1}. {task.title.replace(` - ${lead.name}`, "")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(task.due_date), "dd/MM HH:mm", { locale: ptBR })} - {task.priority}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function buildEmptyTaskForm(): TaskFormState {
  return {
    lead_id: "none",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    priority: "Media",
    status: "pendente",
    responsible: "Tiago",
  };
}

function taskToForm(task: Task): TaskFormState {
  const date = parseISO(task.due_date);
  const time = format(date, "HH:mm") === "12:00" ? "" : format(date, "HH:mm");
  return {
    id: task.id,
    lead_id: task.lead_id ?? "none",
    title: task.title,
    description: task.description ?? "",
    date: format(date, "yyyy-MM-dd"),
    time,
    priority: task.priority,
    status: task.status,
    responsible: task.responsible ?? "Tiago",
    created_at: task.created_at,
  };
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "12:00"}:00`).toISOString();
}

function parseLocalDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatTaskDate(date: string) {
  const parsed = parseISO(date);
  const time = format(parsed, "HH:mm");
  return {
    date: format(parsed, "dd/MM/yyyy", { locale: ptBR }),
    time: time === "12:00" ? "Horario nao definido" : time,
  };
}

function isTaskOverdue(task: Task) {
  return task.status === "atrasada" || (task.status === "pendente" && isBefore(parseISO(task.due_date), startOfToday()));
}

function sortTasksByDueDate(a: Task, b: Task) {
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

function sortTasksByDueDateDesc(a: Task, b: Task) {
  return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
}

const defaultPlaybook = [
  {
    title: "Responder em ate 15 minutos",
    description: "Abrir conversa com contexto do site, confirmar interesse e pedir as informacoes minimas para qualificar.",
  },
  {
    title: "Qualificar terreno, planta e metragem",
    description: "Identificar cidade/bairro, se ja tem terreno, planta/projeto, metragem aproximada, prazo e faixa de investimento.",
  },
  {
    title: "Direcionar para visita sem compromisso",
    description: "Quando houver cidade/terreno ou interesse real, propor visita tecnica para entender acesso, recuos e escopo.",
  },
  {
    title: "Follow-up se nao responder",
    description: "Retomar em 24 a 48 horas com uma mensagem curta e consultiva, sem pressionar.",
  },
  {
    title: "Proximo passo tecnico/comercial",
    description: "Depois da resposta, encaminhar para visita, analise de planta ou estimativa responsavel.",
  },
];

function buildSiteLeadAutomation(lead: Lead) {
  const now = new Date();
  const missing = [
    !lead.city && !lead.neighborhood ? "cidade/bairro" : null,
    !lead.has_land ? "se ja possui terreno" : null,
    !lead.has_blueprint ? "se ja tem planta/projeto" : null,
    !lead.approximate_area ? "metragem aproximada" : null,
    !lead.desired_start_time ? "prazo para iniciar" : null,
    !lead.budget_range ? "faixa de investimento" : null,
  ].filter(Boolean);

  const firstName = lead.name.split(" ")[0] || lead.name;
  const context = [lead.city, lead.neighborhood].filter(Boolean).join(" / ");
  const script = [
    `Ola, ${firstName}! Tudo bem? Aqui e o Tiago da Nova Forma Steel Frame.`,
    `Vi seu contato pelo site e queria entender melhor sua ideia de obra${context ? ` em ${context}` : ""}.`,
    missing.length
      ? `Para eu te orientar com mais precisao, pode me confirmar: ${missing.join(", ")}?`
      : "Pelo que voce ja enviou, consigo avancar para uma analise mais objetiva do proximo passo.",
    "Se fizer sentido, o ideal e marcarmos uma visita sem compromisso para avaliar o local e te passar uma estimativa mais responsavel.",
  ].join("\n\n");

  const qualification = [
    "Checklist de qualificacao:",
    "- Cidade/bairro e endereco aproximado",
    "- Terreno: existe, medidas, acesso e restricoes",
    "- Planta/projeto: PDF, imagem ou referencia",
    "- Metragem e padrao esperado",
    "- Prazo para iniciar e urgencia",
    "- Se busca chave na mao, mao de obra ou assessoria",
  ].join("\n");

  const tasks: Array<Partial<Task> & Pick<Task, "title" | "due_date" | "priority" | "status">> = [
    {
      lead_id: lead.id,
      title: `Roteiro site 1: primeiro contato - ${lead.name}`,
      description: script,
      due_date: addMinutes(now, 15).toISOString(),
      priority: lead.priority === "Baixa" ? "Media" : lead.priority,
      status: "pendente",
      responsible: lead.assigned_to ?? "Tiago",
    },
    {
      lead_id: lead.id,
      title: `Roteiro site 2: qualificar obra - ${lead.name}`,
      description: qualification,
      due_date: addHours(now, 2).toISOString(),
      priority: lead.priority,
      status: "pendente",
      responsible: lead.assigned_to ?? "Tiago",
    },
    {
      lead_id: lead.id,
      title: `Roteiro site 3: propor visita - ${lead.name}`,
      description: "Se o lead responder com cidade/terreno ou demonstrar interesse real, propor visita sem compromisso e confirmar melhor dia/horario.",
      due_date: addHours(now, 24).toISOString(),
      priority: lead.wants_visit || lead.lead_score >= 70 ? "Alta" : "Media",
      status: "pendente",
      responsible: lead.assigned_to ?? "Tiago",
    },
    {
      lead_id: lead.id,
      title: `Roteiro site 4: follow-up sem resposta - ${lead.name}`,
      description: "Se nao houver resposta, enviar follow-up curto: 'Ola, passando para saber se ainda faz sentido conversarmos sobre sua obra em steel frame. Posso te ajudar com alguma duvida?'",
      due_date: addDays(now, 2).toISOString(),
      priority: "Media",
      status: "pendente",
      responsible: lead.assigned_to ?? "Tiago",
    },
    {
      lead_id: lead.id,
      title: `Roteiro site 5: proximo passo tecnico - ${lead.name}`,
      description: lead.has_blueprint
        ? "Solicitar planta em PDF/imagem e encaminhar para avaliacao tecnica antes de estimativa."
        : "Definir se o proximo passo sera visita, levantamento inicial ou indicacao de projeto/planta.",
      due_date: addDays(now, 3).toISOString(),
      priority: lead.lead_score >= 70 ? "Alta" : "Media",
      status: "pendente",
      responsible: lead.assigned_to ?? "Tiago",
    },
  ];

  return {
    reason: missing.length
      ? `Faltam dados-chave para qualificar: ${missing.join(", ")}.`
      : "Lead ja tem dados bons para avancar rapidamente para visita ou analise tecnica.",
    script,
    tasks,
  };
}
