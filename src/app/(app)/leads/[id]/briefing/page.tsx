"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, MessageCircle, UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LeadBriefingActions } from "@/components/lead-briefing-actions";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";
import { buildWhatsAppUrl } from "@/lib/business";
import { formatCurrency } from "@/lib/utils";
import type { Lead } from "@/lib/types";

const visitChecklist = [
  "Confirmar endereco exato",
  "Confirmar metragem desejada",
  "Confirmar se ja existe projeto/planta",
  "Verificar acesso ao terreno",
  "Verificar condicoes do local",
  "Entender padrao de acabamento esperado",
  "Confirmar se cliente busca obra completa ou etapa especifica",
  "Confirmar prazo desejado",
  "Confirmar orcamento disponivel",
  "Registrar fotos do local, se possivel",
  "Explicar que orcamento preciso depende de projeto/levantamento",
];

export default function LeadBriefingPage() {
  const params = useParams<{ id: string }>();
  const { leads, interactions, loading } = useCrmData();
  const lead = leads.find((item) => item.id === params.id);

  if (loading) return <LoadingSkeleton />;

  if (!lead) {
    return <EmptyState icon={UserRound} title="Lead nao encontrado" description="Nao encontramos esse lead para gerar o briefing." />;
  }

  const leadInteractions = interactions.filter((item) => item.lead_id === lead.id).slice(0, 6);
  const whatsappUrl = buildWhatsAppUrl(lead.phone);

  return (
    <div className="mx-auto max-w-5xl space-y-5 print:max-w-none print:bg-white">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="outline">
          <Link href={`/leads/${lead.id}`}>
            <ArrowLeft className="size-4" />
            Voltar para o lead
          </Link>
        </Button>
        <LeadBriefingActions leadId={lead.id} leadName={lead.name} />
        <Button asChild variant="accent">
          <a href={whatsappUrl || "#"} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            Abrir WhatsApp
          </a>
        </Button>
      </div>

      <Card id="visit-briefing-document" className="overflow-hidden border-primary/10 shadow-lg print:border-0 print:shadow-none">
        <div className="relative overflow-hidden bg-primary p-7 text-primary-foreground print:bg-white print:p-0 print:text-slate-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,120,56,0.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)] print:hidden" />
          <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-white/65 print:text-slate-500">Nova Forma Steel Frame</p>
              <h1 className="mt-2 text-3xl font-semibold">Briefing de Visita Tecnica</h1>
              <p className="mt-2 text-sm text-white/72 print:text-slate-600">Documento tecnico/comercial para alinhamento antes da visita.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 p-4 text-sm shadow-sm backdrop-blur print:border print:bg-white">
              <p>Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              <p>Responsavel interno: {lead.assigned_to || "Tiago"}</p>
              <p>Parceiro/visitante: {lead.partner_name || "Bruno"}</p>
            </div>
          </div>
          </div>
        </div>
        <CardContent className="space-y-7 p-6 print:p-0 print:pt-6">
          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Dados do cliente</h2>
            <InfoGrid>
              <Info label="Nome" value={lead.name} />
              <Info label="Telefone/WhatsApp" value={lead.phone} />
              <Info label="E-mail" value={lead.email || "Nao informado"} />
              <Info label="Melhor horario" value={lead.best_contact_time || "Nao informado"} />
              <Info label="Cidade" value={lead.city || "A confirmar"} />
              <Info label="Bairro" value={lead.neighborhood || "A confirmar"} />
              <Info label="Endereco aproximado" value={lead.approximate_address || "A confirmar"} />
            </InfoGrid>
          </section>

          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Origem e contexto do lead</h2>
            <InfoGrid>
              <Info label="Origem" value={lead.source} />
              <Info label="Primeiro contato" value={formatDateOnly(lead.first_contact_date)} />
              <Info label="Status" value={<LeadStatusBadge status={lead.status} />} />
              <Info label="Prioridade" value={<LeadPriorityBadge priority={lead.priority} />} />
              <Info label="Score" value={<LeadScoreBadge score={lead.lead_score} />} />
              <Info label="Resumo curto" value={lead.notes || lead.interest_type || "Sem resumo registrado."} />
            </InfoGrid>
          </section>

          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Dados da obra</h2>
            <InfoGrid>
              <Info label="Tipo de obra" value={lead.project_type || "A confirmar"} />
              <Info label="Tipo de interesse" value={lead.interest_type || "A confirmar"} />
              <Info label="Metragem aproximada" value={lead.approximate_area ? `${lead.approximate_area} m2` : "A confirmar"} />
              <Info label="Possui terreno" value={lead.has_land ? "Sim" : "Nao informado"} />
              <Info label="Possui planta/projeto" value={lead.has_blueprint ? "Sim" : "Nao informado"} />
              <Info label="Orcamento anterior" value={lead.has_previous_quote ? "Sim" : "Nao informado"} />
              <Info label="Prazo desejado" value={lead.desired_start_time || "A confirmar"} />
              <Info label="Faixa de orcamento" value={lead.budget_range || "A confirmar"} />
              <Info label="Valor potencial" value={formatCurrency(lead.potential_value)} />
            </InfoGrid>
          </section>

          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Resumo para visita</h2>
            <p className="rounded-xl border bg-secondary/35 p-4 text-sm leading-7 shadow-inner print:bg-white">{buildVisitSummary(lead)}</p>
          </section>

          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Pontos para confirmar na visita</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {visitChecklist.map((item) => (
                <div key={item} className="rounded-xl border bg-card p-3 text-sm shadow-xs">
                  [ ] {item}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Historico resumido</h2>
            {leadInteractions.length ? (
              <div className="space-y-3">
                {leadInteractions.map((interaction) => (
                  <div key={interaction.id} className="rounded-xl border bg-card p-3 text-sm shadow-xs">
                    <p className="font-medium">
                      {format(parseISO(interaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} - {interaction.interaction_type}
                    </p>
                    <p className="mt-1 text-muted-foreground print:text-slate-700">{interaction.description}</p>
                    {interaction.next_step ? <p className="mt-1 text-xs text-muted-foreground print:text-slate-600">Proximo: {interaction.next_step}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">Nenhuma interacao registrada.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold text-foreground print:text-slate-950">Proxima acao</h2>
            <InfoGrid>
              <Info label="Data da visita" value={lead.visit_scheduled_at ? formatDateTime(lead.visit_scheduled_at) : "A definir"} />
              <Info label="Status da visita" value={lead.visit_status || "Aguardando agendamento"} />
              <Info label="Proximo passo" value={lead.next_action_at ? formatDateTime(lead.next_action_at) : "A definir"} />
              <Info label="Observacoes internas" value={lead.notes || "Sem observacoes internas."} />
            </InfoGrid>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-secondary/35 p-3 shadow-xs print:bg-white">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function buildVisitSummary(lead: Lead) {
  const place = [lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "local ainda nao confirmado";
  const blueprint = lead.has_blueprint ? "possui planta/projeto" : "ainda nao informou planta/projeto";
  const land = lead.has_land ? "possui terreno" : "terreno ainda precisa ser confirmado";
  const area = lead.approximate_area ? `metragem aproximada de ${lead.approximate_area} m2` : "metragem ainda nao confirmada";
  const interest = lead.interest_type || lead.project_type || "construcao em steel frame";
  return `Cliente interessado em ${interest} em ${place}. ${blueprint}, ${land} e ${area}. Recomenda-se confirmar metragem, padrao de acabamento, acesso ao terreno, restricoes do local, expectativa de prazo e se busca obra completa ou etapa especifica.`;
}

function formatDateOnly(value: string) {
  return format(parseISO(value.length === 10 ? `${value}T00:00:00` : value), "dd/MM/yyyy", { locale: ptBR });
}

function formatDateTime(value: string) {
  return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}
