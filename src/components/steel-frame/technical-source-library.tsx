"use client";

import {
  BookOpenText,
  ExternalLink,
  FileText,
  FolderLock,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigationAccess } from "@/components/app-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSteelFrameErrorMessage } from "@/lib/steel-frame/data";
import {
  createSupabaseSteelFrameCatalogRepository,
  deleteTechnicalSourceDocument,
  formatTechnicalSourceDocumentSize,
  getTechnicalSourceDocumentSignedUrl,
  getTechnicalSourceDocumentValidationError,
  uploadTechnicalSourceDocument,
  type SteelFrameCatalogTechnicalSource,
  type SteelFrameTechnicalSourceType,
} from "@/lib/steel-frame/catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SourceForm = {
  title: string;
  sourceType: SteelFrameTechnicalSourceType;
  issuer: string;
  edition: string;
  revision: string;
  sourceUrl: string;
  permittedUse: string;
  notes: string;
};

const initialForm: SourceForm = {
  title: "",
  sourceType: "technical_sheet",
  issuer: "",
  edition: "",
  revision: "",
  sourceUrl: "",
  permittedUse: "",
  notes: "",
};

const sourceTypeLabels: Record<SteelFrameTechnicalSourceType, string> = {
  standard: "Norma",
  guideline: "Diretriz",
  manual: "Manual",
  technical_sheet: "Ficha tecnica",
  catalog: "Catalogo",
  structural_project: "Projeto estrutural",
  memorial: "Memorial",
  approved_composition: "Composicao aprovada",
  internal_guidance: "Orientacao interna",
  installer_validated_method: "Metodo validado pelo instalador",
  supplier_quote: "Cotacao de fornecedor",
  price_table: "Tabela de precos",
  calibration_case: "Caso de calibracao",
};

const statusLabels = {
  draft: "Rascunho",
  pending_validation: "Em validacao",
  approved: "Aprovada",
  deprecated: "Deprecada",
  archived: "Arquivada",
} as const;

