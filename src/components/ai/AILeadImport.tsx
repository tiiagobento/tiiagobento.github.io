"use client";

import * as React from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardCheck, ClipboardCopy, ImageIcon, Loader2, RotateCcw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrmData } from "@/hooks/use-crm-data";
import { isValidWhatsAppPhone, sanitizePhone } from "@/lib/business";
import { analyzeLeadWithPuter, ensurePuterAuthorizedFromUserAction, fileToDataUrl, isPuterReady } from "@/lib/ai/puter-client";
import { copyTextToClipboard } from "@/lib/clipboard";
import { leadSources, leadStatuses, priorities, projectTypes } from "@/lib/constants";
import type { LeadFormValues } from "@/lib/schemas";
import type { AIExtractedLead, AILeadAnalysisResult } from "@/lib/validations/ai-lead-draft";

const MAX_IMAGES = 10;
const MAX_TEXT_LENGTH = 20_000;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const IMAGE_FIELD_GUIDES = [
  "Topo do print/cartao do contato: telefone e nome.",
  "Baloes brancos do cliente: cidade, bairro, obra, terreno, planta e urgencia.",
  "Baloes verdes da Nova Forma: contexto e proximo passo, nao dados do cliente.",
  "Anexos e plantas no print: projeto, croqui, referencia e pontos tecnicos.",
];

const FIELD_HELP: Record<string, string> = {
  Nome: "Procure no topo da conversa, cartao do contato ou frase 'me chamo...'.",
  Telefone: "Use o numero visivel no topo ou no cartao. Preserve DDI internacional como +34; nao complete se estiver cortado.",
  Cidade: "Pegue apenas cidade dita pelo cliente ou visivel na conversa.",
  Bairro: "Pegue bairro, condominio ou loteamento citado pelo cliente.",
  Origem: "Use a origem escolhida, salvo quando o print indicar outro canal claramente.",
  Status: "Revise se a conversa ja evoluiu para visita, orcamento ou sem resposta.",
  Prioridade: "Alta so quando houver terreno, planta, urgencia, visita ou orcamento claro.",
  "Tipo de obra": "Identifique casa, sobrado, quitinete, ampliacao, comercial ou similar.",
  "Tipo de interesse": "Orcamento, visita, chave na mao, mao de obra, preco por m2 ou projeto.",
  Urgencia: "Prazo citado: imediato, este mes, fim do ano ou antes de concluir projeto.",
  "Tem terreno?": "Sim apenas se o cliente disser que tem terreno/lote/local.",
  "Tem planta?": "Sim se enviou planta/croqui/projeto ou disse que possui projeto.",
  "Proximo passo": "A proxima acao comercial: pedir dados, agendar visita ou solicitar planta.",
  Observacoes: "Resumo factual do pedido e pontos tecnicos; evite suposicoes.",
};

type UploadedImage = {
  name: string;
  dataUrl: string;
};

type EditableAILead = AIExtractedLead & {
  localId: string;
  saving?: boolean;
  savedLeadId?: string;
};

