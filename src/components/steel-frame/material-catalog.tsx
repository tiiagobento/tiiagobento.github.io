"use client";

import { BookMarked, PackagePlus, RefreshCw, ShieldCheck, Tag } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigationAccess } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSteelFrameMaterial, getSteelFrameErrorMessage, listSteelFrameMaterials } from "@/lib/steel-frame/data";
import type { SteelFrameMaterialRecord } from "@/lib/steel-frame/types";

export function MaterialCatalog() {
  const { role, permissions, loading: accessLoading } = useNavigationAccess();
  const [materials, setMaterials] = useState<SteelFrameMaterialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", unit: "un", sku: "", unitCost: "" });
  const canManage = role === "admin" || permissions.includes("*") || permissions.includes("estimates.catalog.manage");

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

  const grouped = useMemo(() => {
    return materials.reduce<Record<string, SteelFrameMaterialRecord[]>>((groups, material) => {
      const key = material.category || "Sem categoria";
      groups[key] = [...(groups[key] ?? []), material];
      return groups;
    }, {});
  }, [materials]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.unit.trim()) {
      toast.error("Informe nome, categoria e unidade do material.");
      return;
    }

    const initialUnitCost = form.unitCost.trim() ? Number(form.unitCost) : null;
    if (initialUnitCost !== null && (!Number.isFinite(initialUnitCost) || initialUnitCost < 0)) {
      toast.error("Informe um custo inicial valido ou deixe o campo vazio.");
      return;
    }

    setSaving(true);
    try {
      await createSteelFrameMaterial({
        name: form.name,
        category: form.category,
        unit: form.unit,
        sku: form.sku,
        initialUnitCost,
      });
      setForm({ name: "", category: "", unit: "un", sku: "", unitCost: "" });
      toast.success("Material cadastrado no catalogo.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading || accessLoading) return <CatalogSkeleton />;

  if (error) {
    return (
      <Card className="border-destructive/25"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-destructive">Nao foi possivel carregar o catalogo.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button></CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/10 bg-secondary/20">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">Modelos tecnicos e regras aprovadas</p><p className="mt-1 text-sm text-muted-foreground">Configure fontes, limites e responsaveis em um catalogo versionado antes de liberar qualquer classificacao automatica.</p></div>
          <Button asChild variant="outline"><Link href="/estimates/catalog/technical"><BookMarked className="size-4" /> Abrir modelos tecnicos</Link></Button>
        </CardContent>
      </Card>
      {canManage ? (
        <Card className="border-primary/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><PackagePlus className="size-4" /> Adicionar material</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={submit}>
              <Field label="Material"><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Perfil montante" /></Field>
              <Field label="Categoria"><Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Perfis, placas..." /></Field>
              <Field label="Unidade"><Input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="un, m, m2" /></Field>
              <Field label="SKU opcional"><Input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} /></Field>
              <Field label="Custo inicial opcional"><Input type="number" step="0.01" min={0} value={form.unitCost} onChange={(event) => setForm((current) => ({ ...current, unitCost: event.target.value }))} placeholder="Nao inventar" /></Field>
              <Button className="sm:col-span-2 lg:col-span-5 lg:justify-self-end" disabled={saving}><PackagePlus className="size-4" />{saving ? "Cadastrando..." : "Cadastrar material"}</Button>
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
                {categoryMaterials.map((material) => <MaterialCard key={material.id} material={material} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-primary/20"><CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><Tag className="mb-3 size-7 text-accent" /><h2 className="font-semibold">Catalogo ainda vazio</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Cadastre os materiais e precos reais usados pela Nova Forma antes de gerar quantitativos ou valores comerciais.</p></CardContent></Card>
      )}
    </div>
  );
}

function MaterialCard({ material }: { material: SteelFrameMaterialRecord }) {
  const currentPrice = [...(material.prices ?? [])].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  return <Card className="border-primary/10"><CardContent className="space-y-3 p-4"><div><p className="font-medium">{material.name}</p><p className="mt-1 text-xs text-muted-foreground">{material.sku || "Sem SKU"} - {material.unit}</p></div><div className="border-t border-border/70 pt-3"><p className="text-xs text-muted-foreground">Custo vigente</p><p className="mt-1 text-sm font-semibold text-primary">{currentPrice ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: currentPrice.currency || "BRL" }).format(Number(currentPrice.unit_cost)) : "A confirmar"}</p></div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function CatalogSkeleton() {
  return <div className="space-y-5" aria-label="Carregando catalogo"><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div></div>;
}
