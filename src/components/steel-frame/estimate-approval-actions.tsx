"use client";

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigationAccess } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { approveSteelFrameEstimate, getSteelFrameErrorMessage } from "@/lib/steel-frame/data";
import type { SteelFrameEstimateRecord } from "@/lib/steel-frame/types";

export function EstimateApprovalActions({
  estimate,
  onApproved,
}: {
  estimate: SteelFrameEstimateRecord;
  onApproved: (estimate: SteelFrameEstimateRecord) => void;
}) {
  const { role, permissions, loading } = useNavigationAccess();
  const [notes, setNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const canApprove = role === "admin" || permissions.includes("*") || permissions.includes("estimates.approve");

  if (estimate.status === "approved" || estimate.status === "proposal_generated" || estimate.status === "sent" || estimate.status === "accepted") {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/[0.05]">
        <CardContent className="flex gap-3 p-4 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><div><p className="font-medium text-foreground">Versao aprovada e congelada</p><p className="mt-1 text-muted-foreground">Para alterar medidas, custos ou documentos, crie uma nova versao do orcamento.</p></div></CardContent>
      </Card>
    );
  }

  if (estimate.status !== "in_review") {
    return <Card className="border-primary/10"><CardContent className="p-4 text-sm text-muted-foreground">Quando os dados estiverem revisados, altere a etapa para <strong className="font-medium text-foreground">Em revisao</strong> para liberar a aprovacao tecnica.</CardContent></Card>;
  }

  if (loading) return <div className="h-28 animate-pulse rounded-xl bg-muted" aria-label="Carregando permissoes de aprovacao" />;

  if (!canApprove) {
    return <Card className="border-primary/10"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p>Este orcamento esta em revisao. A aprovacao depende do responsavel tecnico ou de um administrador com permissao explicita.</p></CardContent></Card>;
  }

  async function approve() {
    setApproving(true);
    try {
      const saved = await approveSteelFrameEstimate(estimate.id, notes);
      onApproved(saved);
      toast.success("Versao tecnica aprovada e congelada.");
    } catch (approvalError) {
      toast.error(getSteelFrameErrorMessage(approvalError));
    } finally {
      setApproving(false);
    }
  }

  return (
    <Card className="border-accent/30 bg-accent/[0.045]">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><ShieldCheck className="size-4" /> Aprovacao tecnica</CardTitle></CardHeader>
      <CardContent className="space-y-3"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={10000} placeholder="Parecer tecnico, premissas ou ressalvas da aprovacao." disabled={approving} /><div className="flex justify-end"><Button type="button" onClick={() => void approve()} disabled={approving}>{approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{approving ? "Aprovando..." : "Aprovar e congelar versao"}</Button></div></CardContent>
    </Card>
  );
}
