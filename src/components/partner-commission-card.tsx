"use client";

import * as React from "react";
import { BadgeDollarSign, CheckCircle2, Clock3, Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Lead, PartnerCommission, ProfileRole } from "@/lib/types";

function isMissingCommissionFeature(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "message" in error
    && typeof error.message === "string"
    && (error.message.includes("partner_commissions") || error.message.includes("partner_submit_sale_commission"));
}

function statusLabel(status: PartnerCommission["status"]) {
  if (status === "confirmed") return "Repasse confirmado";
  if (status === "transfer_reported") return "Repasse informado";
  if (status === "cancelled") return "Cancelado";
  return "Aguardando repasse";
}

function statusVariant(status: PartnerCommission["status"]) {
  if (status === "confirmed") return "success" as const;
  if (status === "transfer_reported") return "warning" as const;
  if (status === "cancelled") return "danger" as const;
  return "secondary" as const;
}

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA");
}

export function PartnerCommissionCard({ lead, role }: { lead: Lead; role?: ProfileRole }) {
  const [commission, setCommission] = React.useState<PartnerCommission | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [unavailable, setUnavailable] = React.useState(false);
  const [saleAmount, setSaleAmount] = React.useState("");
  const [saleClosedAt, setSaleClosedAt] = React.useState(todayInputValue());
  const [transferDueDate, setTransferDueDate] = React.useState("");
  const [transferReference, setTransferReference] = React.useState("");

  const loadCommission = React.useCallback(async () => {
    if (!supabase || !lead.partner_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_commissions")
      .select("*")
      .eq("lead_id", lead.id)
      .maybeSingle();

    if (error) {
      if (isMissingCommissionFeature(error)) setUnavailable(true);
      else toast.error("Nao foi possivel carregar o controle de repasse.");
    } else {
      const nextCommission = data as PartnerCommission | null;
      setCommission(nextCommission);
      setUnavailable(false);
      if (nextCommission) {
        setSaleAmount(String(nextCommission.sale_amount));
        setSaleClosedAt(nextCommission.sale_closed_at);
        setTransferDueDate(nextCommission.transfer_due_date ?? "");
        setTransferReference(nextCommission.transfer_reference ?? "");
      }
    }
    setLoading(false);
  }, [lead.id, lead.partner_id]);

  React.useEffect(() => {
    void loadCommission();
  }, [loadCommission]);

  if (!lead.partner_id) return null;

  async function submitCommission(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(saleAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor de venda valido.");
      return;
    }
    if (!saleClosedAt) {
      toast.error("Informe a data do fechamento.");
      return;
    }
    setSaving(true);
    try {
      if (!supabase) throw new Error("Supabase nao esta configurado.");
      const { data, error } = await supabase.rpc("partner_submit_sale_commission", {
        target_lead_id: lead.id,
        reported_sale_amount: amount,
        reported_sale_closed_at: saleClosedAt,
        reported_transfer_due_date: transferDueDate || null,
        reported_transfer_reference: transferReference.trim() || null,
      });
      if (error) throw error;
      setCommission(data as PartnerCommission);
      toast.success(transferReference.trim() ? "Fechamento e repasse informados." : "Fechamento informado. O repasse de 5% ficou pendente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel registrar o fechamento.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCommission() {
    if (!commission || !supabase) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("admin_confirm_partner_commission", { target_commission_id: commission.id });
      if (error) throw error;
      setCommission(data as PartnerCommission);
      toast.success("Repasse de 5% confirmado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel confirmar o repasse.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-accent/30 bg-accent/[0.035]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeDollarSign className="size-5 text-accent" />
          Fechamento e repasse
        </CardTitle>
        <CardDescription>O parceiro informa o fechamento; o CRM calcula 5% e o administrador confirma o recebimento. Nenhum pagamento e feito automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unavailable ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">Aplique a migration <code>add_partner_commissions_and_lead_files.sql</code> para liberar o controle de repasse.</div> : null}
        {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando fechamento...</div> : null}

        {!loading && !unavailable && commission ? (
          <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium"><ReceiptText className="size-4 text-accent" /> Registro do fechamento</div>
              <Badge variant={statusVariant(commission.status)}>{statusLabel(commission.status)}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Venda informada" value={formatCurrency(commission.sale_amount)} />
              <Metric label="Repasse Nova Forma (5%)" value={formatCurrency(commission.commission_amount)} />
              <Metric label="Fechamento" value={new Intl.DateTimeFormat("pt-BR").format(new Date(`${commission.sale_closed_at}T12:00:00`))} />
              <Metric label="Prazo do repasse" value={commission.transfer_due_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${commission.transfer_due_date}T12:00:00`)) : "A confirmar"} />
            </div>
            {commission.transfer_reference ? <p className="rounded-lg bg-secondary/45 p-3 text-sm"><span className="font-medium">Referencia/comprovante:</span> {commission.transfer_reference}</p> : null}
            {role === "admin" && commission.status !== "confirmed" ? (
              <Button type="button" onClick={() => void confirmCommission()} disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Confirmar recebimento do repasse
              </Button>
            ) : null}
            {role === "partner" && commission.status !== "confirmed" ? <p className="text-xs text-muted-foreground">Para complementar a referencia do repasse, envie o formulario abaixo novamente.</p> : null}
          </div>
        ) : null}

        {!loading && !unavailable && role === "partner" && commission?.status !== "confirmed" ? (
          <form onSubmit={submitCommission} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-medium">{commission ? "Atualizar repasse" : "Informar fechamento"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Ao salvar, o lead passa para fechado e o administrador recebe uma notificacao para acompanhar os 5%.</p>
            </div>
            <Field label="Valor final da venda"><Input inputMode="decimal" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} placeholder="Ex: 250000" /></Field>
            <Field label="Data do fechamento"><Input type="date" value={saleClosedAt} onChange={(event) => setSaleClosedAt(event.target.value)} /></Field>
            <Field label="Prazo combinado para repasse"><Input type="date" value={transferDueDate} onChange={(event) => setTransferDueDate(event.target.value)} /></Field>
            <Field label="Referencia ou comprovante"><Input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} placeholder="PIX, recibo ou observacao" /></Field>
            <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg bg-secondary/45 p-3 text-sm">
              <span className="text-muted-foreground">Comissao de indicacao</span>
              <strong>{saleAmount && Number.isFinite(Number(saleAmount.replace(",", "."))) ? formatCurrency(Number(saleAmount.replace(",", ".")) * 0.05) : "5% da venda"}</strong>
            </div>
            <Button disabled={saving} className="sm:col-span-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Clock3 className="size-4" />}
              {commission ? "Atualizar informacao" : "Registrar fechamento"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-secondary/25 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
