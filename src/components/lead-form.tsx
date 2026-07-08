"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { Building2, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadSources, leadStatuses, priorities, projectTypes } from "@/lib/constants";
import { leadSchema, type LeadFormInput, type LeadFormValues } from "@/lib/schemas";
import type { Lead } from "@/lib/types";

type LeadFormProps = {
  lead?: Lead;
  onSubmit: (values: LeadFormValues) => Promise<void>;
};

export function LeadForm({ lead, onSubmit }: LeadFormProps) {
  const form = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead?.name ?? "",
      phone: lead?.phone ?? "",
      email: lead?.email ?? "",
      first_contact_date: lead?.first_contact_date ?? new Date().toISOString().slice(0, 10),
      source: lead?.source ?? "Site",
      status: lead?.status ?? "Novo lead",
      priority: lead?.priority ?? "Media",
      city: lead?.city ?? "",
      neighborhood: lead?.neighborhood ?? "",
      approximate_address: lead?.approximate_address ?? "",
      project_type: lead?.project_type ?? "Casa em steel frame",
      interest_type: lead?.interest_type ?? "",
      approximate_area: lead?.approximate_area ?? "",
      has_land: Boolean(lead?.has_land),
      has_blueprint: Boolean(lead?.has_blueprint),
      has_previous_quote: Boolean(lead?.has_previous_quote),
      wants_visit: Boolean(lead?.wants_visit),
      has_urgency: Boolean(lead?.has_urgency),
      desired_start_time: lead?.desired_start_time ?? "",
      budget_range: lead?.budget_range ?? "",
      best_contact_time: lead?.best_contact_time ?? "",
      assigned_to: lead?.assigned_to ?? "Tiago",
      notes: lead?.notes ?? "",
      whatsapp_link: lead?.whatsapp_link ?? "",
      google_business_link: lead?.google_business_link ?? "",
      related_links: lead?.related_links ?? "",
      potential_value: lead?.potential_value ?? "",
      closing_probability: lead?.closing_probability ?? "",
      next_action_at: lead?.next_action_at ? lead.next_action_at.slice(0, 16) : "",
    },
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              <UserRound className="size-4" />
            </span>
            Dados do cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do cliente" error={errors.name?.message}>
            <Input {...form.register("name")} placeholder="Ex: Solange Enfermeira" />
          </Field>
          <Field label="Telefone/WhatsApp" error={errors.phone?.message}>
            <Input {...form.register("phone")} placeholder="+55 48 99999-9999" />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <Input {...form.register("email")} placeholder="cliente@email.com" />
          </Field>
          <Field label="Primeiro contato" error={errors.first_contact_date?.message}>
            <Input type="date" {...form.register("first_contact_date")} />
          </Field>
          <SelectField label="Origem" value={form.watch("source")} onChange={(v) => form.setValue("source", v as LeadFormValues["source"], { shouldValidate: true })} options={leadSources} />
          <SelectField label="Status" value={form.watch("status")} onChange={(v) => form.setValue("status", v as LeadFormValues["status"], { shouldValidate: true })} options={leadStatuses} />
          <SelectField label="Prioridade" value={form.watch("priority")} onChange={(v) => form.setValue("priority", v as LeadFormValues["priority"], { shouldValidate: true })} options={priorities} />
          <Field label="Responsavel">
            <Input {...form.register("assigned_to")} placeholder="Tiago" />
          </Field>
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              <Building2 className="size-4" />
            </span>
            Dados da obra
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Cidade">
            <Input {...form.register("city")} placeholder="Florianopolis, Sao Jose, Biguacu..." />
          </Field>
          <Field label="Bairro">
            <Input {...form.register("neighborhood")} placeholder="Deltaville, Pedra Branca..." />
          </Field>
          <Field label="Endereco aproximado">
            <Input {...form.register("approximate_address")} />
          </Field>
          <SelectField label="Tipo de obra" value={String(form.watch("project_type") || "Casa em steel frame")} onChange={(v) => form.setValue("project_type", v as LeadFormValues["project_type"], { shouldValidate: true })} options={projectTypes} />
          <Field label="Tipo de interesse">
            <Input {...form.register("interest_type")} placeholder="Chave na mao, mao de obra, assessoria..." />
          </Field>
          <Field label="Metragem aproximada">
            <Input type="number" {...form.register("approximate_area")} />
          </Field>
          <Field label="Prazo para iniciar">
            <Input {...form.register("desired_start_time")} placeholder="Agora, 30 dias, fim do ano..." />
          </Field>
          <Field label="Faixa de orcamento">
            <Input {...form.register("budget_range")} placeholder="Ex: R$ 400k a R$ 600k" />
          </Field>
          <CheckField label="Tem terreno?" name="has_land" form={form} />
          <CheckField label="Tem planta/projeto?" name="has_blueprint" form={form} />
          <CheckField label="Tem orcamento anterior?" name="has_previous_quote" form={form} />
          <CheckField label="Quer visita?" name="wants_visit" form={form} />
          <CheckField label="Demonstrou urgencia?" name="has_urgency" form={form} />
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              <Save className="size-4" />
            </span>
            Comercial e observacoes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Valor potencial da obra">
            <Input type="number" {...form.register("potential_value")} placeholder="650000" />
          </Field>
          <Field label="Chance de fechamento (%)">
            <Input type="number" min={0} max={100} {...form.register("closing_probability")} />
          </Field>
          <Field label="Melhor horario de contato">
            <Input {...form.register("best_contact_time")} placeholder="Manha, tarde..." />
          </Field>
          <Field label="Proxima acao">
            <Input type="datetime-local" {...form.register("next_action_at")} />
          </Field>
          <Field label="Link WhatsApp">
            <Input {...form.register("whatsapp_link")} />
          </Field>
          <Field label="Link Google Meu Negocio">
            <Input {...form.register("google_business_link")} />
          </Field>
          <Field label="Arquivos ou links relacionados">
            <Input {...form.register("related_links")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Observacoes internas">
              <Textarea {...form.register("notes")} placeholder="Historico, contexto, combinados e riscos..." />
            </Field>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
          <Save className="size-4" />
          {form.formState.isSubmitting ? "Salvando..." : "Salvar lead"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type BooleanLeadField = "has_land" | "has_blueprint" | "has_previous_quote" | "wants_visit" | "has_urgency";

function CheckField({ label, name, form }: { label: string; name: BooleanLeadField; form: UseFormReturn<LeadFormInput, unknown, LeadFormValues> }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm shadow-xs transition hover:border-primary/30 hover:bg-secondary/35">
      <input type="checkbox" checked={Boolean(form.watch(name))} onChange={(event) => form.setValue(name, event.target.checked)} />
      {label}
    </label>
  );
}
