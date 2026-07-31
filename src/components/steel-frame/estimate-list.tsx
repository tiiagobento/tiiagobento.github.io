"use client";

import { ArrowRight, FileText, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSteelFrameErrorMessage, listSteelFrameEstimates } from "@/lib/steel-frame/data";
import type { SteelFrameEstimateRecord } from "@/lib/steel-frame/types";

const statusLabels: Record<SteelFrameEstimateRecord["status"], string> = {
  draft: "Rascunho",
  needs_information: "Aguardando dados",
  in_review: "Em revisao",
  approved: "Aprovado",
  proposal_generated: "Proposta gerada",
  sent: "Enviado",
  accepted: "Aceito",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const statusClasses: Record<SteelFrameEstimateRecord["status"], string> = {
  draft: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  needs_information: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  in_review: "bg-sky-500/10 text-sky-800 dark:text-sky-200",
  approved: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  proposal_generated: "bg-violet-500/10 text-violet-800 dark:text-violet-200",
  sent: "bg-blue-500/10 text-blue-800 dark:text-blue-200",
  accepted: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
  expired: "bg-orange-500/10 text-orange-800 dark:text-orange-200",
  cancelled: "bg-destructive/10 text-destructive",
};

export function EstimateList() {
  const [estimates, setEstimates] = useState<SteelFrameEstimateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEstimates(await listSteelFrameEstimates());
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <EstimateListSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive/25">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-destructive">Nao foi possivel carregar os orcamentos.</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!estimates.length) {
    return (
      <Card className="border-dashed border-primary/20">
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <FileText className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum orcamento criado</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Comece por um rascunho comercial, confirme as medidas e avance para a revisao tecnica com historico completo.</p>
          <Button className="mt-5" asChild>
            <Link href="/estimates/new">
              <Plus className="size-4" />
              Novo orcamento
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {estimates.map((estimate) => (
        <Link key={estimate.id} href={`/estimates/${estimate.id}`} className="group block">
          <Card className="h-full border-primary/10 transition group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{estimate.title}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {estimate.lead?.name ?? "Sem lead vinculado"}
                    {estimate.city ? ` - ${estimate.city}` : ""}
                    {estimate.neighborhood ? `, ${estimate.neighborhood}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[estimate.status]}`}>
                  {statusLabels[estimate.status]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                <span>{estimate.mode === "technical" ? "Tecnico" : "Comercial"} - v{estimate.current_version_number}</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">Abrir <ArrowRight className="size-3.5" /></span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
      <Card className="border-dashed border-primary/20 bg-secondary/20">
        <CardContent className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-5 text-center">
          <ShieldCheck className="size-5 text-accent" />
          <p className="text-sm text-muted-foreground">Versoes e dados financeiros sao protegidos por permissao.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/estimates/new"><Plus className="size-4" /> Novo orcamento</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EstimateListSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-label="Carregando orcamentos">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item} className="border-primary/10">
          <CardContent className="space-y-4 p-5">
            <div className="h-5 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-8 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
