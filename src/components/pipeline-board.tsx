"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadCard } from "@/components/lead-card";
import { pipelineStatuses } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/lib/types";

export function PipelineBoard({ leads, onMove }: { leads: Lead[]; onMove: (id: string, status: LeadStatus) => Promise<void> }) {
  return (
    <div className="grid gap-4 overflow-x-auto pb-4 xl:grid-cols-4 2xl:grid-cols-8">
      {pipelineStatuses.map((status, statusIndex) => {
        const columnLeads = leads.filter((lead) => normalizePipelineStatus(lead.status) === status);
        const nextStatus = pipelineStatuses[Math.min(statusIndex + 1, pipelineStatuses.length - 1)];
        return (
          <Card key={status} className="min-w-72 bg-secondary/30 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">{status}</CardTitle>
              <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold shadow-xs">{columnLeads.length}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {columnLeads.map((lead) => (
                <div key={lead.id} className="space-y-2">
                  <LeadCard lead={lead} />
                  {status !== nextStatus ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => onMove(lead.id, nextStatus)}>
                      Mover para {nextStatus}
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function normalizePipelineStatus(status: LeadStatus): LeadStatus {
  if (status === "Aguardando resposta" || status === "Sem resposta") return "Novo lead";
  if (status === "Visita a marcar" || status === "Visita realizada") return "Visita marcada";
  if (status === "Orcamento a enviar") return "Orcamento enviado";
  return status;
}
