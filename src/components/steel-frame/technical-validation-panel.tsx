"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createSteelFrameTechnicalAssessment,
  getLatestSteelFrameTechnicalAssessment,
  getSteelFrameErrorMessage,
  listSteelFrameTechnicalCompositions,
} from "@/lib/steel-frame/data";
import { assessSteelFrameTechnicalComposition } from "@/lib/steel-frame/technical-rules";
import type {
  SteelFrameEstimateRecord,
  SteelFrameOpeningRecord,
  SteelFrameTechnicalAssessmentRecord,
  SteelFrameTechnicalClassification,
  SteelFrameTechnicalCompositionRecord,
  SteelFrameTechnicalValidationContext,
  SteelFrameWallSegmentRecord,
} from "@/lib/steel-frame/types";

type TechnicalValidationPanelProps = {
  estimate: SteelFrameEstimateRecord;
  walls: SteelFrameWallSegmentRecord[];
  openings: SteelFrameOpeningRecord[];
  geometryWarnings?: string[];
  readOnly?: boolean;
};

const initialContext: SteelFrameTechnicalValidationContext = {
  wallUse: "unknown",
  studSpacingMeters: null,
  windValidation: "unknown",
  roofComplexity: "unknown",
};

const classificationStyles: Record<SteelFrameTechnicalClassification, { label: string; variant: "success" | "warning" | "danger" }> = {
  automatic: { label: "ORCAMENTO AUTOMATICO", variant: "success" },
  preliminary: { label: "ORCAMENTO PRELIMINAR", variant: "warning" },
  technical_review_required: { label: "REVISAO TECNICA OBRIGATORIA", variant: "danger" },
};

function isCompositionCurrent(composition: SteelFrameTechnicalCompositionRecord) {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveFrom = composition.effective_from;
  return composition.status === "approved"
    && effectiveFrom !== null
    && effectiveFrom <= today
    && (!composition.effective_to || composition.effective_to >= today);
}

function parseSavedContext(value: unknown): SteelFrameTechnicalValidationContext {
  if (!value || typeof value !== "object") return initialContext;
  const context = (value as { context?: Partial<SteelFrameTechnicalValidationContext> }).context;
  if (!context) return initialContext;
  return {
    wallUse: context.wallUse === "structural" || context.wallUse === "non_structural" ? context.wallUse : "unknown",
    studSpacingMeters: typeof context.studSpacingMeters === "number" && Number.isFinite(context.studSpacingMeters) ? context.studSpacingMeters : null,
    windValidation: context.windValidation === "confirmed" || context.windValidation === "pending" ? context.windValidation : "unknown",
    roofComplexity: context.roofComplexity === "simple" || context.roofComplexity === "complex" ? context.roofComplexity : "unknown",
  };
}

