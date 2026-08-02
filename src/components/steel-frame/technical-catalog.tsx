"use client";

import { BookMarked, CheckCircle2, ClipboardList, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigationAccess } from "@/components/app-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveSteelFrameTechnicalComposition,
  approveSteelFrameTechnicalRule,
  createSteelFrameTechnicalComposition,
  createSteelFrameTechnicalRule,
  getSteelFrameErrorMessage,
  listSteelFrameTechnicalCompositions,
  listSteelFrameTechnicalRules,
} from "@/lib/steel-frame/data";
import type {
  SteelFrameTechnicalApplicationType,
  SteelFrameTechnicalCompositionRecord,
  SteelFrameTechnicalRuleOrigin,
  SteelFrameTechnicalRuleRecord,
  SteelFrameTechnicalRuleStatus,
} from "@/lib/steel-frame/types";
import {
  createSupabaseSteelFrameCatalogRepository,
  type SteelFrameCatalogTechnicalSource,
} from "@/lib/steel-frame/catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RuleForm = {
  code: string;
  version: string;
  name: string;
  ruleType: string;
  origin: SteelFrameTechnicalRuleOrigin;
  referenceName: string;
  referenceVersion: string;
  permittedUse: string;
  technicalResponsibleName: string;
  technicalResponsibleRegistration: string;
  effectiveFrom: string;
  effectiveTo: string;
  conditions: string;
  parameters: string;
  limits: string;
  sourceId: string;
  sourceDocumentId: string;
};

type CompositionForm = {
  code: string;
  version: string;
  name: string;
  applicationType: SteelFrameTechnicalApplicationType;
  profileSpecification: string;
  description: string;
  permittedUse: string;
  technicalResponsibleName: string;
  technicalResponsibleRegistration: string;
  effectiveFrom: string;
  effectiveTo: string;
  conditions: string;
  limits: string;
  ruleIds: string[];
  sourceId: string;
  sourceDocumentId: string;
};

const initialRuleForm: RuleForm = {
  code: "",
  version: "1.0",
  name: "",
  ruleType: "validation",
  origin: "company",
  referenceName: "",
  referenceVersion: "",
  permittedUse: "",
  technicalResponsibleName: "",
  technicalResponsibleRegistration: "",
  effectiveFrom: "",
  effectiveTo: "",
  conditions: "{}",
  parameters: "{}",
  limits: "{}",
  sourceId: "",
  sourceDocumentId: "",
};

const initialCompositionForm: CompositionForm = {
  code: "",
  version: "1.0",
  name: "",
  applicationType: "structural",
  profileSpecification: "",
  description: "",
  permittedUse: "",
  technicalResponsibleName: "",
  technicalResponsibleRegistration: "",
  effectiveFrom: "",
  effectiveTo: "",
  conditions: "{}",
  limits: "{}",
  ruleIds: [],
  sourceId: "",
  sourceDocumentId: "",
};

const statusVariants: Record<SteelFrameTechnicalRuleStatus, "secondary" | "success" | "warning" | "outline"> = {
  draft: "warning",
  approved: "success",
  superseded: "secondary",
  archived: "outline",
};

const statusLabels: Record<SteelFrameTechnicalRuleStatus, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  superseded: "Superado",
  archived: "Arquivado",
};

