import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { EstimateList } from "@/components/steel-frame/estimate-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function EstimatesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent"><FileText className="size-5" /></span>
            <div>
              <h1 className="text-2xl font-semibold">Orcamentos Steel Frame</h1>
              <p className="mt-1 text-sm text-white/72">Rascunhos rastreaveis, medidas confirmadas e revisao tecnica antes de qualquer proposta.</p>
            </div>
          </div>
          <Button variant="accent" asChild><Link href="/estimates/new"><Plus className="size-4" /> Novo orcamento</Link></Button>
        </CardContent>
      </Card>
      <EstimateList />
    </div>
  );
}
