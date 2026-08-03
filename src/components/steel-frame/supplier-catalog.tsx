"use client";

import * as React from "react";
import { Archive, Building2, Mail, Pencil, Phone, Plus, RefreshCw, ShieldCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseSteelFrameCatalogRepository, type SteelFrameSupplierRecord } from "@/lib/steel-frame/catalog";
import { getSteelFrameErrorMessage } from "@/lib/steel-frame/data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupplierForm = {
  name: string;
  taxId: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyForm: SupplierForm = {
  name: "",
  taxId: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
};

function nullable(value: string) {
  return value.trim() || null;
}

function toDraft(form: SupplierForm) {
  return {
    name: form.name,
    taxId: nullable(form.taxId),
    contactName: nullable(form.contactName),
    phone: nullable(form.phone),
    email: nullable(form.email),
    notes: nullable(form.notes),
  };
}

function toForm(supplier: SteelFrameSupplierRecord): SupplierForm {
  return {
    name: supplier.name,
    taxId: supplier.taxId ?? "",
    contactName: supplier.contactName ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    notes: supplier.notes ?? "",
  };
}

export function SupplierCatalog() {
  const { role, permissions, loading: accessLoading } = useNavigationAccess();
  const client = React.useMemo(() => createSupabaseBrowserClient(), []);
  const repository = React.useMemo(() => createSupabaseSteelFrameCatalogRepository(client), [client]);
  const [suppliers, setSuppliers] = React.useState<SteelFrameSupplierRecord[]>([]);
  const [form, setForm] = React.useState<SupplierForm>(emptyForm);
  const [editTarget, setEditTarget] = React.useState<SteelFrameSupplierRecord | null>(null);
  const [editForm, setEditForm] = React.useState<SupplierForm>(emptyForm);
  const [archiveTarget, setArchiveTarget] = React.useState<SteelFrameSupplierRecord | null>(null);
  const [archiveReason, setArchiveReason] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const canManage = role === "admin" || permissions.includes("*") || permissions.includes("estimates.catalog.manage");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await repository.listSuppliers());
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await repository.createSupplier(toDraft(form));
      setForm(emptyForm);
      toast.success("Fornecedor cadastrado e registrado na auditoria.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(supplier: SteelFrameSupplierRecord) {
    setEditTarget(supplier);
    setEditForm(toForm(supplier));
  }

  async function updateSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await repository.updateSupplier({ supplierId: editTarget.id, ...toDraft(editForm) });
      setEditTarget(null);
      toast.success("Fornecedor atualizado sem alterar cotacoes anteriores.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveSupplier() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await repository.archiveSupplier({ supplierId: archiveTarget.id, reason: archiveReason });
      setArchiveTarget(null);
      setArchiveReason("");
      toast.success("Fornecedor arquivado. Cotacoes, materiais e precos foram preservados.");
      await load();
    } catch (archiveError) {
      toast.error(getSteelFrameErrorMessage(archiveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading || accessLoading) return <SupplierCatalogSkeleton />;

  if (error) {
    return (
      <Card className="border-destructive/25">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium text-destructive">Nao foi possivel carregar os fornecedores.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const visibleSuppliers = suppliers.filter((supplier) => supplier.active || showArchived);
  const archivedCount = suppliers.filter((supplier) => !supplier.active).length;

  return (
    <div className="space-y-5">
      <Card className="border-primary/10 bg-secondary/20">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
          <div><p className="font-medium text-foreground">Cadastro comercial auditavel</p><p className="mt-1">Edicoes afetam apenas o cadastro atual. Cotacoes preservam o nome e o contato usados quando foram registradas, e fornecedores com historico sao arquivados em vez de excluidos.</p></div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="border-primary/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><Plus className="size-4" /> Novo fornecedor</CardTitle></CardHeader>
          <CardContent><SupplierFields form={form} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} onSubmit={createSupplier} saving={saving} submitLabel="Cadastrar fornecedor" /></CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold">Fornecedores</h2><p className="mt-1 text-sm text-muted-foreground">{suppliers.filter((supplier) => supplier.active).length} ativo(s) no catalogo.</p></div>
          {archivedCount ? <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-4 accent-primary" /> Mostrar arquivados ({archivedCount})</label> : null}
        </div>
        {visibleSuppliers.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleSuppliers.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} canManage={canManage} onEdit={() => openEdit(supplier)} onArchive={() => setArchiveTarget(supplier)} />)}
          </div>
        ) : (
          <Card className="border-dashed border-primary/20"><CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center"><Building2 className="mb-3 size-7 text-accent" /><p className="font-medium">Nenhum fornecedor cadastrado</p><p className="mt-1 text-sm text-muted-foreground">Cadastre apenas fornecedores reais usados em cotacoes ou compras.</p></CardContent></Card>
        )}
      </section>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => { if (!open && !saving) setEditTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Editar fornecedor</DialogTitle><DialogDescription>O historico das cotacoes permanece com o snapshot original.</DialogDescription></DialogHeader>
          <SupplierFields form={editForm} onChange={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))} onSubmit={updateSupplier} saving={saving} submitLabel="Salvar alteracoes" onCancel={() => setEditTarget(null)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !saving) { setArchiveTarget(null); setArchiveReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Arquivar {archiveTarget?.name}?</AlertDialogTitle><AlertDialogDescription>O fornecedor deixa de aparecer em novos vinculos. Cotacoes, materiais, precos e auditoria permanecem disponiveis.</AlertDialogDescription></AlertDialogHeader>
          <Field label="Motivo do arquivamento"><Textarea aria-label="Motivo do arquivamento" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Ex: fornecedor nao atende mais a regiao." /></Field>
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void archiveSupplier(); }} disabled={saving || archiveReason.trim().length < 3}><Archive className="size-4" />{saving ? "Arquivando..." : "Arquivar fornecedor"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SupplierFields({ form, onChange, onSubmit, saving, submitLabel, onCancel }: { form: SupplierForm; onChange: (field: keyof SupplierForm, value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; saving: boolean; submitLabel: string; onCancel?: () => void }) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fornecedor"><Input required value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Razao social ou nome comercial" /></Field>
        <Field label="CNPJ / identificador"><Input value={form.taxId} onChange={(event) => onChange("taxId", event.target.value)} /></Field>
        <Field label="Contato"><Input value={form.contactName} onChange={(event) => onChange("contactName", event.target.value)} /></Field>
        <Field label="Telefone"><Input inputMode="tel" value={form.phone} onChange={(event) => onChange("phone", event.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} /></Field>
      </div>
      <Field label="Observacoes"><Textarea value={form.notes} onChange={(event) => onChange("notes", event.target.value)} placeholder="Condicoes comerciais, regiao atendida ou observacoes internas." /></Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{onCancel ? <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancelar</Button> : null}<Button disabled={saving}><Building2 className="size-4" />{saving ? "Salvando..." : submitLabel}</Button></div>
    </form>
  );
}

function SupplierCard({ supplier, canManage, onEdit, onArchive }: { supplier: SteelFrameSupplierRecord; canManage: boolean; onEdit: () => void; onArchive: () => void }) {
  return (
    <Card className={supplier.active ? "border-primary/10" : "border-dashed opacity-75"}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{supplier.name}</p><p className="mt-1 text-xs text-muted-foreground">{supplier.taxId || "Identificador nao informado"}</p></div><Badge variant={supplier.active ? "secondary" : "outline"}>{supplier.active ? "Ativo" : "Arquivado"}</Badge></div>
        <div className="space-y-1.5 border-y border-border/70 py-3 text-sm text-muted-foreground">
          <p className="truncate">{supplier.contactName || "Contato a confirmar"}</p>
          {supplier.phone ? <p className="flex items-center gap-2"><Phone className="size-3.5" /> {supplier.phone}</p> : null}
          {supplier.email ? <p className="flex items-center gap-2 truncate"><Mail className="size-3.5" /> {supplier.email}</p> : null}
          {!supplier.phone && !supplier.email ? <p>Telefone e email nao informados.</p> : null}
        </div>
        {!supplier.active && supplier.archiveReason ? <p className="text-xs text-muted-foreground">Motivo: {supplier.archiveReason}</p> : null}
        {canManage && supplier.active ? <div className="flex justify-end gap-1"><Button type="button" size="icon" variant="ghost" aria-label={`Editar ${supplier.name}`} onClick={onEdit}><Pencil className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Arquivar ${supplier.name}`} onClick={onArchive}><Archive className="size-4" /></Button></div> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function SupplierCatalogSkeleton() {
  return <div className="space-y-5" aria-label="Carregando fornecedores"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-xl bg-muted" />)}</div></div>;
}
