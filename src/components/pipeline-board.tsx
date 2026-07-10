"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Flame, Search } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { daysSinceLastContact, isStaleLead } from "@/lib/business";
import { leadSources, pipelineStatuses, priorities } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Lead, LeadSource, LeadStatus, Priority } from "@/lib/types";

type PipelineFilters = {
  query: string;
  priority: "Todas" | Priority;
  source: "Todas" | LeadSource;
  assignedTo: "Todos" | string;
};

const statusStyles: Record<LeadStatus, string> = {
  "Novo lead": "border-slate-200 bg-slate-50/80 dark:border-slate-700/70 dark:bg-slate-900/35",
  "Aguardando resposta": "border-amber-200 bg-amber-50/70 dark:border-amber-800/70 dark:bg-amber-950/22",
  "Em triagem": "border-sky-200 bg-sky-50/70 dark:border-sky-800/70 dark:bg-sky-950/22",
  Qualificado: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-emerald-950/24",
  "Visita a marcar": "border-orange-200 bg-orange-50/70 dark:border-orange-800/70 dark:bg-orange-950/24",
  "Visita marcada": "border-blue-200 bg-blue-50/70 dark:border-blue-800/70 dark:bg-blue-950/24",
  "Visita realizada": "border-indigo-200 bg-indigo-50/70 dark:border-indigo-800/70 dark:bg-indigo-950/24",
  "Orcamento a enviar": "border-yellow-200 bg-yellow-50/70 dark:border-yellow-800/70 dark:bg-yellow-950/22",
  "Orcamento enviado": "border-amber-200 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/28",
  "Em negociacao": "border-violet-200 bg-violet-50/70 dark:border-violet-800/70 dark:bg-violet-950/24",
  Fechado: "border-emerald-300 bg-emerald-50/90 dark:border-emerald-700/80 dark:bg-emerald-950/32",
  Perdido: "border-red-200 bg-red-50/70 dark:border-red-800/70 dark:bg-red-950/26",
  "Sem resposta": "border-zinc-200 bg-zinc-50/70 dark:border-zinc-700/70 dark:bg-zinc-900/35",
};

