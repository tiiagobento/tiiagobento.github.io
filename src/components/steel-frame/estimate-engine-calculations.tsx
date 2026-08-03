"use client";

import { Bot, CheckCircle2, CircleAlert, Loader2, PackageCheck, Scissors } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSupabaseSteelFrameCatalogRepository } from "@/lib/steel-frame/catalog/supabase-repository";
import type { SteelFrameCatalogRuleDraft } from "@/lib/steel-frame/catalog/types";
import { getCurrentMaterialPrice } from "@/lib/steel-frame/costing";
import { addSteelFrameCalculatedItem, getSteelFrameErrorMessage } from "@/lib/steel-frame/data";
import {
  buildSteelFrameEngineCalculatedItem,
  evaluateSteelFrameCatalogRule,
  findSteelFrameRuleMaterialMatches,
  hasPersistedSteelFrameEngineRule,
} from "@/lib/steel-frame/estimate-engine";
import type {
  SteelFrameCalculatedItemRecord,
  SteelFrameMaterialRecord,
  SteelFrameOpeningRecord,
  SteelFrameWallSegmentRecord,
} from "@/lib/steel-frame/types";

type EstimateEngineCalculationsProps = {
  estimateId: string;
  walls: SteelFrameWallSegmentRecord[];
  openings: SteelFrameOpeningRecord[];
  materials: SteelFrameMaterialRecord[];
  calculatedItems: SteelFrameCalculatedItemRecord[];
  readOnly: boolean;
  onItemSaved: (item: SteelFrameCalculatedItemRecord) => void;
};

const classificationLabels = {
  automatic_eligible: "Automatico",
  preliminary: "Preliminar",
  technical_review_required: "Revisao tecnica",
  blocked: "Bloqueado",
} as const;

