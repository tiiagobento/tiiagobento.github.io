"use client";

import { ArrowLeft, Building2, Calculator, CheckCircle2, FileText, LockKeyhole, Plus, Ruler, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstimateCosting } from "@/components/steel-frame/estimate-costing";
import { EstimateApprovalActions } from "@/components/steel-frame/estimate-approval-actions";
import { EstimateDocuments } from "@/components/steel-frame/estimate-documents";
import { EstimateProposalActions } from "@/components/steel-frame/estimate-proposal-actions";
import {
  addSteelFrameOpening,
  addSteelFrameWall,
  getSteelFrameErrorMessage,
  getSteelFrameEstimate,
  getSteelFrameGeometry,
  updateSteelFrameEstimateStatus,
} from "@/lib/steel-frame/data";
import { calculateWallAreas } from "@/lib/steel-frame/calculator";
import { steelFrameOpeningSchema, steelFrameWallSegmentSchema } from "@/lib/steel-frame/schemas";
import { isSteelFrameEstimateFrozenStatus, type SteelFrameEstimateRecord, type SteelFrameOpeningRecord, type SteelFrameWallSegmentRecord } from "@/lib/steel-frame/types";

type EstimateDetailProps = {
  estimateId: string;
};

const statusOptions = [
  ["draft", "Rascunho"],
  ["needs_information", "Aguardando dados"],
  ["in_review", "Em revisao"],
] as const;

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

