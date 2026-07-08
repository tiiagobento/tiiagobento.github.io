"use client";

import { PipelineBoard } from "@/components/pipeline-board";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";
import { Columns3 } from "lucide-react";

export default function PipelinePage() {
  const { leads, loading, moveLead } = useCrmData();
  if (loading) return <LoadingSkeleton />;
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/10 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent">
            <Columns3 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Pipeline comercial</h1>
            <p className="mt-1 text-sm text-white/72">Movimente oportunidades por etapa e priorize visitas e orcamentos.</p>
          </div>
        </CardContent>
      </Card>
      <PipelineBoard leads={leads} onMove={moveLead} />
    </div>
  );
}