export function EstimateEngineCalculations({
  estimateId,
  walls,
  openings,
  materials,
  calculatedItems,
  readOnly,
  onItemSaved,
}: EstimateEngineCalculationsProps) {
  const [rules, setRules] = useState<SteelFrameCatalogRuleDraft[]>([]);
  const [materialByRule, setMaterialByRule] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRuleIds, setSavingRuleIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const repository = createSupabaseSteelFrameCatalogRepository();
      void repository.listApprovedRules()
        .then((nextRules) => {
          if (!active) return;
          setRules(nextRules);
        })
        .catch((loadError) => {
          if (!active) return;
          setError(getSteelFrameErrorMessage(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMaterialByRule((current) => {
      const next = { ...current };
      for (const rule of rules) {
        if (next[rule.id]) continue;
        const matches = findSteelFrameRuleMaterialMatches(rule, materials);
        if (matches.length === 1) next[rule.id] = matches[0].id;
      }
      return next;
    });
  }, [materials, rules]);

  const rows = useMemo(() => rules.map((rule) => {
    const evaluation = evaluateSteelFrameCatalogRule(rule, walls, openings);
    const material = materials.find((item) => item.id === materialByRule[rule.id]) ?? null;
    const price = material ? getCurrentMaterialPrice(material) : null;
    const alreadySaved = calculatedItems.some((item) => hasPersistedSteelFrameEngineRule(item.source_data, rule));
    return { rule, evaluation, material, price, alreadySaved };
  }), [calculatedItems, materialByRule, materials, openings, rules, walls]);

  async function saveRule(ruleId: string) {
    const row = rows.find((item) => item.rule.id === ruleId);
    if (!row || !row.evaluation.ok || !row.material || !row.price || row.alreadySaved) return;

    setSavingRuleIds((current) => [...current, ruleId]);
    try {
      const draft = buildSteelFrameEngineCalculatedItem({
        rule: row.rule,
        result: row.evaluation.result,
        material: row.material,
        walls,
        openings,
      });
      const item = await addSteelFrameCalculatedItem(estimateId, draft, calculatedItems.length);
      onItemSaved(item);
      toast.success(`${row.material.name} adicionado pelo motor tipado.`);
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingRuleIds((current) => current.filter((id) => id !== ruleId));
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando regras tecnicas aprovadas...</div>;
  }

  if (error) {
    return <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4 text-sm text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /><p>O motor tipado nao conseguiu ler o catalogo aprovado. O calculo manual continua disponivel. {error}</p></div>;
  }

  if (!rules.length) {
    return <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><p className="font-medium text-foreground">Nenhuma regra tecnica aprovada</p><p className="mt-1">O motor nao cria coeficientes por conta propria. Publique regras validadas no catalogo tecnico para liberar o calculo automatico.</p></div>;
  }

  return (
    <Card className="border-primary/15 bg-primary/[0.025]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-primary"><Bot className="size-4" /> Calculo automatico validado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">As quantidades abaixo usam somente geometria confirmada e regras aprovadas, com fonte, versao, explicacao e plano de corte preservados no item.</p>
        {rows.map(({ rule, evaluation, material, price, alreadySaved }) => {
          const result = evaluation.ok ? evaluation.result : null;
          const saving = savingRuleIds.includes(rule.id);
          const disabled = readOnly || saving || alreadySaved || !result || result.classification === "blocked" || !material || !price;
          return (
            <div key={rule.id} className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{rule.name}</p><Badge variant={result?.classification === "automatic_eligible" ? "success" : result?.classification === "blocked" ? "danger" : "warning"}>{result ? classificationLabels[result.classification] : "Regra invalida"}</Badge><Badge variant="outline">v{rule.version}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{rule.source.sourceTitle ?? "Fonte tecnica pendente"}{rule.source.sourceVersion ? ` - ${rule.source.sourceVersion}` : ""}</p>
                </div>
                {result ? <div className="shrink-0 text-left lg:text-right"><p className="text-lg font-semibold text-primary">{result.quantities.purchase.quantity} {result.quantities.purchase.unit}</p><p className="text-xs text-muted-foreground">Tecnico: {result.quantities.raw.value} {result.quantities.raw.unit}</p></div> : null}
              </div>

              {result ? <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><p className="rounded-lg bg-secondary/45 p-2.5">Perda: {result.quantities.waste.configuredPercent}%</p><p className="rounded-lg bg-secondary/45 p-2.5">Sobra: {result.quantities.purchase.estimatedLeftover.value} {result.quantities.purchase.estimatedLeftover.unit}</p><p className="rounded-lg bg-secondary/45 p-2.5">{result.cuttingPlan ? `${result.cuttingPlan.commercialBarsToPurchase} barras - ${result.cuttingPlan.utilizationPercent}% aproveitamento` : "Sem plano de corte para esta regra"}</p></div> : null}
              {result ? <details className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-sm"><summary className="cursor-pointer font-medium text-foreground">Como foi calculado?</summary><p className="mt-2 whitespace-pre-line text-muted-foreground">{result.explanation.text}</p>{result.alerts.length ? <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">{result.alerts.map((alert) => <li key={`${alert.code}-${alert.message}`}>{alert.message}</li>)}</ul> : null}</details> : <p className="text-sm text-destructive">{evaluation.ok ? "Falha no calculo." : evaluation.errors.join(" ")}</p>}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5"><p className="text-xs font-medium text-foreground">Material correspondente</p><Select value={material?.id ?? "unselected"} onValueChange={(value) => setMaterialByRule((current) => ({ ...current, [rule.id]: value === "unselected" ? "" : value }))} disabled={readOnly || alreadySaved}><SelectTrigger><SelectValue placeholder="Vincular material do catalogo" /></SelectTrigger><SelectContent><SelectItem value="unselected">Selecionar material</SelectItem>{materials.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} - {getCurrentMaterialPrice(item) ? "preco vigente" : "sem preco"}</SelectItem>)}</SelectContent></Select>{material && !price ? <p className="text-xs text-amber-700 dark:text-amber-300">Cadastre um preco vigente para incluir este item.</p> : null}</div>
                <Button type="button" onClick={() => void saveRule(rule.id)} disabled={disabled}>{saving ? <Loader2 className="size-4 animate-spin" /> : alreadySaved ? <CheckCircle2 className="size-4" /> : result?.cuttingPlan ? <Scissors className="size-4" /> : <PackageCheck className="size-4" />}{alreadySaved ? "Ja adicionado" : saving ? "Salvando..." : "Adicionar ao orcamento"}</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