export function EstimateDetail({ estimateId }: EstimateDetailProps) {
  const [estimate, setEstimate] = useState<SteelFrameEstimateRecord | null>(null);
  const [walls, setWalls] = useState<SteelFrameWallSegmentRecord[]>([]);
  const [openings, setOpenings] = useState<SteelFrameOpeningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingWall, setSavingWall] = useState(false);
  const [savingOpening, setSavingOpening] = useState(false);
  const [wallForm, setWallForm] = useState({ label: "", length: "", height: "", quantity: "1" });
  const [openingForm, setOpeningForm] = useState({ label: "", width: "", height: "", quantity: "1", wallId: "unlinked" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [estimateResult, geometry] = await Promise.all([
        getSteelFrameEstimate(estimateId),
        getSteelFrameGeometry(estimateId),
      ]);
      if (!estimateResult) {
        setError("Orcamento nao encontrado ou indisponivel para sua conta.");
        return;
      }
      setEstimate(estimateResult);
      setWalls(geometry.walls);
      setOpenings(geometry.openings);
      if (estimateResult.standard_wall_height_meters) {
        setWallForm((current) => ({ ...current, height: current.height || String(estimateResult.standard_wall_height_meters) }));
      }
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [estimateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const areas = useMemo(
    () => calculateWallAreas(
      walls.map((wall) => ({
        id: wall.id,
        label: wall.label,
        lengthMeters: Number(wall.length_meters),
        heightMeters: Number(wall.height_meters),
        quantity: wall.quantity,
        confirmationStatus: wall.confirmation_status,
      })),
      openings.map((opening) => ({
        id: opening.id,
        wallSegmentId: opening.wall_segment_id,
        label: opening.label,
        widthMeters: Number(opening.width_meters),
        heightMeters: Number(opening.height_meters),
        quantity: opening.quantity,
        subtractFromWallArea: opening.subtract_from_wall_area,
        confirmationStatus: opening.confirmation_status,
      })),
    ),
    [openings, walls],
  );

  async function changeStatus(value: string) {
    if (!estimate) return;
    setSavingStatus(true);
    try {
      const saved = await updateSteelFrameEstimateStatus(estimate.id, value as SteelFrameEstimateRecord["status"]);
      setEstimate((current) => current ? { ...current, ...saved } : saved);
      toast.success("Etapa do orcamento atualizada.");
    } catch (updateError) {
      toast.error(getSteelFrameErrorMessage(updateError));
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveWall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!estimate) return;
    const parsed = steelFrameWallSegmentSchema.safeParse({
      label: wallForm.label,
      lengthMeters: Number(wallForm.length),
      heightMeters: Number(wallForm.height),
      quantity: Number(wallForm.quantity),
      confirmationStatus: "confirmed",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os dados da parede.");
      return;
    }

    setSavingWall(true);
    try {
      const wall = await addSteelFrameWall(estimate.id, parsed.data, walls.length);
      setWalls((current) => [...current, wall]);
      setWallForm((current) => ({ ...current, label: "", length: "", quantity: "1" }));
      toast.success("Trecho de parede adicionado.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingWall(false);
    }
  }

  async function saveOpening(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!estimate) return;
    const parsed = steelFrameOpeningSchema.safeParse({
      label: openingForm.label,
      wallSegmentId: openingForm.wallId === "unlinked" ? null : openingForm.wallId,
      widthMeters: Number(openingForm.width),
      heightMeters: Number(openingForm.height),
      quantity: Number(openingForm.quantity),
      subtractFromWallArea: true,
      confirmationStatus: "confirmed",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os dados da abertura.");
      return;
    }

    setSavingOpening(true);
    try {
      const opening = await addSteelFrameOpening(estimate.id, parsed.data, openings.length);
      setOpenings((current) => [...current, opening]);
      setOpeningForm({ label: "", width: "", height: "", quantity: "1", wallId: "unlinked" });
      toast.success("Abertura adicionada.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingOpening(false);
    }
  }

  if (loading) return <EstimateDetailSkeleton />;

  if (!estimate || error) {
    return (
      <Card className="border-destructive/25">
        <CardContent className="space-y-4 p-6">
          <p className="font-medium text-destructive">{error ?? "Orcamento nao encontrado."}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()}>Tentar novamente</Button>
            <Button asChild><Link href="/estimates">Voltar para orcamentos</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isReadOnly = isSteelFrameEstimateFrozenStatus(estimate.status);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <Link href="/estimates" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary">
            <ArrowLeft className="size-4" /> Orcamentos
          </Link>
          <h1 className="truncate text-2xl font-semibold text-foreground">{estimate.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {estimate.lead?.name ?? "Sem lead vinculado"}
            {estimate.city ? ` - ${estimate.city}` : ""}
            {estimate.neighborhood ? `, ${estimate.neighborhood}` : ""}
          </p>
        </div>
        <div className="w-full sm:w-52">
          <Label className="mb-2 block">Etapa</Label>
          {statusOptions.some(([value]) => value === estimate.status) && !isReadOnly ? <Select value={estimate.status} onValueChange={(value) => void changeStatus(value)} disabled={savingStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select> : <div className="flex min-h-9 items-center rounded-md border bg-secondary/35 px-3 text-sm font-medium text-foreground">{statusLabels[estimate.status]}</div>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Metric label="Area bruta" value={`${areas.grossWallArea.toFixed(2)} m2`} icon={Ruler} />
        <Metric label="Aberturas" value={`${areas.openingArea.toFixed(2)} m2`} icon={Building2} />
        <Metric label="Area liquida" value={`${areas.netWallArea.toFixed(2)} m2`} icon={Calculator} accent />
      </div>

      {areas.warnings.length ? (
        <Card className="border-amber-500/30 bg-amber-500/[0.05]">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-900 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <div>{areas.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
          </CardContent>
        </Card>
      ) : null}

      {isReadOnly ? (
        <Card className="border-primary/20 bg-primary/[0.045]">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>Esta versao esta congelada para preservar os dados tecnicos e financeiros que sustentam a proposta. A consulta continua disponivel, mas novos documentos, medidas e custos exigem uma nova versao.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-primary"><Ruler className="size-4" /> Paredes confirmadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {walls.length ? (
              <div className="space-y-2">
                {walls.map((wall) => (
                  <div key={wall.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{wall.label}</p><p className="text-xs text-muted-foreground">{wall.length_meters} m x {wall.height_meters} m x {wall.quantity}</p></div>
                    <span className="shrink-0 font-medium text-primary">{Number(wall.gross_area_square_meters).toFixed(2)} m2</span>
                  </div>
                ))}
              </div>
            ) : <EmptyGeometry label="Nenhuma parede confirmada ainda." />}
            <form className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2" onSubmit={saveWall}>
              <fieldset disabled={isReadOnly} className="contents">
              <Field label="Identificacao"><Input value={wallForm.label} onChange={(event) => setWallForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex: Fachada frontal" /></Field>
              <Field label="Quantidade"><Input type="number" min={1} value={wallForm.quantity} onChange={(event) => setWallForm((current) => ({ ...current, quantity: event.target.value }))} /></Field>
              <Field label="Comprimento (m)"><Input type="number" step="0.01" min={0.01} value={wallForm.length} onChange={(event) => setWallForm((current) => ({ ...current, length: event.target.value }))} /></Field>
              <Field label="Altura (m)"><Input type="number" step="0.01" min={0.01} value={wallForm.height} onChange={(event) => setWallForm((current) => ({ ...current, height: event.target.value }))} /></Field>
              <Button type="submit" className="sm:col-span-2" disabled={isReadOnly || savingWall}><Plus className="size-4" />{savingWall ? "Adicionando..." : "Adicionar parede"}</Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-primary"><Building2 className="size-4" /> Portas e janelas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {openings.length ? (
              <div className="space-y-2">
                {openings.map((opening) => (
                  <div key={opening.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{opening.label}</p><p className="text-xs text-muted-foreground">{opening.width_meters} m x {opening.height_meters} m x {opening.quantity}</p></div>
                    <span className="shrink-0 font-medium text-primary">-{Number(opening.opening_area_square_meters).toFixed(2)} m2</span>
                  </div>
                ))}
              </div>
            ) : <EmptyGeometry label="Nenhuma abertura adicionada ainda." />}
            <form className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2" onSubmit={saveOpening}>
              <fieldset disabled={isReadOnly} className="contents">
              <Field label="Identificacao"><Input value={openingForm.label} onChange={(event) => setOpeningForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex: Porta de entrada" /></Field>
              <Field label="Quantidade"><Input type="number" min={1} value={openingForm.quantity} onChange={(event) => setOpeningForm((current) => ({ ...current, quantity: event.target.value }))} /></Field>
              <Field label="Largura (m)"><Input type="number" step="0.01" min={0.01} value={openingForm.width} onChange={(event) => setOpeningForm((current) => ({ ...current, width: event.target.value }))} /></Field>
              <Field label="Altura (m)"><Input type="number" step="0.01" min={0.01} value={openingForm.height} onChange={(event) => setOpeningForm((current) => ({ ...current, height: event.target.value }))} /></Field>
              <div className="sm:col-span-2"><Field label="Vincular a parede"><Select value={openingForm.wallId} onValueChange={(value) => setOpeningForm((current) => ({ ...current, wallId: value }))} disabled={isReadOnly}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unlinked">A confirmar</SelectItem>{walls.map((wall) => <SelectItem key={wall.id} value={wall.id}>{wall.label}</SelectItem>)}</SelectContent></Select></Field></div>
              <Button type="submit" className="sm:col-span-2" disabled={isReadOnly || savingOpening}><Plus className="size-4" />{savingOpening ? "Adicionando..." : "Adicionar abertura"}</Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      </div>

      <EstimateDocuments
        estimateId={estimate.id}
        wallCount={walls.length}
        openingCount={openings.length}
        onGeometryChanged={load}
        readOnly={isReadOnly}
      />
      <EstimateCosting estimateId={estimate.id} walls={walls} openings={openings} readOnly={isReadOnly} />
      <EstimateApprovalActions estimate={estimate} onApproved={(saved) => setEstimate(saved)} />
      <EstimateProposalActions estimate={estimate} onGenerated={(saved) => setEstimate(saved)} />

      <Card className="border-primary/10 bg-secondary/25">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">Revisao tecnica antes da proposta</p><p className="mt-1 text-sm text-muted-foreground">Os quantitativos e custos ficam registrados para revisao antes de qualquer proposta comercial.</p></div>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="size-4" /> Dados salvos no Supabase</span>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: typeof Ruler; accent?: boolean }) {
  return <Card className={accent ? "border-accent/35 bg-accent/[0.07]" : "border-primary/10"}><CardContent className="flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary"><Icon className="size-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-semibold">{value}</p></div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function EmptyGeometry({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{label}</p>;
}

function EstimateDetailSkeleton() {
  return <div className="space-y-5" aria-label="Carregando orcamento"><div className="h-36 animate-pulse rounded-2xl bg-muted" /><div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div><div className="grid gap-5 xl:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-96 animate-pulse rounded-xl bg-muted" />)}</div></div>;
}