export function AILeadImport() {
  const router = useRouter();
  const { saveLead } = useCrmData();
  const [scriptLoaded, setScriptLoaded] = React.useState(false);
  const [conversation, setConversation] = React.useState("");
  const [source, setSource] = React.useState<LeadFormValues["source"]>("WhatsApp");
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [analysis, setAnalysis] = React.useState<AILeadAnalysisResult | null>(null);
  const [leads, setLeads] = React.useState<EditableAILead[]>([]);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isSavingAll, setIsSavingAll] = React.useState(false);

  React.useEffect(() => {
    if (isPuterReady()) setScriptLoaded(true);
  }, []);

  const hasInput = conversation.trim().length > 0 || images.length > 0;

  async function analyzeConversation() {
    const trimmedConversation = conversation.trim();
    setAnalysisError(null);

    if (!hasInput) {
      const message = "Envie uma imagem ou cole um texto antes de analisar.";
      setAnalysisError(message);
      toast.error(message);
      return;
    }

    if (trimmedConversation.length > MAX_TEXT_LENGTH) {
      const message = "O texto ultrapassa 20.000 caracteres. Reduza a conversa antes de analisar.";
      setAnalysisError(message);
      toast.error(message);
      return;
    }

    setIsAnalyzing(true);
    try {
      await ensurePuterAuthorizedFromUserAction();
      const result = await analyzeLeadWithPuter({
        conversation: trimmedConversation,
        source,
        images: images.map((image) => image.dataUrl),
      });
      setAnalysis(result);
      setLeads(result.leads.map((lead, index) => ({ ...normalizeExtractedLead(lead, source), localId: `${Date.now()}-${index}` })));
      toast.success("Analise concluida. Revise os leads antes de salvar.");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Nao foi possivel analisar essa imagem.";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleImagesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selected.length === 0) return;

    if (images.length + selected.length > MAX_IMAGES) {
      toast.error("Envie no maximo 10 imagens.");
      return;
    }

    const invalid = selected.filter((file) => !ACCEPTED_IMAGE_TYPES.has(file.type));
    if (invalid.length > 0) {
      toast.error("Envie apenas imagens PNG, JPG, JPEG ou WEBP.");
      return;
    }

    try {
      const converted = await Promise.all(selected.map(async (file) => ({ name: file.name, dataUrl: await fileToDataUrl(file) })));
      setImages((current) => [...current, ...converted]);
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel carregar a imagem.");
    }
  }

  function updateLead(localId: string, input: Partial<EditableAILead>) {
    setLeads((current) => current.map((lead) => (lead.localId === localId ? { ...lead, ...input } : lead)));
  }

  function removeImage(name: string) {
    setImages((current) => current.filter((image) => image.name !== name));
  }

  function clearAll() {
    setConversation("");
    setImages([]);
    setAnalysis(null);
    setLeads([]);
    setAnalysisError(null);
  }

  async function saveOneLead(lead: EditableAILead) {
    if (!lead.name.trim()) {
      toast.error("Revise o nome antes de salvar o lead.");
      return null;
    }

    if (!isValidWhatsAppPhone(lead.phone)) {
      toast.error("Telefone incompleto ou invalido para salvar o lead.");
      return null;
    }

    updateLead(lead.localId, { saving: true });
    try {
      const saved = await saveLead(mapAILeadToLeadPayload(lead));
      updateLead(lead.localId, { saving: false, savedLeadId: saved.id });
      toast.success(`Lead ${lead.name} salvo.`);
      return saved.id;
    } catch (error) {
      console.error(error);
      updateLead(lead.localId, { saving: false });
      toast.error("Nao foi possivel salvar esse lead.");
      return null;
    }
  }

  async function saveAllLeads() {
    setIsSavingAll(true);
    try {
      const unsaved = leads.filter((lead) => !lead.savedLeadId);
      for (const lead of unsaved) {
        await saveOneLead(lead);
      }
    } finally {
      setIsSavingAll(false);
    }
  }

  async function copySummary() {
    const text = [analysis?.summary, ...(analysis?.warnings ?? []).map((warning) => `Aviso: ${warning}`)].filter(Boolean).join("\n");
    if (!text) {
      toast.info("Nao ha resumo para copiar.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success("Resumo copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel copiar o resumo.");
    }
  }

  return (
    <div className="space-y-5">
      <Script
        src="https://js.puter.com/v2/"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => {
          const message = "Nao consegui carregar a IA. Verifique sua conexao e tente novamente.";
          setAnalysisError(message);
          toast.error(message);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            Analisar conversas com IA
          </CardTitle>
          <CardDescription>Cole texto ou envie prints. A IA gera rascunhos, mas nada e salvo sem revisao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Revise os dados antes de salvar. A IA pode interpretar alguma informacao de forma errada.
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              "Cole uma conversa ou envie um print",
              "A IA vai sugerir dados do lead",
              "Revise antes de salvar",
              "A IA pode errar, confirme as informações importantes",
            ].map((item) => (
              <div key={item} className="flex min-h-24 items-start gap-3 rounded-xl border bg-secondary/35 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <ClipboardCheck className="size-4" />
                </div>
                <p className="text-sm font-medium leading-5 text-foreground">{item}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={scriptLoaded || isPuterReady() ? "success" : "secondary"}>{scriptLoaded || isPuterReady() ? "IA carregada" : "Carregando IA"}</Badge>
            <Badge variant="outline">{images.length}/{MAX_IMAGES} imagens</Badge>
            <Badge variant="outline">{conversation.length.toLocaleString("pt-BR")}/{MAX_TEXT_LENGTH.toLocaleString("pt-BR")} caracteres</Badge>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Como a IA vai ler o print</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {IMAGE_FIELD_GUIDES.map((guide) => (
                <div key={guide} className="rounded-lg bg-secondary/45 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {guide}
                </div>
              ))}
            </div>
          </div>

          <Field label="Origem do lead">
            <Select value={source} onValueChange={(value) => setSource(value as LeadFormValues["source"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadSources.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Texto da conversa">
            <Textarea
              value={conversation}
              onChange={(event) => setConversation(event.target.value.slice(0, MAX_TEXT_LENGTH))}
              placeholder="Cole aqui a conversa do WhatsApp, Google Meu Negocio, site ou outro canal..."
              className="min-h-48"
            />
          </Field>

          <Field label="Prints ou imagens">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>PNG, JPG, JPEG ou WEBP. Maximo de 10 imagens.</p>
                  <p>As imagens sao usadas apenas na analise e nao sao salvas no banco.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-secondary">
                  <Upload className="size-4" />
                  Selecionar imagens
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple onChange={handleImagesChange} />
                </label>
              </div>

              {images.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {images.map((image) => (
                    <div key={image.name} className="overflow-hidden rounded-xl border bg-background">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.dataUrl} alt={`Preview ${image.name}`} className="h-40 w-full object-cover" />
                      <div className="flex items-center justify-between gap-2 p-2">
                        <span className="truncate text-xs text-muted-foreground">{image.name}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeImage(image.name)} aria-label="Remover imagem">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed bg-secondary/35 p-4 text-sm text-muted-foreground">
                  <ImageIcon className="size-4" />
                  Nenhuma imagem selecionada.
                </div>
              )}
            </div>
          </Field>

          {analysisError ? (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{analysisError}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={analyzeConversation} disabled={isAnalyzing}>
              {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {isAnalyzing ? "Analisando com IA..." : "Analisar com IA"}
            </Button>
            {analysisError ? (
              <Button type="button" variant="outline" onClick={analyzeConversation} disabled={isAnalyzing || !hasInput}>
                <RotateCcw className="size-4" />
                Tentar novamente
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={clearAll}>
              <Trash2 className="size-4" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da IA</CardTitle>
            <CardDescription>Revise cada campo antes de salvar no Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryBlock title="Resumo" text={analysis.summary || "A IA nao retornou resumo."} />
            <ListBlock title="Avisos" items={analysis.warnings} empty="Nenhum aviso retornado." />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={copySummary}>
                <ClipboardCopy className="size-4" />
                Copiar resumo
              </Button>
              <Button type="button" onClick={saveAllLeads} disabled={isSavingAll || leads.length === 0}>
                {isSavingAll ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar todos os leads
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {leads.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {leads.map((lead, index) => (
            <LeadDraftCard key={lead.localId} lead={lead} index={index} onChange={(input) => updateLead(lead.localId, input)} onSave={() => saveOneLead(lead)} />
          ))}
        </div>
      ) : analysis ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">A IA nao encontrou leads estruturados nessa conversa ou imagem.</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LeadDraftCard({
  lead,
  index,
  onChange,
  onSave,
}: {
  lead: EditableAILead;
  index: number;
  onChange: (input: Partial<EditableAILead>) => void;
  onSave: () => Promise<unknown>;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Lead extraido #{index + 1}</CardTitle>
            <CardDescription>{lead.savedLeadId ? "Salvo no Supabase." : "Rascunho editavel."}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={lead.priority === "Alta" ? "danger" : lead.priority === "Baixa" ? "outline" : "warning"}>{lead.priority || "Media"}</Badge>
            <Badge variant="secondary">{lead.status || "Novo lead"}</Badge>
            <Badge variant={lead.lead_score >= 70 ? "success" : "outline"}>Score {lead.lead_score || 0}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <EditableField label="Nome" value={lead.name} onChange={(value) => onChange({ name: value })} />
          <EditableField label="Telefone" value={lead.phone} onChange={(value) => onChange({ phone: value })} />
          <EditableField label="Cidade" value={lead.city} onChange={(value) => onChange({ city: value })} />
          <EditableField label="Bairro" value={lead.neighborhood} onChange={(value) => onChange({ neighborhood: value })} />
          <SelectField label="Origem" value={normalizeSourceValue(lead.source)} options={leadSources} onChange={(value) => onChange({ source: value })} />
          <SelectField label="Status" value={normalizeStatusValue(lead.status)} options={leadStatuses} onChange={(value) => onChange({ status: value })} />
          <SelectField label="Prioridade" value={normalizePriorityValue(lead.priority)} options={priorities} onChange={(value) => onChange({ priority: value })} />
          <SelectField label="Tipo de obra" value={normalizeProjectTypeValue(lead.project_type) || "__empty"} options={projectTypes} emptyLabel="A confirmar" onChange={(value) => onChange({ project_type: value === "__empty" ? "" : value })} />
          <EditableField label="Tipo de interesse" value={lead.interest_type} onChange={(value) => onChange({ interest_type: value })} />
          <EditableField label="Urgencia" value={lead.urgency} onChange={(value) => onChange({ urgency: value })} />
          <NullableBooleanField label="Tem terreno?" value={lead.has_land} onChange={(value) => onChange({ has_land: value })} />
          <NullableBooleanField label="Tem planta?" value={lead.has_blueprint} onChange={(value) => onChange({ has_blueprint: value })} />
        </div>
        <Field label="Proximo passo">
          <Input value={lead.next_step} onChange={(event) => onChange({ next_step: event.target.value })} />
        </Field>
        <Field label="Observacoes">
          <Textarea value={lead.notes} onChange={(event) => onChange({ notes: event.target.value })} className="min-h-28" />
        </Field>
        <div className="flex justify-end">
          <Button type="button" onClick={onSave} disabled={lead.saving || Boolean(lead.savedLeadId)}>
            {lead.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {lead.savedLeadId ? "Lead salvo" : "Salvar lead"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeExtractedLead(lead: AIExtractedLead, fallbackSource: LeadFormValues["source"]): AIExtractedLead {
  return {
    ...lead,
    phone: lead.phone ? sanitizePhone(lead.phone) : "",
    source: normalizeSourceValue(lead.source || fallbackSource),
    status: normalizeStatusValue(lead.status),
    priority: normalizePriorityValue(lead.priority),
    project_type: normalizeProjectTypeValue(lead.project_type),
  };
}

function mapAILeadToLeadPayload(lead: EditableAILead): LeadFormValues {
  return {
    name: lead.name.trim(),
    phone: sanitizePhone(lead.phone),
    email: undefined,
    first_contact_date: new Date().toISOString().slice(0, 10),
    source: normalizeSourceValue(lead.source),
    status: normalizeStatusValue(lead.status),
    priority: normalizePriorityValue(lead.priority),
    city: emptyToUndefined(lead.city),
    neighborhood: emptyToUndefined(lead.neighborhood),
    approximate_address: undefined,
    project_type: emptyToUndefined(normalizeProjectTypeValue(lead.project_type)) as LeadFormValues["project_type"],
    interest_type: emptyToUndefined(lead.interest_type),
    approximate_area: undefined,
    has_land: lead.has_land ?? undefined,
    has_blueprint: lead.has_blueprint ?? undefined,
    has_previous_quote: undefined,
    wants_visit: /visita/i.test(`${lead.next_step} ${lead.notes}`),
    has_urgency: /urgente|rapido|imediato|quanto antes/i.test(lead.urgency),
    desired_start_time: emptyToUndefined(lead.urgency),
    budget_range: undefined,
    best_contact_time: undefined,
    assigned_to: "Tiago",
    notes: emptyToUndefined([lead.notes, lead.next_step ? `Proximo passo sugerido: ${lead.next_step}` : null].filter(Boolean).join("\n\n")),
    whatsapp_link: undefined,
    google_business_link: undefined,
    related_links: undefined,
    potential_value: undefined,
    closing_probability: undefined,
    next_action_at: undefined,
  };
}

function normalizeSourceValue(value: string): LeadFormValues["source"] {
  return normalizeOption(value, leadSources, "Outro");
}

function normalizeStatusValue(value: string): LeadFormValues["status"] {
  return normalizeOption(value, leadStatuses, "Novo lead");
}

function normalizePriorityValue(value: string): LeadFormValues["priority"] {
  return normalizeOption(value, priorities, "Media");
}

function normalizeProjectTypeValue(value: string): string {
  if (!value) return "";
  return normalizeOption(value, projectTypes, "");
}

function normalizeOption<T extends string>(value: string, options: readonly T[], fallback: T): T {
  const normalized = normalizeText(value);
  return options.find((option) => normalizeText(option) === normalized) ?? fallback;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {(hint ?? FIELD_HELP[label]) ? <p className="text-xs leading-5 text-muted-foreground">{hint ?? FIELD_HELP[label]}</p> : null}
    </div>
  );
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  emptyLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="A confirmar" />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel ? <SelectItem value="__empty">{emptyLabel}</SelectItem> : null}
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

function NullableBooleanField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return (
    <Field label={label}>
      <Select value={value === null ? "unknown" : value ? "yes" : "no"} onValueChange={(next) => onChange(next === "unknown" ? null : next === "yes")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unknown">Nao sei</SelectItem>
          <SelectItem value="yes">Sim</SelectItem>
          <SelectItem value="no">Nao</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SummaryBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