function nullable(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export function TechnicalSourceLibrary() {
  const { role, permissions, loading: accessLoading } = useNavigationAccess();
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const repository = useMemo(() => createSupabaseSteelFrameCatalogRepository(client), [client]);
  const [sources, setSources] = useState<SteelFrameCatalogTechnicalSource[]>([]);
  const [form, setForm] = useState<SourceForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSourceId, setUploadingSourceId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = role === "admin" || permissions.includes("*") || permissions.includes("estimates.catalog.manage");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSources(await repository.listTechnicalSources());
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await repository.createTechnicalSource({
        title: form.title.trim(),
        sourceType: form.sourceType,
        code: null,
        issuer: nullable(form.issuer),
        manufacturer: null,
        productName: null,
        edition: nullable(form.edition),
        revision: nullable(form.revision),
        publishedOn: null,
        effectiveFrom: null,
        effectiveTo: null,
        sourceUrl: nullable(form.sourceUrl),
        contentSha256: null,
        permittedUse: nullable(form.permittedUse),
        notes: nullable(form.notes),
      });
      setForm(initialForm);
      toast.success("Fonte tecnica criada como rascunho.");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(source: SteelFrameCatalogTechnicalSource, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = getTechnicalSourceDocumentValidationError(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploadingSourceId(source.id);
    try {
      await uploadTechnicalSourceDocument({ client, repository, sourceId: source.id, file });
      toast.success("Documento tecnico guardado no bucket privado.");
      await load();
    } catch (uploadError) {
      toast.error(getSteelFrameErrorMessage(uploadError));
    } finally {
      setUploadingSourceId(null);
    }
  }

  async function openDocument(storagePath: string) {
    try {
      const signedUrl = await getTechnicalSourceDocumentSignedUrl({ client, storagePath });
      const opened = window.open(signedUrl, "_blank", "noopener,noreferrer");
      if (!opened) toast.error("Permita a abertura de nova aba para visualizar o documento privado.");
    } catch (openError) {
      toast.error(getSteelFrameErrorMessage(openError));
    }
  }

  async function removeDocument(source: SteelFrameCatalogTechnicalSource, documentId: string) {
    const document = source.documents.find((item) => item.id === documentId);
    if (!document) return;
    if (!window.confirm(`Excluir o documento "${document.originalFileName}"?`)) return;

    setDeletingDocumentId(document.id);
    try {
      await deleteTechnicalSourceDocument({ client, repository, document });
      toast.success("Documento tecnico excluido.");
      await load();
    } catch (deleteError) {
      toast.error(getSteelFrameErrorMessage(deleteError));
    } finally {
      setDeletingDocumentId(null);
    }
  }

  if (loading || accessLoading) return <SourceLibrarySkeleton />;

  if (error) {
    return (
      <Card className="border-destructive/25">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-destructive">Nao foi possivel carregar a biblioteca tecnica.</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/15 bg-secondary/25">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <FolderLock className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <p className="font-medium text-foreground">Fontes e arquivos privados</p>
            <p className="mt-1">Registre a procedencia antes de usar uma referencia tecnica. Arquivos ficam no bucket privado e sao abertos somente por URL assinada. Criar uma fonte nao publica regra, preco ou composicao.</p>
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-primary"><BookOpenText className="size-4" /> Nova fonte tecnica</CardTitle>
            <CardDescription>Use somente referencias que possam ser revisadas pela equipe responsavel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
              <Field label="Titulo" className="md:col-span-2"><Input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Manual do sistema de vedacao" /></Field>
              <Field label="Tipo"><Select value={form.sourceType} onValueChange={(value) => setForm((current) => ({ ...current, sourceType: value as SteelFrameTechnicalSourceType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Emissor ou fabricante"><Input value={form.issuer} onChange={(event) => setForm((current) => ({ ...current, issuer: event.target.value }))} placeholder="Empresa, orgao ou responsavel" /></Field>
              <Field label="Edicao"><Input value={form.edition} onChange={(event) => setForm((current) => ({ ...current, edition: event.target.value }))} placeholder="Edicao ou ano" /></Field>
              <Field label="Revisao"><Input value={form.revision} onChange={(event) => setForm((current) => ({ ...current, revision: event.target.value }))} placeholder="Revisao ou versao" /></Field>
              <Field label="URL de origem" className="md:col-span-2"><Input type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://..." /></Field>
              <Field label="Uso permitido" className="md:col-span-2"><Textarea className="min-h-16" value={form.permittedUse} onChange={(event) => setForm((current) => ({ ...current, permittedUse: event.target.value }))} placeholder="Contexto autorizado, limites e condicoes de uso." /></Field>
              <Field label="Observacoes" className="md:col-span-2"><Textarea className="min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Nenhuma regra ou coeficiente sera aprovado por este cadastro." /></Field>
              <Button type="submit" className="md:col-span-2" disabled={saving}><BookOpenText className="size-4" />{saving ? "Criando..." : "Criar fonte em rascunho"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {sources.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              canManage={canManage}
              uploading={uploadingSourceId === source.id}
              deletingDocumentId={deletingDocumentId}
              onUpload={(event) => void uploadDocument(source, event)}
              onOpen={(storagePath) => void openDocument(storagePath)}
              onRemove={(documentId) => void removeDocument(source, documentId)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-primary/20">
          <CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
            <BookOpenText className="mb-3 size-8 text-accent" />
            <h2 className="font-semibold">Nenhuma fonte cadastrada</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">Cadastre o manual, memorial, ficha tecnica ou cotacao que fundamenta uma decisao. O registro comeca sempre como rascunho.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SourceCard({
  source,
  canManage,
  uploading,
  deletingDocumentId,
  onUpload,
  onOpen,
  onRemove,
}: {
  source: SteelFrameCatalogTechnicalSource;
  canManage: boolean;
  uploading: boolean;
  deletingDocumentId: string | null;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpen: (storagePath: string) => void;
  onRemove: (documentId: string) => void;
}) {
  const uploadId = `technical-source-upload-${source.id}`;
  return (
    <Card className="border-primary/10">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{source.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sourceTypeLabels[source.sourceType]}{source.issuer ? ` - ${source.issuer}` : ""}</p>
          </div>
          <Badge variant={source.status === "approved" ? "success" : source.status === "draft" ? "warning" : "secondary"}>{statusLabels[source.status]}</Badge>
        </div>
        <div className="grid gap-2 border-y border-border/70 py-3 text-xs text-muted-foreground sm:grid-cols-2">
          <p><span className="font-medium text-foreground">Edicao:</span> {source.edition || "A confirmar"}</p>
          <p><span className="font-medium text-foreground">Revisao:</span> {source.revision || "A confirmar"}</p>
          <p><span className="font-medium text-foreground">Documentos:</span> {source.documents.length}</p>
          <p><span className="font-medium text-foreground">Uso:</span> {source.permittedUse || "A confirmar"}</p>
        </div>
        {source.notes ? <p className="text-sm text-muted-foreground">{source.notes}</p> : null}
        {source.sourceUrl ? <Button asChild size="sm" variant="outline"><a href={source.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Ver origem</a></Button> : null}
        <div className="space-y-2">
          <p className="text-sm font-medium">Documentos privados</p>
          {source.documents.length ? (
            <ul className="space-y-2">
              {source.documents.map((document) => (
                <li key={document.id} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{document.originalFileName}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatTechnicalSourceDocumentSize(document.fileSizeBytes)} - {document.mimeType}</p></div>
                  <div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onOpen(document.storagePath)}><ExternalLink className="size-4" /> Abrir</Button>{canManage ? <Button type="button" size="icon" variant="ghost" aria-label={`Excluir ${document.originalFileName}`} disabled={deletingDocumentId === document.id} onClick={() => onRemove(document.id)}><Trash2 className="size-4 text-destructive" /></Button> : null}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum arquivo vinculado.</p>}
        </div>
        {canManage ? <div><input id={uploadId} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={onUpload} /><label htmlFor={uploadId} className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground ${uploading ? "pointer-events-none opacity-60" : ""}`}><Upload className="size-4" />{uploading ? <><LoaderCircle className="size-4 animate-spin" /> Enviando...</> : "Anexar documento"}</label></div> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

function SourceLibrarySkeleton() {
  return <div className="space-y-5" aria-label="Carregando biblioteca tecnica"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-[31rem] animate-pulse rounded-xl bg-muted" /><div className="grid gap-4 xl:grid-cols-2"><div className="h-72 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div></div>;
}
