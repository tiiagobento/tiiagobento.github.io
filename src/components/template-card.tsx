"use client";

import * as React from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { applyTemplate } from "@/lib/business";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatTemplateCategory } from "@/lib/constants";
import type { Lead, MessageTemplate } from "@/lib/types";

export function TemplateCard({
  template,
  lead,
  onSave,
  onDelete,
}: {
  template: MessageTemplate;
  lead?: Lead;
  onSave?: (template: Partial<MessageTemplate> & Pick<MessageTemplate, "title" | "category" | "content">) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const renderedMessage = lead ? applyTemplate(template.content, lead) : template.content;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          {template.title}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{formatTemplateCategory(template.category)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md bg-secondary/60 p-3 text-sm">{renderedMessage}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await copyTextToClipboard(renderedMessage);
                toast.success("Mensagem copiada.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Nao foi possivel copiar a mensagem.");
              }
            }}
          >
            <Copy className="size-4" />
            Copiar
          </Button>
          {lead ? <WhatsAppButton lead={lead} message={template.content} /> : null}
          {onSave ? <EditTemplateDialog template={template} onSave={onSave} /> : null}
          {onDelete ? (
            <Button variant="ghost" size="icon" onClick={() => onDelete(template.id)} aria-label="Excluir template">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EditTemplateDialog({
  template,
  onSave,
}: {
  template: MessageTemplate;
  onSave: (template: Partial<MessageTemplate> & Pick<MessageTemplate, "title" | "category" | "content">) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(template.title);
  const [category, setCategory] = React.useState(template.category);
  const [content, setContent] = React.useState(template.content);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Editar template">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar template</DialogTitle>
          <DialogDescription>Atualize o texto usado nos atendimentos por WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Titulo">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Categoria">
            <Input value={category} onChange={(event) => setCategory(event.target.value)} />
          </Field>
          <Field label="Mensagem">
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-40" />
          </Field>
          <Button
            onClick={async () => {
              await onSave({ ...template, title, category, content });
              setOpen(false);
            }}
          >
            Salvar alteracoes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
