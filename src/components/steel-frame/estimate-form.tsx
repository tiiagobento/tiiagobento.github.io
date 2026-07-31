"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ClipboardCheck, FileText, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrmData } from "@/hooks/use-crm-data";
import { createSteelFrameEstimate } from "@/lib/steel-frame/data";
import {
  steelFrameEstimateDraftSchema,
  type SteelFrameEstimateDraftFormInput,
  type SteelFrameEstimateDraftInput,
} from "@/lib/steel-frame/schemas";

type EstimateFormProps = {
  initialLeadId?: string | null;
};

export function EstimateForm({ initialLeadId = null }: EstimateFormProps) {
  const router = useRouter();
  const { leads, loading: leadsLoading } = useCrmData();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SteelFrameEstimateDraftFormInput, unknown, SteelFrameEstimateDraftInput>({
    resolver: zodResolver(steelFrameEstimateDraftSchema),
    defaultValues: {
      title: "",
      mode: "commercial",
      leadId: initialLeadId,
      city: "",
      neighborhood: "",
      approximateAddress: "",
      projectType: "Casa em steel frame",
      standardWallHeightMeters: null,
      expectedFloors: 1,
      accessDifficulty: "medium",
      requiresMaterialLift: null,
      notes: "",
    },
  });

  const errors = form.formState.errors;

  function selectLead(leadId: string) {
    const lead = leads.find((item) => item.id === leadId);
    form.setValue("leadId", leadId, { shouldValidate: true });
    if (!lead) return;

    if (!form.getValues("title")) form.setValue("title", `Orcamento - ${lead.name}`);
    if (!form.getValues("city")) form.setValue("city", lead.city ?? "");
    if (!form.getValues("neighborhood")) form.setValue("neighborhood", lead.neighborhood ?? "");
    if (!form.getValues("approximateAddress")) form.setValue("approximateAddress", lead.approximate_address ?? "");
    if (!form.getValues("projectType")) form.setValue("projectType", lead.project_type ?? "Casa em steel frame");
  }

  async function submit(values: SteelFrameEstimateDraftInput) {
    setSubmitError(null);
    try {
      const estimate = await createSteelFrameEstimate(values);
      toast.success("Rascunho de orcamento criado.");
      router.push(`/estimates/${estimate.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel criar o orcamento.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              <FileText className="size-4" />
            </span>
            Contexto comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Titulo do orcamento" error={errors.title?.message} className="md:col-span-2">
            <Input {...form.register("title")} placeholder="Ex: Residencia terrea - Biguacu" autoFocus />
          </Field>
          <Field label="Lead vinculado" error={errors.leadId?.message}>
            <Select
              value={form.watch("leadId") ?? "unlinked"}
              onValueChange={(value) => {
                if (value === "unlinked") {
                  form.setValue("leadId", null, { shouldValidate: true });
                  return;
                }

                selectLead(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={leadsLoading ? "Carregando leads..." : "Selecionar lead"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlinked">Sem lead vinculado</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name} {lead.city ? `- ${lead.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Modo de trabalho" error={errors.mode?.message}>
            <Select value={form.watch("mode")} onValueChange={(value) => form.setValue("mode", value as "commercial" | "technical", { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="commercial">Comercial</SelectItem>
                <SelectItem value="technical">Tecnico</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de obra" error={errors.projectType?.message}>
            <Input {...form.register("projectType")} placeholder="Casa terrea, sobrado, ampliacao..." />
          </Field>
          <Field label="Pavimentos" error={errors.expectedFloors?.message}>
            <Input type="number" min={1} max={10} {...form.register("expectedFloors", { valueAsNumber: true })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Observacoes comerciais">
              <Textarea {...form.register("notes")} placeholder="Escopo combinado, restricoes, duvidas e premissas que ja foram confirmadas." />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              <Building2 className="size-4" />
            </span>
            Dados iniciais da obra
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Cidade">
            <Input {...form.register("city")} placeholder="Ex: Biguacu" />
          </Field>
          <Field label="Bairro">
            <Input {...form.register("neighborhood")} placeholder="Ex: Deltaville" />
          </Field>
          <Field label="Endereco aproximado" className="md:col-span-2">
            <Input {...form.register("approximateAddress")} placeholder="Nao e obrigatorio nesta etapa" />
          </Field>
          <Field label="Altura padrao das paredes (m)" error={errors.standardWallHeightMeters?.message}>
            <Input type="number" step="0.01" min={0.01} {...form.register("standardWallHeightMeters", { valueAsNumber: true })} placeholder="A confirmar" />
          </Field>
          <Field label="Dificuldade de acesso" error={errors.accessDifficulty?.message}>
            <Select value={form.watch("accessDifficulty") ?? "unconfirmed"} onValueChange={(value) => form.setValue("accessDifficulty", value === "unconfirmed" ? null : value as "low" | "medium" | "high", { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unconfirmed">A confirmar</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm shadow-xs transition hover:border-primary/30 hover:bg-secondary/35 md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.watch("requiresMaterialLift"))}
              onChange={(event) => form.setValue("requiresMaterialLift", event.target.checked, { shouldValidate: true })}
            />
            Pode exigir elevacao mecanica de materiais
          </label>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/[0.04]">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>Medidas, materiais, custos e valores extraidos por IA permanecem em revisao. Nenhuma regra tecnica ou valor de venda e inventado nesta etapa.</p>
        </CardContent>
      </Card>

      {submitError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{submitError}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
          <Save className="size-4" />
          {form.formState.isSubmitting ? "Criando..." : "Criar rascunho"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
