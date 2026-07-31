"use client";

import {
  Banknote,
  Boxes,
  Calculator,
  CircleAlert,
  Factory,
  HardHat,
  PackagePlus,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateCommercialPricing, calculateMaterialQuantity } from "@/lib/steel-frame/calculator";
import {
  buildSteelFrameCalculationContext,
  formatSteelFrameCurrency,
  getCalculationContextIssue,
  getCommercialComponentValues,
  getCurrentMaterialPrice,
  sumSteelFrameDirectCosts,
} from "@/lib/steel-frame/costing";
import {
  addSteelFrameCalculatedItem,
  addSteelFrameLaborItem,
  addSteelFrameOperationalCost,
  getSteelFrameCosting,
  getSteelFrameErrorMessage,
  listSteelFrameMaterials,
  upsertSteelFrameCommercialComponents,
} from "@/lib/steel-frame/data";
import type {
  SteelFrameCalculatedQuantity,
  SteelFrameCalculationContext,
  SteelFrameCalculationRuleType,
  SteelFrameCommercialComponents,
  SteelFrameCostingSnapshot,
  SteelFrameMaterialRecord,
  SteelFrameOpeningRecord,
  SteelFrameWallSegmentRecord,
} from "@/lib/steel-frame/types";

type EstimateCostingProps = {
  estimateId: string;
  walls: SteelFrameWallSegmentRecord[];
  openings: SteelFrameOpeningRecord[];
  readOnly?: boolean;
};

type CalculationForm = {
  materialId: string;
  ruleType: SteelFrameCalculationRuleType;
  parameter: string;
  wastePercent: string;
  roundingMode: "none" | "ceil" | "nearest" | "floor";
  roundingMultiple: string;
  manualQuantity: string;
  boardCount: string;
  studCount: string;
};

type CommercialForm = {
  contingencyPercentOfCost: string;
  taxPercentOfSale: string;
  salesCommissionPercentOfSale: string;
  platformCommissionPercentOfSale: string;
  targetMarginPercentOfSale: string;
  maxDiscountPercent: string;
};

const initialCalculationForm: CalculationForm = {
  materialId: "",
  ruleType: "MANUAL",
  parameter: "",
  wastePercent: "0",
  roundingMode: "none",
  roundingMultiple: "1",
  manualQuantity: "",
  boardCount: "",
  studCount: "",
};

const initialCommercialForm: CommercialForm = {
  contingencyPercentOfCost: "",
  taxPercentOfSale: "",
  salesCommissionPercentOfSale: "",
  platformCommissionPercentOfSale: "",
  targetMarginPercentOfSale: "",
  maxDiscountPercent: "",
};

const calculationRules: Array<{ value: SteelFrameCalculationRuleType; label: string }> = [
  { value: "STUD_BY_SPACING", label: "Montantes por espacamento" },
  { value: "TRACK_BY_LINEAR_LENGTH", label: "Guias por metragem linear" },
  { value: "BOARD_BY_AREA", label: "Placas por area" },
  { value: "ROLL_BY_COVERAGE", label: "Rolos por cobertura" },
  { value: "PACKAGE_BY_COVERAGE", label: "Pacotes por cobertura" },
  { value: "FASTENER_BY_AREA", label: "Fixadores por area" },
  { value: "FASTENER_BY_BOARD", label: "Fixadores por placa" },
  { value: "FASTENER_BY_STUD", label: "Fixadores por montante" },
  { value: "FIXED_PER_OPENING", label: "Item fixo por abertura" },
  { value: "FIXED_PER_PROJECT", label: "Item fixo por projeto" },
  { value: "LINEAR_BY_OPENING", label: "Item linear por abertura" },
  { value: "MANUAL", label: "Quantidade manual" },
];

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function parameterForRule(ruleType: SteelFrameCalculationRuleType) {
  switch (ruleType) {
    case "STUD_BY_SPACING":
      return { key: "spacingMeters", label: "Espacamento entre montantes (m)" };
    case "BOARD_BY_AREA":
    case "ROLL_BY_COVERAGE":
    case "PACKAGE_BY_COVERAGE":
    case "FASTENER_BY_AREA":
      return { key: "coveragePerUnit", label: "Cobertura por unidade (m2)" };
    case "FASTENER_BY_BOARD":
      return { key: "unitsPerBoard", label: "Fixadores por placa" };
    case "FASTENER_BY_STUD":
      return { key: "unitsPerStud", label: "Fixadores por montante" };
    case "FIXED_PER_OPENING":
      return { key: "unitsPerOpening", label: "Quantidade por abertura" };
    case "FIXED_PER_PROJECT":
      return { key: "unitsPerProject", label: "Quantidade por projeto" };
    case "LINEAR_BY_OPENING":
      return { key: "unitsPerLinearMeter", label: "Quantidade por metro linear" };
    default:
      return null;
  }
}

