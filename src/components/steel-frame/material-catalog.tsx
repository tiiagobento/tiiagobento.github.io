"use client";

import {
  Archive,
  BadgeDollarSign,
  BookMarked,
  BookOpenText,
  History,
  PackagePlus,
  Pencil,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigationAccess } from "@/components/app-navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentMaterialPrice } from "@/lib/steel-frame/costing";
import {
  archiveSteelFrameMaterial,
  createSteelFrameMaterial,
  getSteelFrameErrorMessage,
  listSteelFrameMaterials,
  registerSteelFrameMaterialPrice,
  updateSteelFrameMaterial,
} from "@/lib/steel-frame/data";
import type { SteelFrameMaterialRecord } from "@/lib/steel-frame/types";

type MaterialForm = { name: string; category: string; unit: string; sku: string };
type PriceForm = { unitCost: string; effectiveFrom: string; sourceReference: string };

const emptyMaterialForm: MaterialForm = { name: "", category: "", unit: "un", sku: "" };

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function MaterialCatalog() {
  const { role, permissions, loading: accessLoading } = useNavigationAccess();
  const [materials, setMaterials] = useState<SteelFrameMaterialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MaterialForm>(emptyMaterialForm);
  const [editTarget, setEditTarget] = useState<SteelFrameMaterialRecord | null>(null);
  const [editForm, setEditForm] = useState<MaterialForm>(emptyMaterialForm);
  const [priceTarget, setPriceTarget] = useState<SteelFrameMaterialRecord | null>(null);
  const [priceForm, setPriceForm] = useState<PriceForm>({ unitCost: "", effectiveFrom: todayDate(), sourceReference: "" });
  const [archiveTarget, setArchiveTarget] = useState<SteelFrameMaterialRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const canManageCatalog = role === "admin" || permissions.includes("*") || permissions.includes("estimates.catalog.manage");
  const canManagePrices = role === "admin" || permissions.includes("*") || permissions.includes("estimates.prices.manage");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMaterials(await listSteelFrameMaterials());
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => materials.reduce<Record<string, SteelFrameMaterialRecord[]>>((groups, material) => {
    const key = material.category || "Sem categoria";
    groups[key] = [...(groups[key] ?? []), material];
    return groups;
  }, {}), [materials]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createSteelFrameMaterial({ ...form, initialUnitCost: null });
      setForm(emptyMaterialForm);
      toast.success("Material cadastrado no catalogo.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(material: SteelFrameMaterialRecord) {
    setEditTarget(material);
    setEditForm({ name: material.name, category: material.category, unit: material.unit, sku: material.sku ?? "" });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateSteelFrameMaterial({ materialId: editTarget.id, ...editForm });
      toast.success("Material atualizado e registrado na auditoria.");
      setEditTarget(null);
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function openPrice(material: SteelFrameMaterialRecord) {
    const current = getCurrentMaterialPrice(material);
    setPriceTarget(material);
    setPriceForm({
      unitCost: current ? String(current.unitCost) : "",
      effectiveFrom: todayDate(),
      sourceReference: "",
    });
  }

  async function savePrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priceTarget) return;
    setSaving(true);
    try {
      await registerSteelFrameMaterialPrice({
        materialId: priceTarget.id,
        unitCost: Number(priceForm.unitCost),
        effectiveFrom: priceForm.effectiveFrom,
        sourceReference: priceForm.sourceReference,
      });
      toast.success("Novo preco registrado sem apagar o historico.");
      setPriceTarget(null);
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await archiveSteelFrameMaterial({ materialId: archiveTarget.id, reason: archiveReason });
      toast.success("Material arquivado sem apagar precos ou orcamentos antigos.");
      setArchiveTarget(null);
      setArchiveReason("");
      await load();
    } catch (archiveError) {
      toast.error(getSteelFrameErrorMessage(archiveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading || accessLoading) return <CatalogSkeleton />;

  if (error) {
    return (
      <Card className="border-destructive/25">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium text-destructive">Nao foi possivel carregar o catalogo.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/10 bg-secondary/20">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">Modelos tecnicos e regras aprovadas</p><p className="mt-1 text-sm text-muted-foreground">Configure fontes, limites e responsaveis em um catalogo versionado antes de liberar qualquer classificacao automatica.</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/estimates/catalog/technical"><BookMarked className="size-4" /> Modelos tecnicos</Link></Button><Button asChild variant="outline"><Link href="/estimates/catalog/sources"><BookOpenText className="size-4" /> Biblioteca tecnica</Link></Button><Button asChild variant="outline"><Link href="/estimates/catalog/supplier-quotes"><ReceiptText className="size-4" /> Cotacoes</Link></Button></div>
        </CardContent>
      </Card>

      {canManageCatalog ? (
        <Card className="border-primary/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><PackagePlus className="size-4" /> Adicionar material</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
              <Field label="Material"><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Perfil montante" /></Field>
              <Field label="Categoria"><Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Perfis, placas..." /></Field>
              <Field label="Unidade"><Input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="un, m, m2" /></Field>
              <Field label="SKU opcional"><Input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} /></Field>
              <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Cadastre o preco depois, com a fonte e a vigencia documentadas.</p>
                <Button disabled={saving}><PackagePlus className="size-4" />{saving ? "Cadastrando..." : "Cadastrar material"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/10 bg-secondary/25"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" /><p>Voce esta consultando o catalogo. A criacao e alteracao de materiais exigem permissao explicita de gestao do catalogo.</p></CardContent></Card>
      )}

      {Object.keys(grouped).length ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, categoryMaterials]) => (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {categoryMaterials.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    canManageCatalog={canManageCatalog}
                    canManagePrices={canManagePrices}
                    onEdit={() => openEdit(material)}
                    onPrice={() => openPrice(material)}
                    onArchive={() => setArchiveTarget(material)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-primary/20"><CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><Tag className="mb-3 size-7 text-accent" /><h2 className="font-semibold">Catalogo ainda vazio</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Cadastre os materiais e precos reais usados pela Nova Forma antes de gerar quantitativos ou valores comerciais.</p></CardContent></Card>
      )}

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => { if (!open && !saving) setEditTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar material</DialogTitle><DialogDescription>Os dados comerciais podem ser corrigidos sem alterar a especificacao tecnica ou o historico de precos.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={saveEdit}>
            <Field label="Material"><Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Categoria"><Input value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))} /></Field>
              <Field label="Unidade"><Input value={editForm.unit} onChange={(event) => setEditForm((current) => ({ ...current, unit: event.target.value }))} /></Field>
            </div>
            <Field label="SKU opcional"><Input value={editForm.sku} onChange={(event) => setEditForm((current) => ({ ...current, sku: event.target.value }))} /></Field>
            <DialogActions disabled={saving} onCancel={() => setEditTarget(null)} label={saving ? "Salvando..." : "Salvar alteracao"} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(priceTarget)} onOpenChange={(open) => { if (!open && !saving) setPriceTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Novo preco de {priceTarget?.name}</DialogTitle><DialogDescription>O preco anterior permanece no historico. A fonte pode ser uma cotacao, nota ou pesquisa comercial identificavel.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={savePrice}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Custo unitario"><Input aria-label="Custo unitario" type="number" min={0} step="0.01" value={priceForm.unitCost} onChange={(event) => setPriceForm((current) => ({ ...current, unitCost: event.target.value }))} /></Field>
              <Field label="Vigente a partir de"><Input aria-label="Vigente a partir de" type="date" value={priceForm.effectiveFrom} onChange={(event) => setPriceForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field>
            </div>
            <Field label="Fonte do preco"><Input aria-label="Fonte do preco" value={priceForm.sourceReference} onChange={(event) => setPriceForm((current) => ({ ...current, sourceReference: event.target.value }))} placeholder="Ex: Cotacao fornecedor 21279 de 03/08/2026" /></Field>
            <PriceHistory material={priceTarget} />
            <DialogActions disabled={saving} onCancel={() => setPriceTarget(null)} label={saving ? "Registrando..." : "Registrar novo preco"} />
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !saving) { setArchiveTarget(null); setArchiveReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Arquivar {archiveTarget?.name}?</AlertDialogTitle><AlertDialogDescription>O material deixa de aparecer em novos orcamentos, mas seus precos, usos anteriores e auditoria permanecem no banco.</AlertDialogDescription></AlertDialogHeader>
          <Field label="Motivo do arquivamento"><Textarea aria-label="Motivo do arquivamento" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Ex: produto descontinuado pelo fornecedor." /></Field>
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmArchive(); }} disabled={saving || archiveReason.trim().length < 3}><Archive className="size-4" />{saving ? "Arquivando..." : "Arquivar material"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MaterialCard({ material, canManageCatalog, canManagePrices, onEdit, onPrice, onArchive }: {
  material: SteelFrameMaterialRecord;
  canManageCatalog: boolean;
  canManagePrices: boolean;
  onEdit: () => void;
  onPrice: () => void;
  onArchive: () => void;
}) {
  const currentPrice = getCurrentMaterialPrice(material);
  return (
    <Card className="border-primary/10 transition-colors hover:border-primary/25">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="truncate font-medium">{material.name}</p><p className="mt-1 text-xs text-muted-foreground">{material.sku || "Sem SKU"} - {material.unit}</p></div>
          {(canManageCatalog || canManagePrices) ? <div className="flex shrink-0 gap-1">{canManagePrices ? <Button type="button" size="icon" variant="ghost" title="Registrar preco" aria-label={`Registrar preco de ${material.name}`} onClick={onPrice}><BadgeDollarSign className="size-4" /></Button> : null}{canManageCatalog ? <><Button type="button" size="icon" variant="ghost" title="Editar material" aria-label={`Editar ${material.name}`} onClick={onEdit}><Pencil className="size-4" /></Button><Button type="button" size="icon" variant="ghost" title="Arquivar material" aria-label={`Arquivar ${material.name}`} onClick={onArchive}><Archive className="size-4" /></Button></> : null}</div> : null}
        </div>
        <div className="border-t border-border/70 pt-3">
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Custo vigente</p><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><History className="size-3" /> {material.prices?.length ?? 0} registro(s)</span></div>
          <p className="mt-1 text-sm font-semibold text-primary">{currentPrice ? formatCurrency(currentPrice.unitCost, currentPrice.currency) : "A confirmar"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceHistory({ material }: { material: SteelFrameMaterialRecord | null }) {
  const prices = [...(material?.prices ?? [])].sort((left, right) => {
    const effectiveOrder = right.effective_from.localeCompare(left.effective_from);
    return effectiveOrder || (right.created_at ?? "").localeCompare(left.created_at ?? "");
  });
  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
      <p className="flex items-center gap-2 text-sm font-medium"><History className="size-4" /> Historico</p>
      {prices.length ? <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">{prices.map((price) => <div key={price.id} className="flex flex-col gap-1 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium text-foreground">{formatCurrency(Number(price.unit_cost), price.currency)}</p><p className="text-muted-foreground">{price.source_reference || "Fonte nao registrada"}</p></div><p className="shrink-0 text-muted-foreground">{formatDate(price.effective_from)}{price.effective_to ? ` a ${formatDate(price.effective_to)}` : " em diante"}</p></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Nenhum preco registrado.</p>}
    </div>
  );
}

function DialogActions({ disabled, onCancel, label }: { disabled: boolean; onCancel: () => void; label: string }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={disabled}><Save className="size-4" />{label}</Button></div>;
}

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function CatalogSkeleton() {
  return <div className="space-y-5" aria-label="Carregando catalogo"><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div></div>;
}
