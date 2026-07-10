"use client";

import * as React from "react";
import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, ClipboardCheck, ExternalLink, MessageSquareText, UserRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { LeadPriorityBadge, LeadScoreBadge } from "@/components/lead-badges";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrmData } from "@/hooks/use-crm-data";
import { visitStatuses } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";

export default function PartnerPage() {
  const { leads, currentProfile, loading, updateLead, updatePartnerVisit } = useCrmData();
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);

  if (loading) return <LoadingSkeleton />;

  const assignedLeads = leads
    .filter((lead) => {
      if (currentProfile?.role === "partner") return lead.partner_id === currentProfile.id;
      return Boolean(lead.partner_id);
    })
    .sort((a, b) => new Date(a.visit_scheduled_at ?? a.next_action_at ?? a.updated_at).getTime() - new Date(b.visit_scheduled_at ?? b.next_action_at ?? b.updated_at).getTime());

  const selectedLead = assignedLeads.find((lead) => lead.id === selectedLeadId) ?? assignedLeads[0] ?? null;
  const visitsToDo = assignedLeads.filter((lead) => lead.visit_status !== "Visita realizada");
  const todayVisits = assignedLeads.filter((lead) => lead.visit_scheduled_at && isToday(parseISO(lead.visit_scheduled_at)));
  const completedVisits = assignedLeads.filter((lead) => lead.visit_status === "Visita realizada");
  const waitingFeedback = assignedLeads.filter((lead) => lead.visit_status === "Visita realizada" && !lead.partner_visit_feedback);

  async function saveFeedback(lead: Lead, input: Pick<Lead, "visit_status" | "partner_notes" | "partner_visit_feedback">) {
    if (currentProfile?.role === "partner") {
      await updatePartnerVisit(lead.id, input);
      return;
    }

    await updateLead(lead.id, input);
    toast.success("Retorno da visita registrado.");
  }

  return (
    <div className="space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent">
            <UserRound className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Painel do Parceiro</h1>
            <p className="mt-1 max-w-3xl text-sm text-white/72">
              Leads atribuidos para visita tecnica, briefing e retorno de campo. Bruno ve somente os leads vinculados ao usuario dele.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Visitas a realizar" value={visitsToDo.length} />
        <Metric title="Visitas de hoje" value={todayVisits.length} tone="gold" />
        <Metric title="Visitas realizadas" value={completedVisits.length} tone="success" />
        <Metric title="Aguardando retorno" value={waitingFeedback.length} tone={waitingFeedback.length ? "danger" : "default"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Leads atribuidos</CardTitle>
            <CardDescription>Lista de visitas vinculadas ao parceiro logado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignedLeads.length ? (
              assignedLeads.map((lead) => (
                <PartnerLeadCard key={lead.id} lead={lead} active={selectedLead?.id === lead.id} onSelect={() => setSelectedLeadId(lead.id)} />
              ))
            ) : (
              <EmptyState icon={UserRound} title="Nenhum lead atribuido" description="Quando o admin atribuir uma visita ao Bruno, ela aparece aqui." />
            )}
          </CardContent>
        </Card>

        {selectedLead ? (
          <PartnerFeedbackCard lead={selectedLead} onSave={(input) => saveFeedback(selectedLead, input)} />
        ) : (
          <EmptyState icon={ClipboardCheck} title="Sem lead selecionado" description="Selecione um lead atribuido para registrar retorno de visita." />
        )}
      </section>
    </div>
  );
}

function Metric({ title, value, tone = "default" }: { title: string; value: number; tone?: "default" | "gold" | "success" | "danger" }) {
  return (
    <Card className={cn("transition duration-200 hover:-translate-y-0.5 hover:shadow-lg", tone === "danger" && "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/18", tone === "success" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/18", tone === "gold" && "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/18")}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <CalendarCheck className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function PartnerLeadCard({ lead, active, onSelect }: { lead: Lead; active: boolean; onSelect: () => void }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md", active && "border-accent shadow-md ring-2 ring-accent/15")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{lead.name}</h3>
            <Badge variant="secondary">{lead.visit_status || "Aguardando agendamento"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{[lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Local a confirmar"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{lead.project_type || "Tipo de obra a confirmar"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LeadPriorityBadge priority={lead.priority} />
            <LeadScoreBadge score={lead.lead_score} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Visita: {lead.visit_scheduled_at ? format(parseISO(lead.visit_scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "A definir"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelect}>
            Registrar retorno
          </Button>
          <WhatsAppButton lead={lead} size="sm" />
          <Button asChild variant="outline" size="sm">
            <Link href={`/leads/${lead.id}/briefing`}>
              <ExternalLink className="size-4" />
              Briefing
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function PartnerFeedbackCard({ lead, onSave }: { lead: Lead; onSave: (input: Pick<Lead, "visit_status" | "partner_notes" | "partner_visit_feedback">) => Promise<void> }) {
  const [visitStatus, setVisitStatus] = React.useState<string>(lead.visit_status ?? "Visita marcada");
  const [notes, setNotes] = React.useState(lead.partner_notes ?? "");
  const [technicalPoints, setTechnicalPoints] = React.useState("");
  const [recommendQuote, setRecommendQuote] = React.useState("sim");
  const [needsInfo, setNeedsInfo] = React.useState("nao");
  const [nextAction, setNextAction] = React.useState("");
  const [feedback, setFeedback] = React.useState(lead.partner_visit_feedback ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setVisitStatus(lead.visit_status ?? "Visita marcada");
    setNotes(lead.partner_notes ?? "");
    setFeedback(lead.partner_visit_feedback ?? "");
    setTechnicalPoints("");
    setRecommendQuote("sim");
    setNeedsInfo("nao");
    setNextAction("");
  }, [lead.id, lead.partner_notes, lead.partner_visit_feedback, lead.visit_status]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const composedFeedback = [
        feedback,
        technicalPoints ? `Pontos tecnicos identificados: ${technicalPoints}` : null,
        `Recomenda orcamento: ${recommendQuote === "sim" ? "Sim" : "Nao"}`,
        `Precisa de mais informacoes: ${needsInfo === "sim" ? "Sim" : "Nao"}`,
        nextAction ? `Proxima acao sugerida: ${nextAction}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      await onSave({
        visit_status: visitStatus as Lead["visit_status"],
        partner_notes: notes,
        partner_visit_feedback: composedFeedback,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/10 xl:sticky xl:top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-5 text-accent" />
          Retorno da visita
        </CardTitle>
        <CardDescription>{lead.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
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
          <Field label="Observacoes da visita">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="O que foi visto no local?" />
          </Field>
          <Field label="Pontos tecnicos identificados">
            <Textarea value={technicalPoints} onChange={(event) => setTechnicalPoints(event.target.value)} placeholder="Acesso, nivelamento, recuos, restricoes, fotos..." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recomenda orcamento?">
              <Select value={recommendQuote} onValueChange={setRecommendQuote}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Nao</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Precisa de mais informacoes?">
              <Select value={needsInfo} onValueChange={setNeedsInfo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Nao</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Proxima acao sugerida">
            <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Ex: Solicitar planta atualizada" />
          </Field>
          <Field label="Resumo final do retorno">
            <Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Resumo para o time comercial" />
          </Field>
          <Button disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Registrar retorno"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
