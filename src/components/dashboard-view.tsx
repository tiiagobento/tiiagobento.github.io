"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Flame,
  Handshake,
  Inbox,
  ListChecks,
  MessageSquareText,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { format, isAfter, isBefore, isToday, parseISO, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/empty-state";
import { DailyExecutionAssistant, type DailyExecutionHandlers } from "@/components/daily-execution-assistant";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { daysSinceLastContact, isStaleLead } from "@/lib/business";
import { pipelineStatuses } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import type { AutomationLevel } from "@/lib/automation-preferences";
import type { Interaction, Lead, MessageTemplate, Task } from "@/lib/types";

const chartColors = ["#12323b", "#b7793c", "#257365", "#81909a", "#d7a45c", "#a45537", "#4e646f", "#6f5d4e"];

export function DashboardView({
  leads,
  interactions,
  tasks,
  templates = [],
  profileName,
  isOnline = true,
  automationLevel = "semi-automatic",
  handlers,
}: {
  leads: Lead[];
  interactions: Interaction[];
  tasks: Task[];
  templates?: MessageTemplate[];
  profileName?: string | null;
  isOnline?: boolean;
  automationLevel?: AutomationLevel;
  handlers?: DailyExecutionHandlers;
}) {
  const [showMoreMetrics, setShowMoreMetrics] = React.useState(false);

  if (!leads.length && !tasks.length) {
    return (
      <div className="space-y-5">
        <DashboardGreeting profileName={profileName} leads={leads} tasks={tasks} />
        <DailyExecutionAssistant
          leads={leads}
          interactions={interactions}
          tasks={tasks}
          templates={templates}
          profileName={profileName}
          isOnline={isOnline}
          automationLevel={automationLevel}
          handlers={handlers}
        />
        <EmptyState
          icon={Inbox}
          title="Dashboard pronto para receber dados"
          description="Cadastre o primeiro lead ou importe uma lista para acompanhar origem, funil, prioridades e proximas acoes com dados reais do Supabase."
        />
      </div>
    );
  }

  const closed = countStatus(leads, "Fechado");
  const lost = countStatus(leads, "Perdido");
  const hotLeads = leads.filter((lead) => lead.lead_score >= 70);
  const staleLeads = leads.filter(isStaleLead);
  const conversion = leads.length ? Math.round((closed / leads.length) * 100) : 0;
  const potential = leads.reduce((sum, lead) => sum + (lead.potential_value ?? 0), 0);

  const activeTasks = tasks.filter((task) => task.status !== "concluida");
  const todayTasks = activeTasks.filter((task) => isToday(parseISO(task.due_date))).sort(sortTasksByDueDate).slice(0, 6);
  const overdueTasks = activeTasks.filter((task) => isBefore(parseISO(task.due_date), startOfToday())).sort(sortTasksByDueDate).slice(0, 6);
  const upcomingTasks = activeTasks
    .filter((task) => !isToday(parseISO(task.due_date)) && isAfter(parseISO(task.due_date), startOfToday()))
    .sort(sortTasksByDueDate)
    .slice(0, 6);
  const recentLeads = [...leads].sort((a, b) => compareDateDesc(a.created_at, b.created_at)).slice(0, 6);
  const topHotLeads = [...hotLeads].sort((a, b) => b.lead_score - a.lead_score || compareDateDesc(a.updated_at, b.updated_at)).slice(0, 6);
  const staleLeadList = [...staleLeads].sort((a, b) => daysSinceLastContact(b) - daysSinceLastContact(a)).slice(0, 6);
  const recentInteractions = [...interactions].sort((a, b) => compareDateDesc(a.created_at, b.created_at)).slice(0, 6);
  const overdueFollowUps = activeTasks
    .filter((task) => isBefore(parseISO(task.due_date), startOfToday()) && /follow|retomar|contato/i.test(`${task.title} ${task.description ?? ""}`))
    .sort(sortTasksByDueDate)
    .slice(0, 6);

  const bySource = group(leads, "source").slice(0, 7);
  const byStatus = pipelineStatuses.map((status) => ({ label: status, value: countStatus(leads, status) })).filter((item) => item.value > 0);
  const byCity = group(leads, "city", "A confirmar").slice(0, 8);
  const byPriority = group(leads, "priority");
  const funnel = pipelineStatuses.map((status) => ({ label: status, value: countStatus(leads, status) }));
  const byMonth = leadsByMonth(leads);

  return (
    <div className="space-y-5">
      <DashboardGreeting profileName={profileName} leads={leads} tasks={tasks} />

      <DailyExecutionAssistant
        leads={leads}
        interactions={interactions}
        tasks={tasks}
        templates={templates}
        profileName={profileName}
        isOnline={isOnline}
        automationLevel={automationLevel}
        handlers={handlers}
      />

      <section className="grid gap-2 rounded-xl border bg-card/90 p-3 shadow-sm sm:flex sm:flex-wrap sm:items-center">
        <Button asChild variant="outline" className="min-h-12 sm:min-h-10">
          <Link href="/leads?score=hot">
            <Flame className="size-4" />
            Ver leads quentes
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-12 sm:min-h-10">
          <Link href="/tasks?status=atrasada">
            <AlertTriangle className="size-4" />
            Tarefas atrasadas
          </Link>
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard title="Total de leads" value={leads.length} icon={Users} />
        <MetricCard title="Leads quentes" value={hotLeads.length} icon={Flame} tone="gold" />
        <MetricCard title="Visitas marcadas" value={countStatus(leads, "Visita marcada")} icon={CalendarCheck} tone="green" />
        <MetricCard title="Orcamentos enviados" value={countStatus(leads, "Orcamento enviado")} icon={FileText} tone="gold" />
        <MetricCard title="Obras fechadas" value={closed} icon={CircleDollarSign} tone="green" />
        <MetricCard title="Tarefas atrasadas" value={overdueTasks.length} icon={AlertTriangle} tone={overdueTasks.length ? "red" : "default"} />
      </section>

      <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">Mais indicadores</h2>
            <p className="text-xs text-muted-foreground">Metricas secundarias ficam recolhidas para manter o dashboard mais rapido de ler.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMoreMetrics((value) => !value)} aria-expanded={showMoreMetrics}>
            {showMoreMetrics ? "Ocultar indicadores" : "Expandir metricas"}
          </Button>
        </div>
        {showMoreMetrics ? (
          <section className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
            <MetricCard title="Novos leads" value={countStatus(leads, "Novo lead")} icon={Flame} tone="gold" />
            <MetricCard title="Qualificados" value={countStatus(leads, "Qualificado")} icon={CheckCircle2} tone="green" />
            <MetricCard title="Em negociacao" value={countStatus(leads, "Em negociacao")} icon={Handshake} />
            <MetricCard title="Leads perdidos" value={lost} icon={XCircle} tone="red" />
            <MetricCard title="Leads atrasados" value={staleLeads.length} icon={AlertTriangle} tone={staleLeads.length ? "red" : "default"} />
            <MetricCard title="Valor potencial total" value={formatCurrency(potential)} icon={CircleDollarSign} tone="gold" />
            <MetricCard title="Taxa de conversao" value={`${conversion}%`} icon={TrendingUp} />
          </section>
        ) : null}
      </div>

      <section className="hidden gap-4 md:grid xl:grid-cols-3">
        <ChartCard title="Leads por origem" description="Canais que estao gerando oportunidades">
          <DonutChart data={bySource} />
        </ChartCard>
        <ChartCard title="Leads por status" description="Distribuicao atual do funil">
          <HorizontalBar data={byStatus} color="#12323b" />
        </ChartCard>
        <ChartCard title="Leads por prioridade" description="Carga comercial por urgencia">
          <VerticalBar data={byPriority} color="#b7793c" />
        </ChartCard>
      </section>

      <section className="hidden gap-4 md:grid xl:grid-cols-[1.1fr_.9fr]">
        <ChartCard title="Funil comercial" description="Etapas principais da jornada">
          <ResponsiveContainer width="100%" height={300}>
            <FunnelChart margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
              <Tooltip content={<ChartTooltip />} />
              <Funnel dataKey="value" data={funnel} nameKey="label">
                {funnel.map((_, index) => (
                  <Cell key={index} fill={chartColors[index % chartColors.length]} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Leads por cidade" description="Pracas com maior demanda">
          <HorizontalBar data={byCity} color="#257365" />
        </ChartCard>
      </section>

      <div className="hidden md:block">
        <ChartCard title="Evolucao de leads por mes" description="Entrada de novas oportunidades ao longo do tempo">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={byMonth} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e1d8" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="value" name="Leads" stroke="#b7793c" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <ActionList
          title="Proximas acoes de hoje"
          description="Tarefas abertas com vencimento hoje"
          icon={Clock3}
          empty="Nenhuma acao para hoje."
          items={todayTasks.map((task) => ({
            id: task.id,
            href: task.lead_id ? `/leads/${task.lead_id}` : "/tasks",
            title: task.title,
            meta: format(parseISO(task.due_date), "HH:mm", { locale: ptBR }),
            tone: task.priority === "Alta" ? "hot" : "default",
          }))}
        />
        <ActionList
          title="Acoes atrasadas"
          description="Pendencias que precisam de retomada"
          icon={AlertTriangle}
          empty="Nenhuma acao atrasada."
          items={overdueTasks.map((task) => ({
            id: task.id,
            href: task.lead_id ? `/leads/${task.lead_id}` : "/tasks",
            title: task.title,
            meta: format(parseISO(task.due_date), "dd/MM HH:mm", { locale: ptBR }),
            tone: "danger",
          }))}
        />
        <ActionList
          title="Proximas acoes"
          description="Follow-ups e compromissos futuros"
          icon={CalendarCheck}
          empty="Nenhuma acao futura."
          items={upcomingTasks.map((task) => ({
            id: task.id,
            href: task.lead_id ? `/leads/${task.lead_id}` : "/tasks",
            title: task.title,
            meta: format(parseISO(task.due_date), "dd/MM HH:mm", { locale: ptBR }),
            tone: task.priority === "Alta" ? "hot" : "default",
          }))}
        />
        <LeadList title="Ultimos leads cadastrados" description="Entradas mais recentes no CRM" leads={recentLeads} empty="Nenhum lead cadastrado." />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <LeadList title="Leads mais quentes" description="Score acima de 70 ou maior potencial de fechamento" leads={topHotLeads} empty="Nenhum lead quente ainda." showScore />
        <LeadList title="Sem retorno ha mais de 3 dias" description="Exceto leads fechados ou perdidos" leads={staleLeadList} empty="Nenhum lead parado." showStale />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <InteractionList interactions={recentInteractions} leads={leads} />
        <ActionList
          title="Follow-ups atrasados"
          description="Retomadas comerciais pendentes"
          icon={AlertTriangle}
          empty="Nenhum follow-up atrasado."
          items={overdueFollowUps.map((task) => ({
            id: task.id,
            href: task.lead_id ? `/leads/${task.lead_id}` : "/tasks",
            title: task.title,
            meta: format(parseISO(task.due_date), "dd/MM HH:mm", { locale: ptBR }),
            tone: "danger",
          }))}
        />
      </section>
    </div>
  );
}

function DashboardGreeting({ profileName, leads, tasks }: { profileName?: string | null; leads: Lead[]; tasks: Task[] }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profileName?.trim().split(" ")[0] || "Tiago";
  const openTasks = tasks.filter((task) => task.status !== "concluida").length;
  const hotLeads = leads.filter((lead) => lead.lead_score >= 70 && !["Fechado", "Perdido"].includes(lead.status)).length;

  return (
    <section className="page-hero">
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-white/55">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{greeting}, {firstName}. Seu plano comercial esta pronto.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              {openTasks || hotLeads
                ? `${openTasks} tarefas abertas e ${hotLeads} leads quentes foram organizados por horario, atraso e oportunidade.`
                : "Nao ha urgencias comerciais agora. O CRM continua acompanhando novos leads e prazos."}
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap xl:justify-end">
            <Button asChild variant="accent" className="min-h-12 sm:min-h-10">
              <Link href="/leads/new"><Plus className="size-4" />Novo lead</Link>
            </Button>
            <Button asChild variant="secondary" className="min-h-12 sm:min-h-10">
              <Link href="/leads/ai-import"><Sparkles className="size-4" />Importar com IA</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 border-white/20 bg-white/8 text-white hover:bg-white/14 sm:min-h-10">
              <Link href="/pipeline"><ListChecks className="size-4" />Pipeline</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-primary">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-text]:fill-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function DonutChart({ data }: { data: ChartDatum[] }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
          {data.map((_, index) => (
            <Cell key={index} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HorizontalBar({ data, color }: { data: ChartDatum[]; color: string }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e1d8" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" name="Leads" fill={color} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalBar({ data, color }: { data: ChartDatum[]; color: string }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e1d8" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" name="Leads" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string; payload?: ChartDatum }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const resolvedLabel = item.payload?.label ?? label ?? item.name ?? "Total";
  return (
    <div className="rounded-lg border bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <p className="font-medium">{resolvedLabel}</p>
      <p className="text-muted-foreground">{item.value ?? 0} leads</p>
    </div>
  );
}

function ChartEmpty() {
  return <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed bg-secondary/35 text-sm text-muted-foreground">Sem dados suficientes.</div>;
}

function ActionList({
  title,
  description,
  icon: Icon,
  items,
  empty,
}: {
  title: string;
  description: string;
  icon: typeof ListChecks;
  items: Array<{ id: string; href: string; title: string; meta: string; tone?: "default" | "hot" | "danger" }>;
  empty: string;
}) {
  return (
    <Card className="h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Icon className="size-4" />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.id}>
              <Link href={item.href} className="flex items-center justify-between gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-border hover:bg-secondary/65 hover:shadow-sm">
                <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs",
                    item.tone === "danger" && "bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50",
                    item.tone === "hot" && "bg-amber-50 text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/50",
                    (!item.tone || item.tone === "default") && "bg-background text-muted-foreground ring-1 ring-border",
                  )}
                >
                  {item.meta}
                </span>
              </Link>
              {index < items.length - 1 ? <Separator /> : null}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LeadList({
  title,
  description,
  leads,
  empty,
  showScore,
  showStale,
}: {
  title: string;
  description: string;
  leads: Lead[];
  empty: string;
  showScore?: boolean;
  showStale?: boolean;
}) {
  return (
    <Card className="h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-primary">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {leads.length ? (
          leads.map((lead, index) => (
            <div key={lead.id}>
              <Link href={`/leads/${lead.id}`} className="group flex items-start justify-between gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-border hover:bg-secondary/65 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold transition group-hover:text-primary">{lead.name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {[lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Local a confirmar"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <LeadStatusBadge status={lead.status} />
                    <LeadPriorityBadge priority={lead.priority} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {showScore ? <LeadScoreBadge score={lead.lead_score} /> : null}
                  {showStale ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/35 dark:text-red-200 dark:ring-1 dark:ring-red-900/50">{daysSinceLastContact(lead)}d</span> : null}
                  {!showScore && !showStale ? <span className="text-xs text-muted-foreground">{format(parseISO(lead.created_at), "dd/MM", { locale: ptBR })}</span> : null}
                </div>
              </Link>
              {index < leads.length - 1 ? <Separator /> : null}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InteractionList({ interactions, leads }: { interactions: Interaction[]; leads: Lead[] }) {
  return (
    <Card className="h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <MessageSquareText className="size-4" />
          </span>
          <CardTitle className="text-base">Interacoes recentes</CardTitle>
        </div>
        <CardDescription>Ultimos contatos registrados no historico comercial</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {interactions.length ? (
          interactions.map((interaction, index) => {
            const lead = leads.find((item) => item.id === interaction.lead_id);
            return (
              <div key={interaction.id}>
                <Link href={lead ? `/leads/${lead.id}` : "/leads"} className="block rounded-lg border border-transparent p-2.5 transition hover:border-border hover:bg-secondary/65 hover:shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{lead?.name ?? "Lead removido"}</p>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                      {format(parseISO(interaction.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{interaction.interaction_type}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{interaction.description}</p>
                </Link>
                {index < interactions.length - 1 ? <Separator /> : null}
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">Nenhuma interacao registrada ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}

type ChartDatum = {
  label: string;
  value: number;
};

type MonthDatum = ChartDatum & {
  key: string;
};

function countStatus(leads: Lead[], status: Lead["status"]) {
  return leads.filter((lead) => lead.status === status).length;
}

function group<T extends keyof Lead>(leads: Lead[], key: T, fallback = "A confirmar") {
  return Object.values(
    leads.reduce<Record<string, ChartDatum>>((acc, lead) => {
      const label = String(lead[key] || fallback);
      acc[label] ??= { label, value: 0 };
      acc[label].value += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);
}

function leadsByMonth(leads: Lead[]) {
  return Object.values(
    leads.reduce<Record<string, MonthDatum>>((acc, lead) => {
      const key = lead.first_contact_date.slice(0, 7);
      acc[key] ??= { key, label: format(parseISO(`${key}-01`), "MMM/yy", { locale: ptBR }), value: 0 };
      acc[key].value += 1;
      return acc;
    }, {}),
  ).sort((a, b) => a.key.localeCompare(b.key));
}

function sortTasksByDueDate(a: Task, b: Task) {
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

function compareDateDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}