function commercialFormFromSnapshot(snapshot: SteelFrameCostingSnapshot | null): CommercialForm {
  if (!snapshot) return initialCommercialForm;
  const values = getCommercialComponentValues(snapshot.commercialComponents);
  return {
    contingencyPercentOfCost: values.contingencyPercentOfCost?.toString() ?? "",
    taxPercentOfSale: values.taxPercentOfSale?.toString() ?? "",
    salesCommissionPercentOfSale: values.salesCommissionPercentOfSale?.toString() ?? "",
    platformCommissionPercentOfSale: values.platformCommissionPercentOfSale?.toString() ?? "",
    targetMarginPercentOfSale: values.targetMarginPercentOfSale?.toString() ?? "",
    maxDiscountPercent: values.maxDiscountPercent?.toString() ?? "",
  };
}

export function EstimateCosting({ estimateId, walls, openings, readOnly = false }: EstimateCostingProps) {
  const [materials, setMaterials] = useState<SteelFrameMaterialRecord[]>([]);
  const [snapshot, setSnapshot] = useState<SteelFrameCostingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculationForm, setCalculationForm] = useState<CalculationForm>(initialCalculationForm);
  const [laborForm, setLaborForm] = useState({ label: "", quantity: "", unit: "", unitCost: "", notes: "" });
  const [operationalForm, setOperationalForm] = useState({ category: "", label: "", amount: "", notes: "" });
  const [commercialForm, setCommercialForm] = useState<CommercialForm>(initialCommercialForm);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [savingLabor, setSavingLabor] = useState(false);
  const [savingOperational, setSavingOperational] = useState(false);
  const [savingCommercial, setSavingCommercial] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMaterials, nextSnapshot] = await Promise.all([
        listSteelFrameMaterials(),
        getSteelFrameCosting(estimateId),
      ]);
      setMaterials(nextMaterials);
      setSnapshot(nextSnapshot);
      setCommercialForm(commercialFormFromSnapshot(nextSnapshot));
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [estimateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const calculationContext = useMemo<SteelFrameCalculationContext>(() => {
    const geometryContext = buildSteelFrameCalculationContext(walls, openings);
    return {
      ...geometryContext,
      boardCount: Number.isFinite(parseDecimal(calculationForm.boardCount)) ? parseDecimal(calculationForm.boardCount) : 0,
      studCount: Number.isFinite(parseDecimal(calculationForm.studCount)) ? parseDecimal(calculationForm.studCount) : 0,
    };
  }, [calculationForm.boardCount, calculationForm.studCount, openings, walls]);

  const selectedMaterial = materials.find((material) => material.id === calculationForm.materialId) ?? null;
  const selectedPrice = selectedMaterial ? getCurrentMaterialPrice(selectedMaterial) : null;
  const selectedParameter = parameterForRule(calculationForm.ruleType);
  const calculationPreview = useMemo(() => {
    if (!selectedMaterial) return { error: "Selecione um material do catalogo.", quantity: null as SteelFrameCalculatedQuantity | null };
    if (!selectedPrice) return { error: "O material selecionado nao possui um preco vigente no catalogo.", quantity: null as SteelFrameCalculatedQuantity | null };

    const contextIssue = getCalculationContextIssue(calculationForm.ruleType, calculationContext);
    if (contextIssue) return { error: contextIssue, quantity: null as SteelFrameCalculatedQuantity | null };

    const parameterValue = parseDecimal(calculationForm.parameter);
    const rule = {
      ruleType: calculationForm.ruleType,
      parameters: selectedParameter ? { [selectedParameter.key]: parameterValue } : {},
      wastePercent: parseDecimal(calculationForm.wastePercent),
      roundingMode: calculationForm.roundingMode,
      roundingMultiple: parseDecimal(calculationForm.roundingMultiple),
      manualQuantity: calculationForm.ruleType === "MANUAL" ? parseDecimal(calculationForm.manualQuantity) : undefined,
    } as const;

    try {
      return { error: null, quantity: calculateMaterialQuantity({ rule, context: calculationContext }) };
    } catch (calculationError) {
      return {
        error: calculationError instanceof Error ? calculationError.message : "Revise os parametros de calculo.",
        quantity: null as SteelFrameCalculatedQuantity | null,
      };
    }
  }, [calculationContext, calculationForm, selectedMaterial, selectedParameter, selectedPrice]);

  const directCosts = useMemo(
    () => sumSteelFrameDirectCosts({
      calculatedItems: snapshot?.calculatedItems ?? [],
      laborItems: snapshot?.laborItems ?? [],
      operationalCosts: snapshot?.operationalCosts ?? [],
    }),
    [snapshot],
  );

  const commercialPreview = useMemo(() => {
    const values = Object.values(commercialForm);
    if (values.some((value) => value.trim() === "")) return null;
    try {
      return calculateCommercialPricing({
        directCost: directCosts.directCost,
        contingencyPercentOfCost: parseDecimal(commercialForm.contingencyPercentOfCost),
        taxPercentOfSale: parseDecimal(commercialForm.taxPercentOfSale),
        salesCommissionPercentOfSale: parseDecimal(commercialForm.salesCommissionPercentOfSale),
        platformCommissionPercentOfSale: parseDecimal(commercialForm.platformCommissionPercentOfSale),
        targetMarginPercentOfSale: parseDecimal(commercialForm.targetMarginPercentOfSale),
        maxDiscountPercent: parseDecimal(commercialForm.maxDiscountPercent),
      });
    } catch {
      return null;
    }
  }, [commercialForm, directCosts.directCost]);

  async function saveCalculatedItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !selectedMaterial || !selectedPrice || !calculationPreview.quantity) {
      toast.error(calculationPreview.error ?? "Revise o item antes de adicionar.");
      return;
    }

    const rule = {
      ruleType: calculationForm.ruleType,
      parameters: selectedParameter ? { [selectedParameter.key]: parseDecimal(calculationForm.parameter) } : {},
      wastePercent: parseDecimal(calculationForm.wastePercent),
      roundingMode: calculationForm.roundingMode,
      roundingMultiple: parseDecimal(calculationForm.roundingMultiple),
      manualQuantity: calculationForm.ruleType === "MANUAL" ? parseDecimal(calculationForm.manualQuantity) : undefined,
    } as const;

    setSavingMaterial(true);
    try {
      const item = await addSteelFrameCalculatedItem(estimateId, {
        materialId: selectedMaterial.id,
        label: selectedMaterial.name,
        category: selectedMaterial.category,
        unit: selectedMaterial.unit,
        rule,
        sourceValues: calculationContext,
        rawQuantity: calculationPreview.quantity.rawQuantity,
        calculatedQuantity: calculationPreview.quantity.finalQuantity,
        unitCost: selectedPrice.unitCost,
        requiresTechnicalReview: true,
        confirmationStatus: "needs_confirmation",
        sourceData: {
          calculation_explanation: calculationPreview.quantity.explanation,
          catalog_price_effective_from: selectedPrice.effectiveFrom,
          catalog_currency: selectedPrice.currency,
        },
      }, snapshot.calculatedItems.length);
      setSnapshot((current) => current ? { ...current, calculatedItems: [...current.calculatedItems, item] } : current);
      setCalculationForm(initialCalculationForm);
      toast.success("Item calculado adicionado para revisao tecnica.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingMaterial(false);
    }
  }

  async function saveLabor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    setSavingLabor(true);
    try {
      const item = await addSteelFrameLaborItem(estimateId, {
        label: laborForm.label,
        quantity: parseDecimal(laborForm.quantity),
        unit: laborForm.unit,
        unitCost: parseDecimal(laborForm.unitCost),
        notes: laborForm.notes,
      }, snapshot.laborItems.length);
      setSnapshot((current) => current ? { ...current, laborItems: [...current.laborItems, item] } : current);
      setLaborForm({ label: "", quantity: "", unit: "", unitCost: "", notes: "" });
      toast.success("Mao de obra adicionada ao custo direto.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingLabor(false);
    }
  }

  async function saveOperationalCost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    setSavingOperational(true);
    try {
      const item = await addSteelFrameOperationalCost(estimateId, {
        category: operationalForm.category,
        label: operationalForm.label,
        amount: parseDecimal(operationalForm.amount),
        notes: operationalForm.notes,
      }, snapshot.operationalCosts.length);
      setSnapshot((current) => current ? { ...current, operationalCosts: [...current.operationalCosts, item] } : current);
      setOperationalForm({ category: "", label: "", amount: "", notes: "" });
      toast.success("Custo operacional adicionado.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingOperational(false);
    }
  }

  async function saveCommercialComponents(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.values(commercialForm);
    if (values.some((value) => value.trim() === "")) {
      toast.error("Preencha todos os componentes comerciais, inclusive quando o percentual for zero.");
      return;
    }

    const components: Omit<SteelFrameCommercialComponents, "directCost"> = {
      contingencyPercentOfCost: parseDecimal(commercialForm.contingencyPercentOfCost),
      taxPercentOfSale: parseDecimal(commercialForm.taxPercentOfSale),
      salesCommissionPercentOfSale: parseDecimal(commercialForm.salesCommissionPercentOfSale),
      platformCommissionPercentOfSale: parseDecimal(commercialForm.platformCommissionPercentOfSale),
      targetMarginPercentOfSale: parseDecimal(commercialForm.targetMarginPercentOfSale),
      maxDiscountPercent: parseDecimal(commercialForm.maxDiscountPercent),
    };

    try {
      calculateCommercialPricing({ directCost: directCosts.directCost, ...components });
    } catch (validationError) {
      toast.error(validationError instanceof Error ? validationError.message : "Revise os componentes comerciais.");
      return;
    }

    setSavingCommercial(true);
    try {
      const saved = await upsertSteelFrameCommercialComponents(estimateId, components);
      setSnapshot((current) => current ? { ...current, commercialComponents: saved } : current);
      toast.success("Componentes comerciais salvos.");
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSavingCommercial(false);
    }
  }

  if (loading) return <EstimateCostingSkeleton />;

  if (error || !snapshot) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 text-sm text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0 text-accent" /><p>{error ?? "A precificacao nao esta disponivel para esta conta."}</p></div>
          <Button variant="outline" onClick={() => void load()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-5" aria-label="Precificacao do orcamento">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-semibold text-foreground">Quantitativos e precificacao</h2><p className="mt-1 text-sm text-muted-foreground">{readOnly ? "A versao aprovada preserva estes custos e percentuais somente para consulta." : "Custos so usam itens e precos vigentes cadastrados no catalogo."}</p></div>
        <Button variant="outline" size="sm" onClick={() => void load()}>Atualizar dados</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CostMetric label="Materiais" value={formatSteelFrameCurrency(directCosts.materialCost)} icon={Boxes} />
        <CostMetric label="Mao de obra" value={formatSteelFrameCurrency(directCosts.laborCost)} icon={HardHat} />
        <CostMetric label="Operacionais" value={formatSteelFrameCurrency(directCosts.operationalCost)} icon={Factory} />
        <CostMetric label="Custo direto" value={formatSteelFrameCurrency(directCosts.directCost)} icon={Banknote} accent />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-primary"><Calculator className="size-4" /> Adicionar item calculado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {materials.length ? (
              <form className="grid gap-3 md:grid-cols-2" onSubmit={saveCalculatedItem}>
                <fieldset disabled={readOnly} className="contents">
                <FormField label="Material do catalogo" className="md:col-span-2">
                  <Select value={calculationForm.materialId || "unselected"} onValueChange={(value) => setCalculationForm((current) => ({ ...current, materialId: value === "unselected" ? "" : value }))} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="Selecionar material" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unselected">Selecionar material</SelectItem>
                      {materials.map((material) => {
                        const price = getCurrentMaterialPrice(material);
                        return <SelectItem key={material.id} value={material.id}>{material.name} - {material.unit}{price ? ` - ${formatSteelFrameCurrency(price.unitCost)}` : " - sem preco vigente"}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Regra de calculo">
                  <Select value={calculationForm.ruleType} onValueChange={(value) => setCalculationForm((current) => ({ ...current, ruleType: value as SteelFrameCalculationRuleType, parameter: "", manualQuantity: "" }))} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{calculationRules.map((rule) => <SelectItem key={rule.value} value={rule.value}>{rule.label}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Perda prevista (%)">
                  <Input inputMode="decimal" value={calculationForm.wastePercent} onChange={(event) => setCalculationForm((current) => ({ ...current, wastePercent: event.target.value }))} />
                </FormField>
                {selectedParameter ? <FormField label={selectedParameter.label}><Input inputMode="decimal" value={calculationForm.parameter} onChange={(event) => setCalculationForm((current) => ({ ...current, parameter: event.target.value }))} placeholder="Informar parametro confirmado" /></FormField> : null}
                {calculationForm.ruleType === "MANUAL" ? <FormField label="Quantidade manual"><Input inputMode="decimal" value={calculationForm.manualQuantity} onChange={(event) => setCalculationForm((current) => ({ ...current, manualQuantity: event.target.value }))} placeholder="Informar quantidade" /></FormField> : null}
                {calculationForm.ruleType === "FASTENER_BY_BOARD" ? <FormField label="Quantidade de placas"><Input inputMode="decimal" value={calculationForm.boardCount} onChange={(event) => setCalculationForm((current) => ({ ...current, boardCount: event.target.value }))} placeholder="Informar quantidade confirmada" /></FormField> : null}
                {calculationForm.ruleType === "FASTENER_BY_STUD" ? <FormField label="Quantidade de montantes"><Input inputMode="decimal" value={calculationForm.studCount} onChange={(event) => setCalculationForm((current) => ({ ...current, studCount: event.target.value }))} placeholder="Informar quantidade confirmada" /></FormField> : null}
                <FormField label="Arredondamento">
                  <Select value={calculationForm.roundingMode} onValueChange={(value) => setCalculationForm((current) => ({ ...current, roundingMode: value as CalculationForm["roundingMode"] }))} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sem arredondar</SelectItem><SelectItem value="ceil">Para cima</SelectItem><SelectItem value="nearest">Mais proximo</SelectItem><SelectItem value="floor">Para baixo</SelectItem></SelectContent>
                  </Select>
                </FormField>
                <FormField label="Multiplo de arredondamento"><Input inputMode="decimal" value={calculationForm.roundingMultiple} onChange={(event) => setCalculationForm((current) => ({ ...current, roundingMultiple: event.target.value }))} /></FormField>
                <div className="md:col-span-2 rounded-lg border border-border/70 bg-secondary/30 p-3 text-sm">
                  {calculationPreview.quantity ? <div className="space-y-1"><p className="font-medium text-foreground">{calculationPreview.quantity.finalQuantity} {selectedMaterial?.unit} - {formatSteelFrameCurrency(calculationPreview.quantity.finalQuantity * (selectedPrice?.unitCost ?? 0))}</p><p className="text-muted-foreground">{calculationPreview.quantity.explanation} Custo do catalogo vigente em {selectedPrice?.effectiveFrom}.</p></div> : <p className="text-muted-foreground">{calculationPreview.error ?? "Informe os dados tecnicos para visualizar o quantitativo."}</p>}
                </div>
                <p className="md:col-span-2 text-xs text-muted-foreground">Todos os itens entram como pendentes de revisao tecnica. Nenhuma medida ou perda e preenchida automaticamente.</p>
                <Button type="submit" className="md:col-span-2" disabled={readOnly || savingMaterial || !calculationPreview.quantity}><PackagePlus className="size-4" />{savingMaterial ? "Adicionando..." : "Adicionar ao custo direto"}</Button>
                </fieldset>
              </form>
            ) : <EmptyCosting label="Cadastre materiais e precos vigentes no catalogo antes de calcular quantitativos." />}

            <CostList title="Itens de materiais" emptyLabel="Nenhum item calculado ainda." rows={snapshot.calculatedItems.map((item) => ({ id: item.id, title: item.label, detail: `${item.calculated_quantity} ${item.unit} · ${item.calculation_rule}`, value: formatSteelFrameCurrency(Number(item.total_cost)), review: item.requires_technical_review }))} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><HardHat className="size-4" /> Mao de obra</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <CostList title="" emptyLabel="Nenhuma mao de obra adicionada." rows={snapshot.laborItems.map((item) => ({ id: item.id, title: item.label, detail: `${item.quantity} ${item.unit} x ${formatSteelFrameCurrency(Number(item.unit_cost))}`, value: formatSteelFrameCurrency(Number(item.total_cost)) }))} />
              <form className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2" onSubmit={saveLabor}>
                <fieldset disabled={readOnly} className="contents">
                <FormField label="Descricao"><Input value={laborForm.label} onChange={(event) => setLaborForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex: Montagem de paines" /></FormField>
                <FormField label="Unidade"><Input value={laborForm.unit} onChange={(event) => setLaborForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Ex: m2, diaria" /></FormField>
                <FormField label="Quantidade"><Input inputMode="decimal" value={laborForm.quantity} onChange={(event) => setLaborForm((current) => ({ ...current, quantity: event.target.value }))} /></FormField>
                <FormField label="Custo unitario"><Input inputMode="decimal" value={laborForm.unitCost} onChange={(event) => setLaborForm((current) => ({ ...current, unitCost: event.target.value }))} /></FormField>
                <div className="sm:col-span-2"><FormField label="Observacao"><Textarea value={laborForm.notes} onChange={(event) => setLaborForm((current) => ({ ...current, notes: event.target.value }))} /></FormField></div>
                <Button type="submit" variant="outline" className="sm:col-span-2" disabled={readOnly || savingLabor}>{savingLabor ? "Adicionando..." : "Adicionar mao de obra"}</Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><Factory className="size-4" /> Custos operacionais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <CostList title="" emptyLabel="Nenhum custo operacional adicionado." rows={snapshot.operationalCosts.map((item) => ({ id: item.id, title: item.label, detail: item.category, value: formatSteelFrameCurrency(Number(item.amount)) }))} />
              <form className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2" onSubmit={saveOperationalCost}>
                <fieldset disabled={readOnly} className="contents">
                <FormField label="Categoria"><Input value={operationalForm.category} onChange={(event) => setOperationalForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex: Logistica" /></FormField>
                <FormField label="Custo"><Input value={operationalForm.label} onChange={(event) => setOperationalForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex: Frete" /></FormField>
                <FormField label="Valor"><Input inputMode="decimal" value={operationalForm.amount} onChange={(event) => setOperationalForm((current) => ({ ...current, amount: event.target.value }))} /></FormField>
                <div className="sm:col-span-2"><FormField label="Observacao"><Textarea value={operationalForm.notes} onChange={(event) => setOperationalForm((current) => ({ ...current, notes: event.target.value }))} /></FormField></div>
                <Button type="submit" variant="outline" className="sm:col-span-2" disabled={readOnly || savingOperational}>{savingOperational ? "Adicionando..." : "Adicionar custo"}</Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-accent/30 bg-accent/[0.045]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><ShieldCheck className="size-4" /> Composicao comercial</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Configure as regras comerciais confirmadas pela empresa. O motor mostra apenas calculos derivados destes percentuais e do custo direto salvo.</p>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={saveCommercialComponents}>
            <fieldset disabled={readOnly} className="contents">
            <PercentageField label="Reserva / contingencia sobre custo (%)" value={commercialForm.contingencyPercentOfCost} onChange={(value) => setCommercialForm((current) => ({ ...current, contingencyPercentOfCost: value }))} />
            <PercentageField label="Impostos sobre venda (%)" value={commercialForm.taxPercentOfSale} onChange={(value) => setCommercialForm((current) => ({ ...current, taxPercentOfSale: value }))} />
            <PercentageField label="Comissao comercial sobre venda (%)" value={commercialForm.salesCommissionPercentOfSale} onChange={(value) => setCommercialForm((current) => ({ ...current, salesCommissionPercentOfSale: value }))} />
            <PercentageField label="Comissao de plataforma sobre venda (%)" value={commercialForm.platformCommissionPercentOfSale} onChange={(value) => setCommercialForm((current) => ({ ...current, platformCommissionPercentOfSale: value }))} />
            <PercentageField label="Margem alvo sobre venda (%)" value={commercialForm.targetMarginPercentOfSale} onChange={(value) => setCommercialForm((current) => ({ ...current, targetMarginPercentOfSale: value }))} />
            <PercentageField label="Desconto maximo permitido (%)" value={commercialForm.maxDiscountPercent} onChange={(value) => setCommercialForm((current) => ({ ...current, maxDiscountPercent: value }))} />
            <div className="md:col-span-2 xl:col-span-3 flex flex-col gap-3 rounded-xl border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>{commercialPreview ? <><p className="text-sm text-muted-foreground">Preco recomendado</p><p className="text-xl font-semibold text-foreground">{formatSteelFrameCurrency(commercialPreview.recommendedSalePrice)}</p><p className="mt-1 text-xs text-muted-foreground">Minimo: {formatSteelFrameCurrency(commercialPreview.minimumSalePrice)} · desconto maximo: {formatSteelFrameCurrency(commercialPreview.maximumAllowedDiscountAmount)}</p></> : <p className="text-sm text-muted-foreground">Preencha todos os percentuais, inclusive 0%, para visualizar a faixa comercial.</p>}</div>
              <Button type="submit" disabled={readOnly || savingCommercial}><Save className="size-4" />{savingCommercial ? "Salvando..." : "Salvar composicao"}</Button>
            </div>
            </fieldset>
          </form>
          {commercialPreview?.warnings.length ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm text-amber-900 dark:text-amber-100">{commercialPreview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function FormField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

function PercentageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <FormField label={label}><Input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" /></FormField>;
}

function CostMetric({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: typeof Banknote; accent?: boolean }) {
  return <Card className={accent ? "border-accent/35 bg-accent/[0.06]" : "border-primary/10"}><CardContent className="flex gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary"><Icon className="size-4" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-semibold text-foreground">{value}</p></div></CardContent></Card>;
}

function CostList({ title, emptyLabel, rows }: { title: string; emptyLabel: string; rows: Array<{ id: string; title: string; detail: string; value: string; review?: boolean }> }) {
  return <div className="space-y-2">{title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}{rows.length ? rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-sm"><div className="min-w-0"><p className="truncate font-medium text-foreground">{row.title}</p><p className="truncate text-xs text-muted-foreground">{row.detail}</p></div><div className="shrink-0 text-right"><p className="font-medium text-foreground">{row.value}</p>{row.review ? <p className="text-[11px] text-amber-700 dark:text-amber-300">Revisao tecnica</p> : null}</div></div>) : <EmptyCosting label={emptyLabel} />}</div>;
}

function EmptyCosting({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{label}</p>;
}

function EstimateCostingSkeleton() {
  return <div className="space-y-5" aria-label="Carregando precificacao"><div className="h-14 animate-pulse rounded-xl bg-muted" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div><div className="grid gap-5 xl:grid-cols-2"><div className="h-[34rem] animate-pulse rounded-xl bg-muted" /><div className="h-[34rem] animate-pulse rounded-xl bg-muted" /></div></div>;
}
