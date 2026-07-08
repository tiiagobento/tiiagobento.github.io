"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format, isBefore, parseISO, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit,
  FileText,
  MessageCircle,
  MessageSquarePlus,
  Phone,
  Plus,
  StickyNote,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { InteractionTimeline } from "@/components/interaction-timeline";
import { LeadForm } from "@/components/lead-form";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
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
import { applyTemplate, buildWhatsAppUrl, daysSinceLastContact, isStaleLead, isValidWhatsAppPhone } from "@/lib/business";
import { interactionTypes, leadStatuses, priorities, templateCategories, visitStatuses } from "@/lib/constants";
import { interactionSchema } from "@/lib/schemas";
import { cn, formatCurrency } from "@/lib/utils";
import type { LeadFormValues } from "@/lib/schemas";
import type { Interaction, Lead, LeadStatus, MessageTemplate, Priority, Task } from "@/lib/types";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    leads,
    interactions,
    tasks,
    templates,
    profiles,
    currentProfile,
    loading,
    saveLead,
    updateLead,
    recordLastContact,
    addInteraction,
    updateInteraction,
    deleteInteraction,
    saveTask,
    completeTask,
  } = useCrmData();
  const lead = leads.find((item) => item.id === params.id);
  const editMode = searchParams.get("edit") === "1";

  if (loading) return <LoadingSkeleton />;

  if (!lead) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/leads">
            <ArrowLeft className="size-4" />
            Voltar para leads
          </Link>
        </Button>
        <EmptyState icon={UserRound} title="Lead nao encontrado" description="Nao encontramos esse lead no Supabase para o usuario logado. Verifique se ele ainda existe ou volte para a lista." />
      </div>
    );
  }

  async function submit(values: LeadFormValues) {
    if (!lead) return;
    await saveLead({ ...lead, ...values });
    router.push(`/leads/${lead.id}`);
  }

  if (editMode) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Editar lead</h1>
            <p className="text-sm text-muted-foreground">Atualize a ficha comercial de {lead.name}.</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/leads/${lead.id}`)}>
            <ArrowLeft className="size-4" />
            Voltar para ficha
          </Button>
        </div>
        <LeadForm lead={lead} onSubmit={submit} />
      </div>
    );
  }

  const currentLead: Lead = lead;
  const leadInteractions = interactions.filter((item) => item.lead_id === currentLead.id);
  const leadTasks = tasks.filter((item) => item.lead_id === currentLead.id);
  const overdueTasks = leadTasks.filter(isTaskOverdue).sort(sortTasksByDate);
  const pendingTasks = leadTasks.filter((task) => task.status === "pendente" && !isTaskOverdue(task)).sort(sortTasksByDate);
  const completedTasks = leadTasks.filter((task) => task.status === "concluida").sort(sortTasksByDateDesc);

  async function changeStatus(status: LeadStatus) {
    await updateLead(currentLead.id, { status });
  }

  async function changePriority(priority: Priority) {
    await updateLead(currentLead.id, { priority });
  }

  async function createTask(input: NewTaskInput) {
    const dueDate = combineDateTime(input.date, input.time);
    await saveTask({
      lead_id: currentLead.id,
      title: input.title,
      description: input.description,
      due_date: dueDate,
      priority: input.priority,
      status: "pendente",
      responsible: input.responsible,
    });
    await updateLead(currentLead.id, { next_action_at: dueDate });
  }

  return (
    <div className="space-y-5">
      <LeadHeader lead={lead} onEdit={() => router.push(`/leads/${lead.id}?edit=1`)} />

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="text-base text-primary">Acoes rapidas</CardTitle>
          <CardDescription>Atualize o andamento sem sair da ficha.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Select value={lead.status} onValueChange={(status) => changeStatus(status as LeadStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lead.priority} onValueChange={(priority) => changePriority(priority as Priority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => recordLastContact(lead.id)}>
            <CalendarClock className="size-4" />
            Registrar contato agora
          </Button>
        </CardContent>
      </Card>

      <LeadTemplatePanel lead={lead} templates={templates} />

      {currentProfile?.role !== "partner" ? (
        <PartnerAssignmentPanel lead={lead} partners={profiles.filter((profile) => profile.role === "partner")} onUpdate={(input) => updateLead(lead.id, input)} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <InfoCard title="Dados do cliente" icon={UserRound}>
          <InfoGrid>
            <Info label="Nome" value={lead.name} />
            <Info label="Telefone" value={lead.phone} />
            <Info label="E-mail" value={lead.email || "A confirmar"} />
            <Info label="Melhor horario" value={lead.best_contact_time || "A confirmar"} />
            <Info label="Origem" value={lead.source} />
            <Info label="Primeiro contato" value={formatDateOnly(lead.first_contact_date)} />
          </InfoGrid>
        </InfoCard>

        <InfoCard title="Dados da obra" icon={FileText}>
          <InfoGrid>
            <Info label="Cidade" value={lead.city || "A confirmar"} />
            <Info label="Bairro" value={lead.neighborhood || "A confirmar"} />
            <Info label="Tipo de obra" value={lead.project_type || "A confirmar"} />
            <Info label="Metragem" value={lead.approximate_area ? `${lead.approximate_area} m2` : "A confirmar"} />
            <Info label="Tem terreno" value={yesNo(lead.has_land)} />
            <Info label="Tem planta" value={yesNo(lead.has_blueprint)} />
            <Info label="Orcamento anterior" value={yesNo(lead.has_previous_quote)} />
            <Info label="Prazo desejado" value={lead.desired_start_time || "A confirmar"} />
            <Info label="Faixa de orcamento" value={lead.budget_range || "A confirmar"} />
          </InfoGrid>
        </InfoCard>

        <InfoCard title="Dados comerciais" icon={ClipboardCheck}>
          <InfoGrid>
            <Info label="Valor potencial" value={formatCurrency(lead.potential_value)} />
            <Info label="Probabilidade" value={lead.closing_probability ? `${lead.closing_probability}%` : "A confirmar"} />
            <Info label="Responsavel" value={lead.assigned_to || "Tiago"} />
            <Info label="Status" value={<LeadStatusBadge status={lead.status} />} />
            <Info label="Prioridade" value={<LeadPriorityBadge priority={lead.priority} />} />
            <Info label="Ultimo contato" value={lead.last_contact_at ? formatDateTime(lead.last_contact_at) : "Ainda nao registrado"} />
            <Info label="Proxima acao" value={lead.next_action_at ? formatDateTime(lead.next_action_at) : "A definir"} />
          </InfoGrid>
        </InfoCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <QualificationChecklist lead={lead} interactions={leadInteractions} />
        <InternalNotes lead={lead} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <InteractionForm lead={lead} onSave={(input) => addInteraction(lead.id, input)} />
        <TaskForm lead={lead} onSave={createTask} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <InteractionTimeline interactions={leadInteractions} onUpdate={updateInteraction} onDelete={deleteInteraction} />
        <LeadTasksPanel tasks={{ pending: pendingTasks, overdue: overdueTasks, completed: completedTasks }} onComplete={completeTask} />
      </section>
    </div>
  );
}

function LeadHeader({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const location = [lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Local a confirmar";
  return (
    <Card className="overflow-hidden border-primary/10 shadow-lg">
      <div className="relative overflow-hidden bg-primary p-5 text-primary-foreground sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,120,56,0.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)]" />
        <div className="relative">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
              <span>{lead.source}</span>
              <span>-</span>
              <span>{location}</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{lead.name}</h1>
            <p className="mt-2 text-sm text-white/72">{lead.phone}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeadStatusBadge status={lead.status} />
              <LeadPriorityBadge priority={lead.priority} />
              {isStaleLead(lead) ? <Badge variant="danger">Sem retorno ha {daysSinceLastContact(lead)} dias</Badge> : <Badge variant="success">Em dia</Badge>}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
            <div className="rounded-xl border border-white/10 bg-white/10 p-3 shadow-sm backdrop-blur">
              <LeadScoreBadge score={lead.lead_score} />
            </div>
            <div className="flex flex-wrap gap-2">
              <WhatsAppButton lead={lead} size="lg" />
              <Button asChild variant="secondary" size="lg">
                <Link href={`/leads/${lead.id}/briefing`}>
                  <FileText className="size-4" />
                  Gerar briefing para visita
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <a href={`tel:${lead.phone}`}>
                  <Phone className="size-4" />
                  Ligar
                </a>
              </Button>
              <Button variant="outline" size="lg" onClick={onEdit}>
                <Edit className="size-4" />
                Editar
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <HeaderStat label="Origem" value={lead.source} />
        <HeaderStat label="Cidade/bairro" value={location} />
        <HeaderStat label="Ultimo contato" value={lead.last_contact_at ? formatDateTime(lead.last_contact_at) : "Ainda nao registrado"} />
        <HeaderStat label="Proxima acao" value={lead.next_action_at ? formatDateTime(lead.next_action_at) : "A definir"} />
      </CardContent>
    </Card>
  );
}

function HeaderStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-secondary/35 p-3 shadow-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <Card className="h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{children}</div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-secondary/35 p-3 shadow-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function QualificationChecklist({ lead, interactions }: { lead: Lead; interactions: Interaction[] }) {
  const text = `${lead.notes ?? ""} ${interactions.map((item) => `${item.description} ${item.next_step ?? ""}`).join(" ")}`.toLowerCase();
  const receivedSteelFrameExplanation = text.includes("steel") || text.includes("frame");
  const acceptsVisit = Boolean(lead.wants_visit || lead.status.includes("Visita") || text.includes("visita"));
  const readyForQuote = Boolean((lead.has_blueprint || lead.approximate_area) && (lead.city || lead.neighborhood) && (lead.has_land || lead.approximate_address));
  const items = [
    ["Tem terreno", lead.has_land],
    ["Tem planta", lead.has_blueprint],
    ["Informou localizacao", Boolean(lead.city || lead.neighborhood || lead.approximate_address)],
    ["Informou metragem", Boolean(lead.approximate_area)],
    ["Informou prazo", Boolean(lead.desired_start_time)],
    ["Tem interesse real", lead.lead_score >= 40],
    ["Aceita visita", acceptsVisit],
    ["Ja recebeu explicacao sobre steel frame", receivedSteelFrameExplanation],
    ["Esta pronto para orcamento", readyForQuote],
  ] as const;

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-accent" />
          Checklist de qualificacao
        </CardTitle>
        <CardDescription>Use antes de encaminhar visita tecnica ou orcamento.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {items.map(([label, done]) => (
          <div key={label} className={cn("flex items-center gap-3 rounded-xl border p-3 shadow-xs", done ? "border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/10" : "bg-card")}>
            {done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-muted-foreground" />}
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InternalNotes({ lead }: { lead: Lead }) {
  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="size-5 text-accent" />
          Anotacoes internas
        </CardTitle>
        <CardDescription>Contexto livre registrado na ficha do lead.</CardDescription>
      </CardHeader>
      <CardContent>
        {lead.notes ? (
          <div className="min-h-36 whitespace-pre-line rounded-xl border bg-secondary/35 p-4 text-sm leading-6 shadow-inner">{lead.notes}</div>
        ) : (
          <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">Nenhuma anotacao interna registrada.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PartnerAssignmentPanel({
  lead,
  partners,
  onUpdate,
}: {
  lead: Lead;
  partners: Array<{ id: string; name?: string | null; email?: string | null; role: string }>;
  onUpdate: (input: Partial<Lead>) => Promise<Lead>;
}) {
  const [partnerId, setPartnerId] = React.useState(lead.partner_id ?? "none");
  const [visitDate, setVisitDate] = React.useState(toDatetimeLocal(lead.visit_scheduled_at));
  const [visitStatus, setVisitStatus] = React.useState<string>(lead.visit_status ?? "Aguardando agendamento");
  const [saving, setSaving] = React.useState(false);
  const selectedPartner = partners.find((partner) => partner.id === partnerId);

  React.useEffect(() => {
    setPartnerId(lead.partner_id ?? "none");
    setVisitDate(toDatetimeLocal(lead.visit_scheduled_at));
    setVisitStatus(lead.visit_status ?? "Aguardando agendamento");
  }, [lead.partner_id, lead.visit_scheduled_at, lead.visit_status]);

  async function saveAssignment() {
    setSaving(true);
    try {
      await onUpdate({
        partner_id: partnerId === "none" ? null : partnerId,
        partner_name: partnerId === "none" ? null : selectedPartner?.name || selectedPartner?.email || "Bruno",
        visit_scheduled_at: visitDate ? new Date(visitDate).toISOString() : null,
        visit_status: visitStatus as Lead["visit_status"],
      });
      toast.success("Atribuicao da visita atualizada.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment() {
    setSaving(true);
    try {
      await onUpdate({
        partner_id: null,
        partner_name: null,
        visit_scheduled_at: null,
        visit_status: "Aguardando agendamento",
      });
      toast.success("Atribuicao removida.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-5 text-accent" />
          Atribuicao da visita tecnica
        </CardTitle>
        <CardDescription>Defina Bruno/parceiro, data e status para entregar o lead antes da visita.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <Field label="Parceiro">
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem parceiro</SelectItem>
              {partners.map((partner) => (
                <SelectItem key={partner.id} value={partner.id}>
                  {partner.name || partner.email || "Parceiro"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data da visita">
          <Input type="datetime-local" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
        </Field>
        <Field label="Status da visita">
          <Select value={visitStatus} onValueChange={setVisitStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visitStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="button" disabled={saving} onClick={saveAssignment}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" disabled={saving || !lead.partner_id} onClick={removeAssignment}>
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadTemplatePanel({ lead, templates }: { lead: Lead; templates: MessageTemplate[] }) {
  const [category, setCategory] = React.useState("Todas");
  const filteredTemplates = templates.filter((template) => category === "Todas" || template.category === category);
  const [templateId, setTemplateId] = React.useState(filteredTemplates[0]?.id ?? "none");

  React.useEffect(() => {
    const available = templates.filter((template) => category === "Todas" || template.category === category);
    if (!available.some((template) => template.id === templateId)) {
      setTemplateId(available[0]?.id ?? "none");
    }
  }, [category, templateId, templates]);

  const selectedTemplate = templates.find((template) => template.id === templateId);
  const renderedMessage = selectedTemplate ? applyTemplate(selectedTemplate.content, lead) : "";
  const whatsappUrl = buildWhatsAppUrl(lead.phone, renderedMessage);

  async function copyMessage() {
    if (!renderedMessage) {
      toast.error("Escolha um template antes de copiar.");
      return;
    }
    await navigator.clipboard.writeText(renderedMessage);
    toast.success("Mensagem copiada.");
  }

  function openWhatsApp() {
    if (!selectedTemplate) {
      toast.error("Escolha um template antes de abrir o WhatsApp.");
      return;
    }
    if (!isValidWhatsAppPhone(lead.phone) || !whatsappUrl) {
      toast.error("Telefone incompleto ou invalido para abrir o WhatsApp.");
      return;
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-5 text-accent" />
          Mensagem por template
        </CardTitle>
        <CardDescription>Escolha uma mensagem cadastrada e envie com as variaveis preenchidas para este lead.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Field label="Categoria">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas as categorias</SelectItem>
                {templateCategories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Template">
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Escolha um template</SelectItem>
                {filteredTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button type="button" variant="outline" onClick={copyMessage}>
              <Copy className="size-4" />
              Copiar mensagem
            </Button>
            <Button type="button" variant="accent" onClick={openWhatsApp}>
              <MessageCircle className="size-4" />
              Abrir WhatsApp
            </Button>
          </div>
        </div>
        <div className="min-h-44 whitespace-pre-line rounded-md border bg-secondary/30 p-4 text-sm leading-6">
          {selectedTemplate ? renderedMessage : "Nenhum template selecionado para preview."}
        </div>
      </CardContent>
    </Card>
  );
}

function InteractionForm({
  lead,
  onSave,
}: {
  lead: Lead;
  onSave: (input: Omit<Interaction, "id" | "lead_id" | "created_at">) => Promise<void>;
}) {
  const [type, setType] = React.useState("WhatsApp");
  const [description, setDescription] = React.useState("");
  const [nextStep, setNextStep] = React.useState("");
  const [nextContact, setNextContact] = React.useState("");
  const [responsible, setResponsible] = React.useState(lead.assigned_to ?? "Tiago");
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      toast.error("Descreva a interacao antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      const parsed = interactionSchema.safeParse({
        interaction_type: type,
        responsible,
        description,
        next_step: nextStep,
        next_contact_at: nextContact ? new Date(nextContact).toISOString() : null,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Revise os dados da interacao.");
        return;
      }
      await onSave(parsed.data);
      setDescription("");
      setNextStep("");
      setNextContact("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="size-5 text-accent" />
          Registrar interacao
        </CardTitle>
        <CardDescription>Adicione um contato, visita, follow-up ou observacao direto na ficha.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {interactionTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsavel">
              <Input value={responsible} onChange={(event) => setResponsible(event.target.value)} />
            </Field>
          </div>
          <Field label="Descricao">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que aconteceu no contato?" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Proximo passo">
              <Input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Ex: Confirmar visita" />
            </Field>
            <Field label="Proximo contato">
              <Input type="datetime-local" value={nextContact} onChange={(event) => setNextContact(event.target.value)} />
            </Field>
          </div>
          <Button disabled={saving} className="w-full sm:w-auto sm:justify-self-end">
            {saving ? "Salvando..." : "Salvar interacao"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type NewTaskInput = {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: Priority;
  responsible: string;
};

function TaskForm({ lead, onSave }: { lead: Lead; onSave: (input: NewTaskInput) => Promise<void> }) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>(lead.priority);
  const [responsible, setResponsible] = React.useState(lead.assigned_to ?? "Tiago");
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Informe o titulo da proxima acao.");
      return;
    }
    if (!date) {
      toast.error("Informe a data da proxima acao.");
      return;
    }

    setSaving(true);
    try {
      await onSave({ title, description, date, time, priority, responsible });
      setTitle("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setTime("");
      toast.success("Proxima acao criada.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-5 text-accent" />
          Criar proxima acao
        </CardTitle>
        <CardDescription>Agende uma tarefa comercial vinculada a este lead.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Titulo">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Enviar orcamento preliminar" />
          </Field>
          <Field label="Descricao">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto da tarefa" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Horario opcional">
              <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prioridade">
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
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
            <Field label="Responsavel">
              <Input value={responsible} onChange={(event) => setResponsible(event.target.value)} />
            </Field>
          </div>
          <Button disabled={saving} className="w-full sm:w-auto sm:justify-self-end">
            {saving ? "Criando..." : "Criar proxima acao"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LeadTasksPanel({
  tasks,
  onComplete,
}: {
  tasks: { pending: Task[]; overdue: Task[]; completed: Task[] };
  onComplete: (id: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-accent" />
          Proximas acoes
        </CardTitle>
        <CardDescription>Tarefas vinculadas a este lead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TaskGroup title="Pendentes" tasks={tasks.pending} empty="Nenhuma tarefa pendente." onComplete={onComplete} />
        <TaskGroup title="Atrasadas" tasks={tasks.overdue} empty="Nenhuma tarefa atrasada." tone="danger" onComplete={onComplete} />
        <TaskGroup title="Concluidas" tasks={tasks.completed} empty="Nenhuma tarefa concluida." tone="success" onComplete={onComplete} />
      </CardContent>
    </Card>
  );
}

function TaskGroup({
  title,
  tasks,
  empty,
  tone,
  onComplete,
}: {
  title: string;
  tasks: Task[];
  empty: string;
  tone?: "danger" | "success";
  onComplete: (id: string) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant={tone === "danger" ? "danger" : tone === "success" ? "success" : "secondary"}>{tasks.length}</Badge>
      </div>
      {tasks.length ? (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onComplete={onComplete} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-secondary/35 p-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => Promise<void> }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <div className={cn("rounded-md border p-3", isTaskOverdue(task) && "border-red-200 bg-red-50/50 dark:bg-red-950/10")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{task.title}</p>
            <LeadPriorityBadge priority={task.priority} />
            {task.status === "concluida" ? <Badge variant="success">Concluida</Badge> : isTaskOverdue(task) ? <Badge variant="danger">Atrasada</Badge> : <Badge variant="secondary">Pendente</Badge>}
          </div>
          {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDateTime(task.due_date)} - {task.responsible || "Tiago"}
          </p>
        </div>
        {task.status !== "concluida" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onComplete(task.id);
              } finally {
                setSaving(false);
              }
            }}
          >
            <CheckCircle2 className="size-4" />
            Concluir
          </Button>
        ) : null}
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

function yesNo(value?: boolean | null) {
  return value ? "Sim" : "Nao informado";
}

function formatDateOnly(value: string) {
  return format(parseISO(value.length === 10 ? `${value}T00:00:00` : value), "dd/MM/yyyy", { locale: ptBR });
}

function formatDateTime(value: string) {
  return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "12:00"}:00`).toISOString();
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isTaskOverdue(task: Task) {
  return task.status === "atrasada" || (task.status === "pendente" && isBefore(parseISO(task.due_date), startOfToday()));
}

function sortTasksByDate(a: Task, b: Task) {
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

function sortTasksByDateDesc(a: Task, b: Task) {
  return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
}