function parseJsonObject(value: string, label: string) {
  try {
    const parsed: unknown = value.trim() ? JSON.parse(value) : {};
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} deve ser um objeto JSON valido.`);
  }
}

export function TechnicalCatalog() {
  const { role, permissions, loading: accessLoading } = useNavigationAccess();
  const catalogClient = useMemo(() => createSupabaseBrowserClient(), []);
  const catalogRepository = useMemo(() => createSupabaseSteelFrameCatalogRepository(catalogClient), [catalogClient]);
  const [rules, setRules] = useState<SteelFrameTechnicalRuleRecord[]>([]);
  const [compositions, setCompositions] = useState<SteelFrameTechnicalCompositionRecord[]>([]);
  const [sources, setSources] = useState<SteelFrameCatalogTechnicalSource[]>([]);
  const [sourceLibraryError, setSourceLibraryError] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(initialRuleForm);
  const [compositionForm, setCompositionForm] = useState<CompositionForm>(initialCompositionForm);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [savingComposition, setSavingComposition] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = role === "admin" || permissions.includes("*") || permissions.includes("estimates.catalog.manage");
  const canApprove = role === "admin" || permissions.includes("*") || permissions.includes("estimates.approve");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRules, nextCompositions] = await Promise.all([
        listSteelFrameTechnicalRules(),
        listSteelFrameTechnicalCompositions(),
      ]);
      setRules(nextRules);
      setCompositions(nextCompositions);
      try {
        setSources(await catalogRepository.listTechnicalSources());
        setSourceLibraryError(null);
      } catch (sourceError) {
        setSources([]);
        setSourceLibraryError(getSteelFrameErrorMessage(sourceError));
      }
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [catalogRepository]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let conditions: Record<string, unknown>;
    let parameters: Record<string, unknown>;
    let limits: Record<string, unknown>;
    try {
      conditions = parseJsonObject(ruleForm.conditions, "Condicoes");
      parameters = parseJsonObject(ruleForm.parameters, "Parametros");
      limits = parseJsonObject(ruleForm.limits, "Limites");
    } catch (formError) {
      toast.error(formError instanceof Error ? formError.message : "Revise o JSON da regra.");
      return;
    }

    setSavingRule(true);
    try {
      await createSteelFrameTechnicalRule({
        ...ruleForm,
        applicationScope: {},
        conditions,
        parameters,
        limits,
        permittedUse: ruleForm.permittedUse || null,
        technicalResponsibleName: ruleForm.technicalResponsibleName || null,
        technicalResponsibleRegistration: ruleForm.technicalResponsibleRegistration || null,
        effectiveFrom: ruleForm.effectiveFrom || null,
        effectiveTo: ruleForm.effectiveTo || null,
        sourceId: ruleForm.sourceId || null,
        sourceDocumentId: ruleForm.sourceDocumentId || null,
      });
      setRuleForm(initialRuleForm);
      toast.success("Regra tecnica criada como rascunho.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingRule(false);
    }
  }

  async function submitComposition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let conditions: Record<string, unknown>;
    let limits: Record<string, unknown>;
    try {
      conditions = parseJsonObject(compositionForm.conditions, "Condicoes");
      limits = parseJsonObject(compositionForm.limits, "Limites");
    } catch (formError) {
      toast.error(formError instanceof Error ? formError.message : "Revise o JSON da composicao.");
      return;
    }

    setSavingComposition(true);
    try {
      await createSteelFrameTechnicalComposition({
        ...compositionForm,
        applicationScope: {},
        conditions,
        limits,
        profileSpecification: compositionForm.profileSpecification || null,
        description: compositionForm.description || null,
        permittedUse: compositionForm.permittedUse || null,
        technicalResponsibleName: compositionForm.technicalResponsibleName || null,
        technicalResponsibleRegistration: compositionForm.technicalResponsibleRegistration || null,
        effectiveFrom: compositionForm.effectiveFrom || null,
        effectiveTo: compositionForm.effectiveTo || null,
        sourceId: compositionForm.sourceId || null,
        sourceDocumentId: compositionForm.sourceDocumentId || null,
      });
      setCompositionForm(initialCompositionForm);
      toast.success("Composicao tecnica criada como rascunho.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingComposition(false);
    }
  }

  async function approveRule(rule: SteelFrameTechnicalRuleRecord) {
    setApprovingId(rule.id);
    try {
      await approveSteelFrameTechnicalRule(rule.id);
      toast.success("Regra tecnica aprovada e versionada.");
      await load();
    } catch (approvalError) {
      toast.error(getSteelFrameErrorMessage(approvalError));
    } finally {
      setApprovingId(null);
    }
  }

  async function approveComposition(composition: SteelFrameTechnicalCompositionRecord) {
    setApprovingId(composition.id);
    try {
      await approveSteelFrameTechnicalComposition(composition.id);
      toast.success("Composicao tecnica aprovada e disponivel para validacoes.");
      await load();
    } catch (approvalError) {
      toast.error(getSteelFrameErrorMessage(approvalError));
    } finally {
      setApprovingId(null);
    }
  }

  if (loading || accessLoading) return <TechnicalCatalogSkeleton />;

  if (error) {
    return <Card className="border-destructive/25"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-destructive">Nao foi possivel carregar o catalogo tecnico.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button></CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      <Card className="border-amber-500/25 bg-amber-500/[0.045]">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-950 dark:text-amber-100"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="font-medium">Catalogo tecnico versionado</p><p className="mt-1">Cadastre fontes, limites e parametros somente com respaldo tecnico. Aprovacoes exigem responsavel tecnico, registro e versao da fonte. Uma versao aprovada nao pode ser editada.</p></div></CardContent>
      </Card>

      {canManage ? (
        <div className="grid gap-5 2xl:grid-cols-2">
          <Card className="border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><BookMarked className="size-4" /> Nova regra tecnica</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={submitRule}>
                <Field label="Codigo"><Input value={ruleForm.code} onChange={(event) => setRuleForm((current) => ({ ...current, code: event.target.value }))} placeholder="NF-PAREDE-001" /></Field>
                <Field label="Versao"><Input value={ruleForm.version} onChange={(event) => setRuleForm((current) => ({ ...current, version: event.target.value }))} placeholder="1.0" /></Field>
                <Field label="Nome" className="md:col-span-2"><Input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Limites da parede externa estrutural" /></Field>
                <Field label="Tipo"><Input value={ruleForm.ruleType} onChange={(event) => setRuleForm((current) => ({ ...current, ruleType: event.target.value }))} placeholder="validation, manufacturer..." /></Field>
                <Field label="Origem"><Select value={ruleForm.origin} onValueChange={(value) => setRuleForm((current) => ({ ...current, origin: value as SteelFrameTechnicalRuleOrigin }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Norma</SelectItem><SelectItem value="manufacturer">Fabricante</SelectItem><SelectItem value="company">Empresa</SelectItem><SelectItem value="technical_responsible">Responsavel tecnico</SelectItem></SelectContent></Select></Field>
                <Field label="Fonte"><Input value={ruleForm.referenceName} onChange={(event) => setRuleForm((current) => ({ ...current, referenceName: event.target.value }))} placeholder="Documento, norma ou fabricante" /></Field>
                <Field label="Versao da fonte"><Input value={ruleForm.referenceVersion} onChange={(event) => setRuleForm((current) => ({ ...current, referenceVersion: event.target.value }))} placeholder="Edicao, revisao ou data" /></Field>
                <TechnicalSourceReferenceFields sources={sources} sourceId={ruleForm.sourceId} sourceDocumentId={ruleForm.sourceDocumentId} sourceLibraryError={sourceLibraryError} onSourceChange={(sourceId) => setRuleForm((current) => ({ ...current, sourceId, sourceDocumentId: "" }))} onDocumentChange={(sourceDocumentId) => setRuleForm((current) => ({ ...current, sourceDocumentId }))} />
                <Field label="Responsavel tecnico"><Input value={ruleForm.technicalResponsibleName} onChange={(event) => setRuleForm((current) => ({ ...current, technicalResponsibleName: event.target.value }))} placeholder="Obrigatorio para aprovar" /></Field>
                <Field label="Registro profissional"><Input value={ruleForm.technicalResponsibleRegistration} onChange={(event) => setRuleForm((current) => ({ ...current, technicalResponsibleRegistration: event.target.value }))} placeholder="CREA/CAU" /></Field>
                <Field label="Vigencia inicial"><Input type="date" value={ruleForm.effectiveFrom} onChange={(event) => setRuleForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field>
                <Field label="Vigencia final"><Input type="date" value={ruleForm.effectiveTo} onChange={(event) => setRuleForm((current) => ({ ...current, effectiveTo: event.target.value }))} /></Field>
                <div className="md:col-span-2"><Field label="Uso permitido"><Textarea className="min-h-16" value={ruleForm.permittedUse} onChange={(event) => setRuleForm((current) => ({ ...current, permittedUse: event.target.value }))} placeholder="Onde esta regra pode ser usada e o que fica fora do escopo." /></Field></div>
                <JsonField label="Condicoes JSON" value={ruleForm.conditions} onChange={(value) => setRuleForm((current) => ({ ...current, conditions: value }))} placeholder='{"requires_project": true}' />
                <JsonField label="Parametros JSON" value={ruleForm.parameters} onChange={(value) => setRuleForm((current) => ({ ...current, parameters: value }))} placeholder='{"commercial_bar_length_meters": 6}' />
                <div className="md:col-span-2"><JsonField label="Limites JSON" value={ruleForm.limits} onChange={(value) => setRuleForm((current) => ({ ...current, limits: value }))} placeholder='{"maxWallHeightMeters": 0, "maxFloors": 0, "allowedStudSpacingMeters": [], "requiresWindValidation": false, "requiresRoofReview": false, "requiresTechnicalReview": false}' /></div>
                <p className="md:col-span-2 text-xs text-muted-foreground">Nao use valores ilustrativos como limites aprovados. Cadastre apenas dados revisados pela equipe tecnica.</p>
                <Button type="submit" className="md:col-span-2" disabled={savingRule}><Plus className="size-4" />{savingRule ? "Criando..." : "Criar regra em rascunho"}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><ClipboardList className="size-4" /> Nova composicao tecnica</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={submitComposition}>
                <Field label="Codigo"><Input value={compositionForm.code} onChange={(event) => setCompositionForm((current) => ({ ...current, code: event.target.value }))} placeholder="NF-PAREDE-EXT-001" /></Field>
                <Field label="Versao"><Input value={compositionForm.version} onChange={(event) => setCompositionForm((current) => ({ ...current, version: event.target.value }))} placeholder="1.0" /></Field>
                <Field label="Nome" className="md:col-span-2"><Input value={compositionForm.name} onChange={(event) => setCompositionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Parede externa estrutural" /></Field>
                <Field label="Aplicacao"><Select value={compositionForm.applicationType} onValueChange={(value) => setCompositionForm((current) => ({ ...current, applicationType: value as SteelFrameTechnicalApplicationType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="structural">Estrutural</SelectItem><SelectItem value="non_structural">Vedacao</SelectItem><SelectItem value="floor">Piso</SelectItem><SelectItem value="roof">Cobertura</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></Field>
                <Field label="Especificacao de perfil"><Input value={compositionForm.profileSpecification} onChange={(event) => setCompositionForm((current) => ({ ...current, profileSpecification: event.target.value }))} placeholder="Somente especificacao aprovada" /></Field>
                <Field label="Responsavel tecnico"><Input value={compositionForm.technicalResponsibleName} onChange={(event) => setCompositionForm((current) => ({ ...current, technicalResponsibleName: event.target.value }))} placeholder="Obrigatorio para aprovar" /></Field>
                <Field label="Registro profissional"><Input value={compositionForm.technicalResponsibleRegistration} onChange={(event) => setCompositionForm((current) => ({ ...current, technicalResponsibleRegistration: event.target.value }))} placeholder="CREA/CAU" /></Field>
                <Field label="Vigencia inicial"><Input type="date" value={compositionForm.effectiveFrom} onChange={(event) => setCompositionForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field>
                <Field label="Vigencia final"><Input type="date" value={compositionForm.effectiveTo} onChange={(event) => setCompositionForm((current) => ({ ...current, effectiveTo: event.target.value }))} /></Field>
                <TechnicalSourceReferenceFields sources={sources} sourceId={compositionForm.sourceId} sourceDocumentId={compositionForm.sourceDocumentId} sourceLibraryError={sourceLibraryError} onSourceChange={(sourceId) => setCompositionForm((current) => ({ ...current, sourceId, sourceDocumentId: "" }))} onDocumentChange={(sourceDocumentId) => setCompositionForm((current) => ({ ...current, sourceDocumentId }))} />
                <div className="md:col-span-2"><Field label="Descricao"><Textarea className="min-h-16" value={compositionForm.description} onChange={(event) => setCompositionForm((current) => ({ ...current, description: event.target.value }))} placeholder="Camadas, aplicacao e observacoes de projeto." /></Field></div>
                <div className="md:col-span-2"><Field label="Uso permitido"><Textarea className="min-h-16" value={compositionForm.permittedUse} onChange={(event) => setCompositionForm((current) => ({ ...current, permittedUse: event.target.value }))} placeholder="Limites de uso e exclusoes conhecidas." /></Field></div>
                <JsonField label="Condicoes JSON" value={compositionForm.conditions} onChange={(value) => setCompositionForm((current) => ({ ...current, conditions: value }))} placeholder='{"requires_structural_design": true}' />
                <JsonField label="Limites JSON" value={compositionForm.limits} onChange={(value) => setCompositionForm((current) => ({ ...current, limits: value }))} placeholder='{"maxWallHeightMeters": 0, "maxFloors": 0, "allowedStudSpacingMeters": [], "requiresWindValidation": false, "requiresRoofReview": false, "requiresTechnicalReview": false}' />
                <div className="md:col-span-2 space-y-2 rounded-lg border border-border/70 p-3"><p className="text-sm font-medium">Regras tecnicas vinculadas</p>{rules.filter((rule) => rule.status === "approved").length ? rules.filter((rule) => rule.status === "approved").map((rule) => <label key={rule.id} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={compositionForm.ruleIds.includes(rule.id)} onChange={(event) => setCompositionForm((current) => ({ ...current, ruleIds: event.target.checked ? [...current.ruleIds, rule.id] : current.ruleIds.filter((id) => id !== rule.id) }))} /><span><span className="font-medium">{rule.code} v{rule.version}</span><span className="block text-xs text-muted-foreground">{rule.name} - {rule.reference_name}</span></span></label>) : <p className="text-sm text-muted-foreground">Aprove ao menos uma regra tecnica antes de criar uma composicao liberavel.</p>}</div>
                <Button type="submit" className="md:col-span-2" disabled={savingComposition}><Plus className="size-4" />{savingComposition ? "Criando..." : "Criar composicao em rascunho"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : <Card className="border-primary/10 bg-secondary/25"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" /><p>Voce pode consultar modelos aprovados. Criacao, alteracao e aprovacao exigem permissoes explicitas do catalogo tecnico.</p></CardContent></Card>}

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Regras tecnicas</h2><span className="text-sm text-muted-foreground">{rules.length} registradas</span></div>
        {rules.length ? <div className="grid gap-3 xl:grid-cols-2">{rules.map((rule) => <TechnicalRuleCard key={rule.id} rule={rule} canApprove={canApprove} approving={approvingId === rule.id} onApprove={approveRule} />)}</div> : <EmptyState label="Nenhuma regra tecnica aprovada foi cadastrada." />}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Composicoes tecnicas</h2><span className="text-sm text-muted-foreground">{compositions.length} registradas</span></div>
        {compositions.length ? <div className="grid gap-3 xl:grid-cols-2">{compositions.map((composition) => <TechnicalCompositionCard key={composition.id} composition={composition} canApprove={canApprove} approving={approvingId === composition.id} onApprove={approveComposition} />)}</div> : <EmptyState label="Nenhuma composicao tecnica aprovada foi cadastrada." />}
      </section>
    </div>
  );
}

function TechnicalRuleCard({ rule, canApprove, approving, onApprove }: { rule: SteelFrameTechnicalRuleRecord; canApprove: boolean; approving: boolean; onApprove: (rule: SteelFrameTechnicalRuleRecord) => void }) {
  return <Card className="border-primary/10"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">{rule.code} v{rule.version} - {rule.origin}</p></div><Badge variant={statusVariants[rule.status]}>{statusLabels[rule.status]}</Badge></div><div className="grid gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground"><p><span className="font-medium text-foreground">Fonte:</span> {rule.reference_name} - {rule.reference_version}</p><p><span className="font-medium text-foreground">Responsavel:</span> {rule.technical_responsible_name || "A confirmar"} {rule.technical_responsible_registration ? `- ${rule.technical_responsible_registration}` : ""}</p></div>{rule.status === "draft" && canApprove ? <Button size="sm" variant="outline" onClick={() => onApprove(rule)} disabled={approving}><CheckCircle2 className="size-4" />{approving ? "Aprovando..." : "Aprovar regra"}</Button> : null}</CardContent></Card>;
}

function TechnicalCompositionCard({ composition, canApprove, approving, onApprove }: { composition: SteelFrameTechnicalCompositionRecord; canApprove: boolean; approving: boolean; onApprove: (composition: SteelFrameTechnicalCompositionRecord) => void }) {
  const linkedRuleCount = composition.rules?.length ?? 0;
  return <Card className="border-primary/10"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{composition.name}</p><p className="mt-1 text-xs text-muted-foreground">{composition.code} v{composition.version} - {composition.application_type}</p></div><Badge variant={statusVariants[composition.status]}>{statusLabels[composition.status]}</Badge></div><div className="grid gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground"><p><span className="font-medium text-foreground">Perfil:</span> {composition.profile_specification || "A confirmar"}</p><p><span className="font-medium text-foreground">Regras vinculadas:</span> {linkedRuleCount}</p><p><span className="font-medium text-foreground">Responsavel:</span> {composition.technical_responsible_name || "A confirmar"} {composition.technical_responsible_registration ? `- ${composition.technical_responsible_registration}` : ""}</p></div>{composition.status === "draft" && canApprove ? <Button size="sm" variant="outline" onClick={() => onApprove(composition)} disabled={approving}><CheckCircle2 className="size-4" />{approving ? "Aprovando..." : "Aprovar composicao"}</Button> : null}</CardContent></Card>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

function TechnicalSourceReferenceFields({
  sources,
  sourceId,
  sourceDocumentId,
  sourceLibraryError,
  onSourceChange,
  onDocumentChange,
}: {
  sources: SteelFrameCatalogTechnicalSource[];
  sourceId: string;
  sourceDocumentId: string;
  sourceLibraryError: string | null;
  onSourceChange: (sourceId: string) => void;
  onDocumentChange: (documentId: string) => void;
}) {
  if (sourceLibraryError) {
    return <div className="md:col-span-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.045] p-3 text-xs text-muted-foreground">A Biblioteca Tecnica ainda nao esta disponivel neste banco. Rascunhos continuam disponiveis; para aprovar no catalogo versionado, aplique a migration da Fase 2.</div>;
  }

  const selectedSource = sources.find((source) => source.id === sourceId) ?? null;
  return (
    <div className="md:col-span-2 grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-2">
      <Field label="Fonte registrada"><Select value={sourceId || "none"} onValueChange={(value) => onSourceChange(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Selecione a fonte" /></SelectTrigger><SelectContent><SelectItem value="none">Sem vinculo por enquanto</SelectItem>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.title}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Documento privado"><Select value={sourceDocumentId || "none"} disabled={!selectedSource || !selectedSource.documents.length} onValueChange={(value) => onDocumentChange(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder={selectedSource ? "Selecione o documento" : "Selecione uma fonte"} /></SelectTrigger><SelectContent><SelectItem value="none">Sem documento por enquanto</SelectItem>{selectedSource?.documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.originalFileName}</SelectItem>)}</SelectContent></Select></Field>
      <p className="sm:col-span-2 text-xs text-muted-foreground">Fonte e documento sao obrigatorios somente antes da aprovacao. Crie ou anexe referencias na Biblioteca Tecnica.</p>
    </div>
  );
}

function JsonField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <Field label={label}><Textarea className="min-h-28 font-mono text-xs" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></Field>;
}

function EmptyState({ label }: { label: string }) {
  return <Card className="border-dashed border-primary/20"><CardContent className="p-5 text-center text-sm text-muted-foreground">{label}</CardContent></Card>;
}

function TechnicalCatalogSkeleton() {
  return <div className="space-y-5" aria-label="Carregando catalogo tecnico"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="grid gap-5 xl:grid-cols-2"><div className="h-[42rem] animate-pulse rounded-xl bg-muted" /><div className="h-[42rem] animate-pulse rounded-xl bg-muted" /></div></div>;
}
