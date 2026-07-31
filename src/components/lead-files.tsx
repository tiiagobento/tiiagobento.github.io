"use client";

import * as React from "react";
import { Download, FileArchive, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLeadFileStorageName, formatLeadFileSize, getLeadFileValidationError, leadFileCategories } from "@/lib/lead-files";
import { supabase } from "@/lib/supabase/client";
import type { LeadFile, LeadFileCategory } from "@/lib/types";

const storageBucket = "lead-files";

function isMissingLeadFilesTable(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "message" in error
    && typeof error.message === "string"
    && (error.message.includes("lead_files") || error.message.includes("lead-files"));
}

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function LeadFiles({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<LeadFile[]>([]);
  const [category, setCategory] = React.useState<LeadFileCategory>("Planta/projeto");
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [unavailable, setUnavailable] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const loadFiles = React.useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("lead_files")
      .select("id, lead_id, user_id, file_name, storage_path, mime_type, size_bytes, category, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingLeadFilesTable(error)) setUnavailable(true);
      else toast.error("Nao foi possivel carregar os anexos deste lead.");
      setFiles([]);
    } else {
      setUnavailable(false);
      setFiles((data ?? []) as LeadFile[]);
    }
    setLoading(false);
  }, [leadId]);

  React.useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function uploadSelectedFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedFiles.length) return;
    if (!supabase) {
      toast.error("Supabase nao esta configurado para enviar anexos.");
      return;
    }

    const invalid = selectedFiles.map(getLeadFileValidationError).find(Boolean);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setUploading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Sua sessao expirou. Entre novamente para anexar arquivos.");

      for (const file of selectedFiles) {
        const uniqueName = `${crypto.randomUUID()}-${createLeadFileStorageName(file.name)}`;
        const storagePath = `${authData.user.id}/${leadId}/${uniqueName}`;
        const { error: uploadError } = await supabase.storage.from(storageBucket).upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (uploadError) throw uploadError;

        const { error: metadataError } = await supabase.from("lead_files").insert({
          lead_id: leadId,
          user_id: authData.user.id,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          category,
        });

        if (metadataError) {
          await supabase.storage.from(storageBucket).remove([storagePath]);
          throw metadataError;
        }
      }

      toast.success(selectedFiles.length === 1 ? "Anexo enviado com seguranca." : `${selectedFiles.length} anexos enviados com seguranca.`);
      await loadFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o anexo.");
    } finally {
      setUploading(false);
    }
  }

  async function openFile(file: LeadFile) {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(file.storage_path, 120);
    if (error || !data?.signedUrl) {
      toast.error("Nao foi possivel abrir este anexo privado.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeFile(file: LeadFile) {
    if (!supabase) return;
    const confirmed = window.confirm(`Excluir o anexo "${file.file_name}"? Esta acao nao pode ser desfeita.`);
    if (!confirmed) return;

    setRemovingId(file.id);
    try {
      const { error: metadataError } = await supabase.from("lead_files").delete().eq("id", file.id);
      if (metadataError) throw metadataError;
      const { error: storageError } = await supabase.storage.from(storageBucket).remove([file.storage_path]);
      if (storageError) throw storageError;
      setFiles((current) => current.filter((item) => item.id !== file.id));
      toast.success("Anexo excluido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel excluir o anexo.");
      await loadFiles();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-5 text-accent" />
          Arquivos do lead
        </CardTitle>
        <CardDescription>Plantas, orcamentos, documentos, fotos e comprovantes ficam privados para o time responsavel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unavailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
            A base de anexos ainda nao foi aplicada. Execute a migration <code>add_partner_commissions_and_lead_files.sql</code> no Supabase.
          </div>
        ) : (
          <>
            <div className="grid gap-3 rounded-xl border bg-secondary/25 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor={`lead-file-category-${leadId}`}>Categoria do anexo</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as LeadFileCategory)} disabled={uploading}>
                  <SelectTrigger id={`lead-file-category-${leadId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadFileCategories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  ref={inputRef}
                  className="hidden"
                  id={`lead-files-${leadId}`}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={uploadSelectedFiles}
                  disabled={uploading}
                />
                <Button type="button" className="w-full sm:w-auto" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {uploading ? "Enviando..." : "Adicionar arquivos"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Aceita PDF, JPG, PNG, WEBP, DOC e DOCX. Limite de 15 MB por arquivo. Os anexos nao ficam publicos.</p>
          </>
        )}

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando anexos...</div>
        ) : files.length ? (
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><FileArchive className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.file_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{file.category} - {formatLeadFileSize(file.size_bytes)} - {formatUploadedAt(file.created_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void openFile(file)}><Download className="size-4" /> Abrir</Button>
                  <Button type="button" variant="outline" size="icon" aria-label={`Excluir ${file.file_name}`} onClick={() => void removeFile(file)} disabled={removingId === file.id}>
                    {removingId === file.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : !unavailable ? (
          <EmptyState icon={FileText} title="Nenhum anexo ainda" description="Adicione a planta, um orcamento ou fotos para concentrar o contexto comercial do lead." />
        ) : null}
      </CardContent>
    </Card>
  );
}
