"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit, MessageSquare, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { interactionTypes } from "@/lib/constants";
import { interactionSchema } from "@/lib/schemas";
import type { Interaction } from "@/lib/types";

type InteractionInput = Omit<Interaction, "id" | "lead_id" | "created_at">;

export function InteractionTimeline({
  interactions,
  onUpdate,
  onDelete,
}: {
  interactions: Interaction[];
  onUpdate?: (id: string, input: InteractionInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="text-base text-primary">Historico de interacoes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {interactions.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">Nenhuma interacao registrada ainda.</p>
        ) : (
          interactions.map((item) => (
            <div key={item.id} className="relative rounded-xl border bg-card p-4 pl-7 shadow-sm">
              <div className="absolute left-3 top-4 flex size-4 items-center justify-center rounded-full bg-accent shadow-sm">
                <MessageSquare className="size-2.5 text-white" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.interaction_type}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                {item.responsible ? <span className="rounded-full border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{item.responsible}</span> : null}
              </div>
              <p className="mt-1 text-sm">{item.description}</p>
              {item.next_step ? <p className="mt-1 text-xs text-muted-foreground">Proximo: {item.next_step}</p> : null}
              {item.next_contact_at ? <p className="mt-1 text-xs text-muted-foreground">Contato agendado: {format(new Date(item.next_contact_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p> : null}
              {onUpdate || onDelete ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onUpdate ? <EditInteractionDialog interaction={item} onUpdate={onUpdate} /> : null}
                  {onDelete ? <DeleteInteractionDialog interaction={item} onDelete={onDelete} /> : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EditInteractionDialog({ interaction, onUpdate }: { interaction: Interaction; onUpdate: (id: string, input: InteractionInput) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState(interaction.interaction_type);
  const [responsible, setResponsible] = React.useState(interaction.responsible ?? "");
  const [description, setDescription] = React.useState(interaction.description);
  const [nextStep, setNextStep] = React.useState(interaction.next_step ?? "");
  const [nextContact, setNextContact] = React.useState(toDatetimeLocal(interaction.next_contact_at));
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    const input: InteractionInput = {
      interaction_type: type,
      responsible,
      description,
      next_step: nextStep,
      next_contact_at: nextContact ? new Date(nextContact).toISOString() : null,
    };
    const parsed = interactionSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os dados da interacao.");
      return;
    }

    setSaving(true);
    try {
      await onUpdate(interaction.id, parsed.data);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Edit className="size-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar interacao</DialogTitle>
          <DialogDescription>Atualize o registro do historico comercial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Tipo">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {interactionTypes.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsavel">
            <Input value={responsible} onChange={(event) => setResponsible(event.target.value)} />
          </Field>
          <Field label="Descricao">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Proximo passo">
            <Input value={nextStep} onChange={(event) => setNextStep(event.target.value)} />
          </Field>
          <Field label="Data do proximo contato">
            <Input type="datetime-local" value={nextContact} onChange={(event) => setNextContact(event.target.value)} />
          </Field>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteInteractionDialog({ interaction, onDelete }: { interaction: Interaction; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Trash2 className="size-4 text-destructive" />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir interacao?</AlertDialogTitle>
          <AlertDialogDescription>Esta acao remove este item do historico comercial do lead.</AlertDialogDescription>
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
                await onDelete(interaction.id);
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