export function PipelineBoard({ leads, onMove }: { leads: Lead[]; onMove: (id: string, status: LeadStatus) => Promise<void> }) {
  const [filters, setFilters] = React.useState<PipelineFilters>({
    query: "",
    priority: "Todas",
    source: "Todas",
    assignedTo: "Todos",
  });
  const [movingKey, setMovingKey] = React.useState<string | null>(null);

  const assignees = React.useMemo(() => Array.from(new Set(leads.map((lead) => lead.assigned_to).filter(Boolean))) as string[], [leads]);
  const filteredLeads = React.useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return leads.filter((lead) => {
      const haystack = [lead.name, lead.phone, lead.city, lead.neighborhood, lead.project_type, lead.source, lead.assigned_to]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (filters.priority === "Todas" || lead.priority === filters.priority) &&
        (filters.source === "Todas" || lead.source === filters.source) &&
        (filters.assignedTo === "Todos" || lead.assigned_to === filters.assignedTo)
      );
    });
  }, [filters, leads]);

  async function moveLead(lead: Lead, status: LeadStatus) {
    if (lead.status === status) return;
    const key = `${lead.id}:${status}`;
    setMovingKey(key);
    try {
      await onMove(lead.id, status);
    } finally {
      setMovingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/10">
        <CardContent className="grid gap-3 p-3 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex items-center rounded-lg border bg-background/80 px-3 shadow-xs transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
            <Search className="mr-2 size-4 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              className="border-0 bg-transparent px-0 focus-visible:ring-0"
              placeholder="Buscar por nome, cidade, telefone..."
            />
          </div>
          <PipelineSelect value={filters.priority} onChange={(priority) => setFilters((current) => ({ ...current, priority: priority as PipelineFilters["priority"] }))} options={["Todas", ...priorities]} />
          <PipelineSelect value={filters.source} onChange={(source) => setFilters((current) => ({ ...current, source: source as PipelineFilters["source"] }))} options={["Todas", ...leadSources]} />
          <PipelineSelect value={filters.assignedTo} onChange={(assignedTo) => setFilters((current) => ({ ...current, assignedTo }))} options={["Todos", ...assignees]} />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border bg-secondary/35 p-3 shadow-inner shadow-slate-950/[0.03] dark:bg-black/15 dark:shadow-black/30">
        <div className="grid auto-cols-[minmax(18.5rem,18.5rem)] grid-flow-col gap-3 pb-2">
          {pipelineStatuses.map((status) => {
            const columnLeads = filteredLeads.filter((lead) => lead.status === status);
            const hotCount = columnLeads.filter((lead) => lead.lead_score >= 70).length;
            return (
              <section key={status} className={cn("flex max-h-[72vh] min-h-[34rem] flex-col rounded-xl border shadow-sm", statusStyles[status])}>
                <header className="sticky top-0 z-10 rounded-t-xl border-b border-white/60 bg-white/72 px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/36">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-primary">{status}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{hotCount} quente(s)</p>
                    </div>
                    <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold shadow-xs ring-1 ring-border">{columnLeads.length}</span>
                  </div>
                </header>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {columnLeads.length ? (
                    columnLeads.map((lead) => (
                      <PipelineLeadCard key={lead.id} lead={lead} movingKey={movingKey} onMove={(nextStatus) => moveLead(lead, nextStatus)} />
                    ))
                  ) : (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-white/55 p-4 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                      Nenhum lead nesta etapa.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PipelineLeadCard({ lead, movingKey, onMove }: { lead: Lead; movingKey: string | null; onMove: (status: LeadStatus) => Promise<void> }) {
  const location = [lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Local a confirmar";
  const lastContact = lead.last_contact_at
    ? formatDistanceToNowStrict(parseISO(lead.last_contact_at), { addSuffix: true, locale: ptBR })
    : "Sem contato";
  const stale = isStaleLead(lead);

  return (
    <Card className="group border-white/80 bg-card/96 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg dark:border-white/10 dark:bg-card/92 dark:hover:border-accent/25">
      <CardHeader className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/leads/${lead.id}`} className="line-clamp-1 text-sm font-semibold text-primary transition group-hover:text-accent">
              {lead.name}
            </Link>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{location}</p>
          </div>
          {lead.lead_score >= 70 ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/15" title="Lead quente">
              <Flame className="size-4" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <LeadPriorityBadge priority={lead.priority} />
          <LeadStatusBadge status={lead.status} />
          <LeadScoreBadge score={lead.lead_score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        <div className="grid gap-2 text-xs text-muted-foreground">
          <p className="line-clamp-1">
            <span className="font-semibold text-foreground">Obra:</span> {lead.project_type || lead.interest_type || "A confirmar"}
          </p>
          <p className="line-clamp-1">
            <span className="font-semibold text-foreground">Origem:</span> {lead.source}
          </p>
          <p className="line-clamp-1">
            <span className="font-semibold text-foreground">Responsavel:</span> {lead.assigned_to || "Tiago"}
          </p>
          <p className="flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            {lastContact}
          </p>
          {stale ? <p className="rounded-lg bg-red-50 px-2 py-1 font-medium text-red-700 dark:bg-red-950/35 dark:text-red-200 dark:ring-1 dark:ring-red-900/50">Sem retorno ha {daysSinceLastContact(lead)} dias</p> : null}
        </div>

        <Select value={lead.status} onValueChange={(status) => onMove(status as LeadStatus)} disabled={Boolean(movingKey)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pipelineStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/leads/${lead.id}`}>
              <ExternalLink className="size-4" />
              Abrir
            </Link>
          </Button>
          <WhatsAppButton lead={lead} size="sm" />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <QuickMoveButton label="Orc." status="Orcamento enviado" current={lead.status} moving={movingKey === `${lead.id}:Orcamento enviado`} onMove={onMove} />
          <QuickMoveButton label="Fechar" status="Fechado" current={lead.status} moving={movingKey === `${lead.id}:Fechado`} onMove={onMove} />
          <QuickMoveButton label="Perder" status="Perdido" current={lead.status} moving={movingKey === `${lead.id}:Perdido`} onMove={onMove} />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickMoveButton({ label, status, current, moving, onMove }: { label: string; status: LeadStatus; current: LeadStatus; moving: boolean; onMove: (status: LeadStatus) => Promise<void> }) {
  return (
    <Button type="button" variant="ghost" size="sm" disabled={current === status || moving} onClick={() => onMove(status)} className="h-8 px-2 text-xs">
      {moving ? "..." : label}
    </Button>
  );
}

function PipelineSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