export function TechnicalValidationPanel({
  estimate,
  walls,
  openings,
  geometryWarnings = [],
  readOnly = false,
}: TechnicalValidationPanelProps) {
  const [compositions, setCompositions] = useState<SteelFrameTechnicalCompositionRecord[]>([]);
  const [selectedCompositionId, setSelectedCompositionId] = useState("unselected");
  const [context, setContext] = useState<SteelFrameTechnicalValidationContext>(initialContext);
  const [latestAssessment, setLatestAssessment] = useState<SteelFrameTechnicalAssessmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCompositions, assessment] = await Promise.all([
        listSteelFrameTechnicalCompositions(),
        getLatestSteelFrameTechnicalAssessment(estimate.id),
      ]);
      setCompositions(nextCompositions);
      setLatestAssessment(assessment);
      if (assessment) {
        setContext(parseSavedContext(assessment.input_snapshot));
        if (assessment.composition_id && nextCompositions.some((composition) => composition.id === assessment.composition_id)) {
          setSelectedCompositionId(assessment.composition_id);
        }
      }
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [estimate.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const approvedCompositions = useMemo(
    () => compositions.filter(isCompositionCurrent),
    [compositions],
  );
  const selectedComposition = approvedCompositions.find((composition) => composition.id === selectedCompositionId) ?? null;
  const assessment = useMemo(
    () => assessSteelFrameTechnicalComposition({
      estimate,
      walls,
      openings,
      composition: selectedComposition,
      context,
      geometryWarnings,
    }),
    [context, estimate, geometryWarnings, openings, selectedComposition, walls],
  );
  const classification = classificationStyles[assessment.classification];

  async function saveAssessment() {
    setSaving(true);
    try {
      const saved = await createSteelFrameTechnicalAssessment({
        estimateId: estimate.id,
        compositionId: selectedComposition?.id ?? null,
        classification: assessment.classification,
        inputSnapshot: {
          context,
          estimate: {
            standardWallHeightMeters: estimate.standard_wall_height_meters,
            expectedFloors: estimate.expected_floors,
          },
          geometry: {
            wallCount: walls.length,
            openingCount: openings.length,
            warnings: geometryWarnings,
          },
        },
        findings: assessment.findings,
        missingInformation: assessment.missingInformation,
        ruleSnapshot: assessment.ruleSnapshot,
      });
      setLatestAssessment(saved);
      toast.success("Validacao tecnica registrada no historico do orcamento.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <TechnicalValidationSkeleton />;

  if (error) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" /><p>{error}</p></div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-label="Validacao tecnica do orcamento">
      <Card className="border-primary/15">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-primary"><ClipboardCheck className="size-4" /> Validacao tecnica</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Selecione somente composicoes aprovadas. O motor compara os limites explicitamente cadastrados e registra a decisao.</p>
            </div>
            <Badge variant={classification.variant}>{classification.label}</Badge>
          </div>
          <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.055] p-3 text-xs leading-5 text-amber-950 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p>Estimativa comercial e de quantitativos. Nao substitui projeto estrutural, validacao do responsavel tecnico nem ART.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {approvedCompositions.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Composicao aprovada" className="md:col-span-2">
                <Select value={selectedCompositionId} onValueChange={setSelectedCompositionId} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecionar composicao" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unselected">A confirmar</SelectItem>
                    {approvedCompositions.map((composition) => <SelectItem key={composition.id} value={composition.id}>{composition.code} v{composition.version} - {composition.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Uso da parede">
                <Select value={context.wallUse} onValueChange={(value) => setContext((current) => ({ ...current, wallUse: value as SteelFrameTechnicalValidationContext["wallUse"] }))} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="unknown">A confirmar</SelectItem><SelectItem value="structural">Estrutural</SelectItem><SelectItem value="non_structural">Vedacao</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Espacamento informado (m)"><Input inputMode="decimal" value={context.studSpacingMeters ?? ""} onChange={(event) => setContext((current) => ({ ...current, studSpacingMeters: parseDecimal(event.target.value) }))} placeholder="Somente valor confirmado" disabled={readOnly} /></Field>
              <Field label="Validacao de vento">
                <Select value={context.windValidation} onValueChange={(value) => setContext((current) => ({ ...current, windValidation: value as SteelFrameTechnicalValidationContext["windValidation"] }))} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="unknown">A confirmar</SelectItem><SelectItem value="confirmed">Confirmada</SelectItem><SelectItem value="pending">Pendente</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Cobertura">
                <Select value={context.roofComplexity} onValueChange={(value) => setContext((current) => ({ ...current, roofComplexity: value as SteelFrameTechnicalValidationContext["roofComplexity"] }))} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="unknown">A confirmar</SelectItem><SelectItem value="simple">Simples</SelectItem><SelectItem value="complex">Complexa</SelectItem></SelectContent>
                </Select>
              </Field>
              {selectedComposition ? <div className="rounded-lg border border-border/70 bg-secondary/30 p-3 text-xs text-muted-foreground md:col-span-2 xl:col-span-2"><p className="font-medium text-foreground">{selectedComposition.profile_specification || "Perfil a confirmar"}</p><p className="mt-1">Responsavel: {selectedComposition.technical_responsible_name || "A confirmar"} {selectedComposition.technical_responsible_registration ? `- ${selectedComposition.technical_responsible_registration}` : ""}</p></div> : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-primary/25 bg-secondary/20 p-5 text-sm text-muted-foreground">
              Nenhuma composicao tecnica aprovada esta disponivel. Cadastre um rascunho com referencias, limites, responsavel tecnico e regras vinculadas antes de liberar qualquer classificacao automatica.
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
            <p className="text-sm font-medium text-foreground">{assessment.summary}</p>
            {assessment.findings.length ? <ul className="mt-3 space-y-2">{assessment.findings.map((finding) => <li key={`${finding.code}-${finding.message}`} className="flex gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{finding.message}</li>)}</ul> : null}
            {assessment.missingInformation.length ? <ul className="mt-3 space-y-2">{assessment.missingInformation.map((item) => <li key={item} className="flex gap-2 text-sm text-amber-900 dark:text-amber-100"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />{item}</li>)}</ul> : null}
            {!assessment.findings.length && !assessment.missingInformation.length ? <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" /> Todas as condicoes explicitamente cadastradas foram atendidas.</p> : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">A validacao registra as entradas, referencias e regras usadas neste momento. Nenhuma aprovacao estrutural e criada automaticamente.</p>
            <Button onClick={() => void saveAssessment()} disabled={readOnly || saving}>{saving ? "Registrando..." : "Registrar validacao"}</Button>
          </div>
        </CardContent>
      </Card>

      {latestAssessment ? <p className="px-1 text-xs text-muted-foreground">Ultima validacao registrada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(latestAssessment.created_at))}: {classificationStyles[latestAssessment.classification].label}.</p> : null}
    </section>
  );
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

function TechnicalValidationSkeleton() {
  return <div className="space-y-3" aria-label="Carregando validacao tecnica"><div className="h-72 animate-pulse rounded-xl bg-muted" /><div className="h-8 w-80 max-w-full animate-pulse rounded bg-muted" /></div>;
}
