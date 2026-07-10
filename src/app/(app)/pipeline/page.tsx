"use client";

import Link from "next/link";
import { PipelineBoard } from "@/components/pipeline-board";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";
import { Columns3, Plus } from "lucide-react";

export default function PipelinePage() {
  const { leads, loading, moveLead } = useCrmData();
  if (loading) return <LoadingSkeleton />;
  const hotLeads = leads.filter((lead) => lead.lead_score >= 70).length;
  return (
    <div className="space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent">
              <Columns3 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Pipeline</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/72">Oportunidades por etapa, com filtros, WhatsApp e mudanca rapida de status.</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{leads.length} leads</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{hotLeads} quentes</span>
              </div>
            </div>
          </div>
          <Button asChild variant="accent" className="shrink-0">
            <Link href="/leads/new">
              <Plus className="size-4" />
              Novo lead
            </Link>
          </Button>
        </CardContent>
      </Card>
      <PipelineBoard leads={leads} onMove={moveLead} />
    </div>
  );
}
