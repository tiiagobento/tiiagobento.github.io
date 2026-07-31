"use client";

import { FileText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { EstimateForm } from "@/components/steel-frame/estimate-form";
import { Card, CardContent } from "@/components/ui/card";

export default function NewEstimatePage() {
  const searchParams = useSearchParams();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="page-hero">
        <CardContent className="flex gap-3 p-5 sm:p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent"><FileText className="size-5" /></span>
          <div><h1 className="text-2xl font-semibold">Novo orcamento</h1><p className="mt-1 text-sm text-white/72">Comece pelo contexto comercial. As medidas e os custos serao revisados em etapas.</p></div>
        </CardContent>
      </Card>
      <EstimateForm initialLeadId={searchParams.get("leadId")} />
    </div>
  );
}
