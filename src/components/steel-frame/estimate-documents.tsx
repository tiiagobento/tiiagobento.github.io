"use client";

import * as React from "react";
import { Download, FileArchive, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstimateDocumentAnalysis } from "@/components/steel-frame/estimate-document-analysis";
import {
  deleteSteelFrameDocument,
  getSteelFrameDocumentSignedUrl,
  getSteelFrameErrorMessage,
  listSteelFrameDocuments,
  uploadSteelFrameDocument,
} from "@/lib/steel-frame/data";
import {
  formatSteelFrameDocumentSize,
  getSteelFrameDocumentValidationError,
  steelFrameDocumentTypeOptions,
  steelFrameDocumentVisibilityOptions,
} from "@/lib/steel-frame/documents";
import type {
  SteelFrameDocumentRecord,
  SteelFrameDocumentType,
  SteelFrameDocumentVisibility,
} from "@/lib/steel-frame/types";

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function EstimateDocuments({
  estimateId,
  wallCount,
  openingCount,
  onGeometryChanged,
  readOnly = false,
}: {
  estimateId: string;
  wallCount: number;
  openingCount: number;
  onGeometryChanged: () => Promise<void> | void;
  readOnly?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = React.useState<SteelFrameDocumentRecord[]>([]);
  const [documentType, setDocumentType] = React.useState<SteelFrameDocumentType>("plant");
  const [visibility, setVisibility] = React.useState<SteelFrameDocumentVisibility>("technical");
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await listSteelFrameDocuments(estimateId));
    } catch (loadError) {
      setDocuments([]);
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [estimateId]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadSelectedFiles(event: React.ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedFiles.length) return;

    const invalid = selectedFiles.map(getSteelFrameDocumentValidationError).find(Boolean);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setUploading(true);
    try {
      const uploaded: SteelFrameDocumentRecord[] = [];
      for (const file of selectedFiles) {
        uploaded.push(await uploadSteelFrameDocument({ estimateId, file, documentType, visibility }));
      }
      setDocuments((current) => [...uploaded, ...current]);
      toast.success(selectedFiles.length === 1 ? "Documento privado enviado." : `${selectedFiles.length} documentos privados enviados.`);
    } catch (uploadError) {
      toast.error(getSteelFrameErrorMessage(uploadError));
      await loadDocuments();
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(document: SteelFrameDocumentRecord) {
    try {
      const signedUrl = await getSteelFrameDocumentSignedUrl(document.storage_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (openError) {
      toast.error(getSteelFrameErrorMessage(openError));
    }
  }

  async function removeDocument(document: SteelFrameDocumentRecord) {
    if (!window.confirm(`Excluir o documento "${document.original_file_name}"? Esta acao nao pode ser desfeita.`)) return;
    setRemovingId(document.id);
    try {
      await deleteSteelFrameDocument(document);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      toast.success("Documento excluido.");
    } catch (removeError) {
      toast.error(getSteelFrameErrorMessage(removeError));
      await loadDocuments();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-primary"><Paperclip className="size-4" /> Documentos tecnicos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border bg-secondary/25 p-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5"><Label>Tipo</Label><Select value={documentType} onValueChange={(value) => setDocumentType(value as SteelFrameDocumentType)} disabled={readOnly || uploading}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{steelFrameDocumentTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Visibilidade</Label><Select value={visibility} onValueChange={(value) => setVisibility(value as SteelFrameDocumentVisibility)} disabled={readOnly || uploading}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{steelFrameDocumentVisibilityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end"><Input ref={inputRef} className="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={uploadSelectedFiles} disabled={readOnly || uploading} /><Button type="button" className="w-full" onClick={() => inputRef.current?.click()} disabled={readOnly || uploading}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{uploading ? "Enviando..." : "Adicionar documentos"}</Button></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{readOnly ? "Esta versao esta congelada: documentos permanecem disponiveis para consulta, sem inclusao ou exclusao." : "Aceita PDF, JPG, PNG e WEBP, ate 20 MB por arquivo. O bucket e privado e a imagem nao fica publica."}</p>
        </div>

        {error ? <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => void loadDocuments()}>Tentar novamente</Button></div> : null}

        {loading ? <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando documentos...</div> : null}
        {!loading && !error && !documents.length ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma planta, croqui, foto ou PDF foi anexado a este orcamento.</p> : null}
        {!loading && documents.length ? <div className="space-y-2">{documents.map((document) => <div key={document.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><FileArchive className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{document.original_file_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{steelFrameDocumentTypeOptions.find((option) => option.value === document.document_type)?.label ?? document.document_type} · {formatSteelFrameDocumentSize(Number(document.file_size_bytes))} · {formatUploadedAt(document.created_at)}</p></div></div><div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void openDocument(document)}><Download className="size-4" /> Abrir</Button>{!readOnly ? <Button type="button" variant="outline" size="icon" aria-label={`Excluir ${document.original_file_name}`} onClick={() => void removeDocument(document)} disabled={removingId === document.id}>{removingId === document.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}</Button> : null}</div></div>)}</div> : null}
        {!loading && !error && documents.length && !readOnly ? <EstimateDocumentAnalysis estimateId={estimateId} documents={documents} wallCount={wallCount} openingCount={openingCount} onGeometryChanged={onGeometryChanged} /> : null}
      </CardContent>
    </Card>
  );
}
