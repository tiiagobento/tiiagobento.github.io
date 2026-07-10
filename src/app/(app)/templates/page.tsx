"use client";

import * as React from "react";
import { Copy, Edit, MessageCircle, MessageSquarePlus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useCrmData } from "@/hooks/use-crm-data";
import { applyTemplate, buildWhatsAppUrl, isValidWhatsAppPhone } from "@/lib/business";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatTemplateCategory, templateCategories, templateVariables } from "@/lib/constants";
import { getTemplatesWithDefaults, isDefaultMessageTemplate } from "@/lib/default-message-templates";
import { cn } from "@/lib/utils";
import type { Lead, MessageTemplate } from "@/lib/types";

type TemplateDraft = {
  id?: string;
  title: string;
  category: string;
  content: string;
  created_at?: string;
};

const emptyDraft: TemplateDraft = {
  title: "",
  category: templateCategories[0],
  content: "",
};

export default function TemplatesPage() {
  const { templates, leads, loading, saveTemplate, deleteTemplate } = useCrmData();
  const [draft, setDraft] = React.useState<TemplateDraft>(emptyDraft);
  const [categoryFilter, setCategoryFilter] = React.useState("Todas");
  const [query, setQuery] = React.useState("");
  const [previewLeadId, setPreviewLeadId] = React.useState(leads[0]?.id ?? "none");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (previewLeadId === "none" && leads[0]) setPreviewLeadId(leads[0].id);
  }, [leads, previewLeadId]);

  if (loading) return <LoadingSkeleton />;

  const previewLead = leads.find((lead) => lead.id === previewLeadId);
  const availableTemplates = getTemplatesWithDefaults(templates);
  const filteredTemplates = availableTemplates.filter((template) => {
    const matchesCategory = categoryFilter === "Todas" || template.category === categoryFilter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || `${template.title} ${template.category} ${template.content}`.toLowerCase().includes(term);
    return matchesCategory && matchesQuery;
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      toast.error("Informe o titulo do template.");
      return;
    }
    if (!draft.content.trim()) {
      toast.error("Informe a mensagem do template.");
      return;
    }

    setSaving(true);
    try {
      await saveTemplate(draft.id ? { ...draft, title: draft.title.trim(), content: draft.content.trim() } : { title: draft.title.trim(), category: draft.category, content: draft.content.trim() });
      setDraft(emptyDraft);
    } finally {
      setSaving(false);
    }
  }

  function editTemplate(template: MessageTemplate) {
    setDraft({
      id: template.id,
      title: template.title,
      category: template.category,
      content: template.content,
      created_at: template.created_at,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function insertVariable(variable: string) {
    setDraft((current) => ({ ...current, content: `${current.content}${current.content.endsWith(" ") || !current.content ? "" : " "}${variable}` }));
  }

  return (
    <div className="space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent">
            <MessageSquarePlus className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Templates de WhatsApp</h1>
            <p className="mt-1 max-w-3xl text-sm text-white/72">
              Crie mensagens padronizadas com variaveis, copie o texto pronto ou abra o WhatsApp do lead com a mensagem preenchida.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <TemplateForm draft={draft} saving={saving} onChange={setDraft} onSubmit={submit} onCancel={() => setDraft(emptyDraft)} onInsertVariable={insertVariable} />
          <VariablesCard />
        </div>

        <div className="space-y-4">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-base">Filtros e preview</CardTitle>
              <CardDescription>Selecione um lead para visualizar as variaveis preenchidas.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_240px]">
              <div className="flex items-center rounded-xl border bg-card px-3 shadow-xs transition focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15">
                <Search className="mr-2 size-4 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar template..." className="border-0 bg-transparent px-0 focus-visible:ring-0" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas as categorias</SelectItem>
                  {templateCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {formatTemplateCategory(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={previewLeadId} onValueChange={setPreviewLeadId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem lead para preview</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {filteredTemplates.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  lead={previewLead}
                  onEdit={editTemplate}
                  onDelete={deleteTemplate}
                  onCopyDefault={(item) => saveTemplate({ title: item.title, category: item.category, content: item.content })}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={MessageSquarePlus} title="Nenhum template encontrado" description="Crie um template ou ajuste os filtros para ver mensagens cadastradas." />
          )}
        </div>
      </section>
    </div>
  );
}

function TemplateForm({
  draft,
  saving,
  onChange,
  onSubmit,
  onCancel,
  onInsertVariable,
}: {
  draft: TemplateDraft;
  saving: boolean;
  onChange: (draft: TemplateDraft) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onInsertVariable: (variable: string) => void;
}) {
  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-accent" />
          {draft.id ? "Editar template" : "Novo template"}
        </CardTitle>
        <CardDescription>Use variaveis para personalizar a mensagem por lead.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Titulo">
            <Input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder="Ex: Primeiro contato site" />
          </Field>
          <Field label="Categoria">
            <Select value={draft.category} onValueChange={(category) => onChange({ ...draft, category })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templateCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {formatTemplateCategory(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mensagem">
            <Textarea value={draft.content} onChange={(event) => onChange({ ...draft, content: event.target.value })} className="min-h-44" placeholder="Ola, {nome}! Aqui e {responsavel} da Nova Forma..." />
          </Field>
          <div className="flex flex-wrap gap-2">
            {templateVariables.map((variable) => (
              <button key={variable} type="button" onClick={() => onInsertVariable(variable)} className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium transition hover:-translate-y-0.5 hover:bg-secondary/70 hover:shadow-sm">
                {variable}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {draft.id ? (
              <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
                <X className="size-4" />
                Cancelar edicao
              </Button>
            ) : null}
            <Button className="w-full" disabled={saving}>
              {saving ? "Salvando..." : draft.id ? "Salvar alteracoes" : "Salvar template"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TemplateCard({
  template,
  lead,
  onEdit,
  onDelete,
  onCopyDefault,
}: {
  template: MessageTemplate;
  lead?: Lead;
  onEdit: (template: MessageTemplate) => void;
  onDelete: (id: string) => Promise<void>;
  onCopyDefault: (template: MessageTemplate) => Promise<void>;
}) {
  const renderedMessage = lead ? applyTemplate(template.content, lead) : template.content;
  const whatsappUrl = lead ? buildWhatsAppUrl(lead.phone, renderedMessage) : "";
  const isDefault = isDefaultMessageTemplate(template);
  const [copyingDefault, setCopyingDefault] = React.useState(false);

  async function copyMessage() {
    try {
      await copyTextToClipboard(renderedMessage);
      toast.success("Mensagem copiada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel copiar a mensagem.");
    }
  }

  function openWhatsApp() {
    if (!lead) {
      toast.error("Selecione um lead para abrir o WhatsApp.");
      return;
    }
    if (!isValidWhatsAppPhone(lead.phone) || !whatsappUrl) {
      toast.error("Telefone incompleto ou invalido para abrir o WhatsApp.");
      return;
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    toast.success("WhatsApp aberto.");
  }

  return (
    <Card className="premium-hover group h-full overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base transition group-hover:text-primary">{template.title}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{formatTemplateCategory(template.category)}</Badge>
              <Badge variant={isDefault ? "outline" : "success"}>{isDefault ? "Padrao" : "Meu template"}</Badge>
            </div>
          </div>
          <div className="flex gap-1">
            {isDefault ? null : (
              <>
                <Button size="icon" variant="outline" onClick={() => onEdit(template)} aria-label="Editar template">
                  <Edit className="size-4" />
                </Button>
                <DeleteTemplateDialog template={template} onDelete={onDelete} />
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="min-h-36 whitespace-pre-line rounded-xl border bg-secondary/35 p-3 text-sm leading-6 shadow-inner shadow-slate-950/[0.03]">{renderedMessage}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={copyMessage} className="sm:flex-1">
            <Copy className="size-4" />
            Copiar mensagem
          </Button>
          <Button type="button" variant="accent" onClick={openWhatsApp} className="sm:flex-1">
            <MessageCircle className="size-4" />
            Abrir WhatsApp
          </Button>
          {isDefault ? (
            <Button
              type="button"
              variant="secondary"
              disabled={copyingDefault}
              onClick={async () => {
                setCopyingDefault(true);
                try {
                  await onCopyDefault(template);
                  toast.success("Template padrao salvo nos seus templates.");
                } finally {
                  setCopyingDefault(false);
                }
              }}
            >
              {copyingDefault ? "Salvando..." : "Salvar nos meus templates"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteTemplateDialog({ template, onDelete }: { template: MessageTemplate; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Excluir template">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir template?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acao remove permanentemente <strong>{template.title}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={async (event) => {
              event.preventDefault();
              setDeleting(true);
              try {
                await onDelete(template.id);
                setOpen(false);
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VariablesCard() {
  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <CardTitle className="text-base">Variaveis disponiveis</CardTitle>
        <CardDescription>Elas sao substituidas automaticamente no preview e no WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {templateVariables.map((variable) => (
          <span key={variable} className={cn("rounded-full border bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-xs ring-1 ring-border/40")}>
            {variable}
          </span>
        ))}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
