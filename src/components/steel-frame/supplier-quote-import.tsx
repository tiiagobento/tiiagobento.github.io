"use client";

import Link from "next/link";
import * as React from "react";
import {
  BookOpenText,
  ClipboardCheck,
  FileSearch,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { useNavigationAccess } from "@/components/app-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSupabaseSteelFrameCatalogRepository,
  steelFrameSupplierQuoteAnalysisSchema,
  steelFrameSupplierQuoteDraftSchema,
  type SteelFrameCatalogTechnicalSource,
  type SteelFrameSupplierQuoteAnalysis,
  type SteelFrameSupplierQuoteRecord,
} from "@/lib/steel-frame/catalog";
import { getSteelFrameErrorMessage } from "@/lib/steel-frame/data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ReviewItem = {
  id: string;
  sourceLineNumber: string;
  externalCode: string;
  description: string;
  ncm: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
};

type QuoteForm = {
  supplierName: string;
  supplierTaxId: string;
  supplierContactName: string;
  supplierContactPhone: string;
  supplierContactEmail: string;
  quoteNumber: string;
  issuedOn: string;
  validUntil: string;
  expectedBillingOn: string;
  paymentTerms: string;
  subtotal: string;
  discount: string;
  freight: string;
  taxes: string;
  total: string;
  notes: string;
};

const emptyForm: QuoteForm = {
  supplierName: "",
  supplierTaxId: "",
  supplierContactName: "",
  supplierContactPhone: "",
  supplierContactEmail: "",
  quoteNumber: "",
  issuedOn: "",
  validUntil: "",
  expectedBillingOn: "",
  paymentTerms: "",
  subtotal: "",
  discount: "",
  freight: "",
  taxes: "",
  total: "",
  notes: "",
};

function textOrEmpty(value: string | null) {
  return value ?? "";
}

function decimalOrEmpty(value: number | null) {
  return value === null ? "" : String(value);
}

function parseDecimal(value: string) {
  const normalized = value
    .trim()
    .replace(/R\$|\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function makeReviewItem(index: number, item?: SteelFrameSupplierQuoteAnalysis["items"][number]): ReviewItem {
  return {
    id: `quote-item-${crypto.randomUUID()}`,
    sourceLineNumber: String(item?.source_line_number ?? index + 1),
    externalCode: textOrEmpty(item?.external_code ?? null),
    description: item?.description ?? "",
    ncm: textOrEmpty(item?.ncm ?? null),
    quantity: decimalOrEmpty(item?.quantity ?? null),
    unit: textOrEmpty(item?.unit ?? null),
    unitPrice: decimalOrEmpty(item?.unit_price ?? null),
    lineTotal: decimalOrEmpty(item?.line_total ?? null),
  };
}

function makeReviewState(analysis: SteelFrameSupplierQuoteAnalysis) {
  const warnings = analysis.warnings.length ? `\n\nAlertas da analise: ${analysis.warnings.join(" ")}` : "";
  return {
    form: {
      supplierName: textOrEmpty(analysis.supplier.name),
      supplierTaxId: textOrEmpty(analysis.supplier.tax_id),
      supplierContactName: textOrEmpty(analysis.supplier.contact_name),
      supplierContactPhone: textOrEmpty(analysis.supplier.contact_phone),
      supplierContactEmail: textOrEmpty(analysis.supplier.contact_email),
      quoteNumber: textOrEmpty(analysis.quote.number),
      issuedOn: textOrEmpty(analysis.quote.issued_on),
      validUntil: textOrEmpty(analysis.quote.valid_until),
      expectedBillingOn: textOrEmpty(analysis.quote.expected_billing_on),
      paymentTerms: textOrEmpty(analysis.quote.payment_terms),
      subtotal: decimalOrEmpty(analysis.quote.subtotal),
      discount: decimalOrEmpty(analysis.quote.discount),
      freight: decimalOrEmpty(analysis.quote.freight),
      taxes: decimalOrEmpty(analysis.quote.taxes),
      total: decimalOrEmpty(analysis.quote.total),
      notes: `${analysis.summary}${warnings}`,
    },
    items: analysis.items.map((item, index) => makeReviewItem(index, item)),
  };
}

export function SupplierQuoteImport() {
  const { role, permissions, loading: accessLoading } = useNavigationAccess();
  const client = React.useMemo(() => createSupabaseBrowserClient(), []);
  const repository = React.useMemo(() => createSupabaseSteelFrameCatalogRepository(client), [client]);
  const [sources, setSources] = React.useState<SteelFrameCatalogTechnicalSource[]>([]);
  const [quotes, setQuotes] = React.useState<SteelFrameSupplierQuoteRecord[]>([]);
  const [selectedSourceId, setSelectedSourceId] = React.useState("");
  const [selectedDocumentId, setSelectedDocumentId] = React.useState("");
  const [context, setContext] = React.useState("");
  const [analysis, setAnalysis] = React.useState<SteelFrameSupplierQuoteAnalysis | null>(null);
  const [form, setForm] = React.useState<QuoteForm>(emptyForm);
  const [items, setItems] = React.useState<ReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const canManage = role === "admin" || permissions.includes("*") || permissions.includes("estimates.catalog.manage");

  const sourceCandidates = React.useMemo(
    () => sources.filter((source) => source.sourceType === "supplier_quote"),
    [sources],
  );
  const selectedSource = sourceCandidates.find((source) => source.id === selectedSourceId) ?? null;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedSources, loadedQuotes] = await Promise.all([
        repository.listTechnicalSources(),
        repository.listSupplierQuotes(),
      ]);
      setSources(loadedSources);
      setQuotes(loadedQuotes);
    } catch (loadError) {
      setError(getSteelFrameErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setSelectedDocumentId("");
    setAnalysis(null);
    setForm(emptyForm);
    setItems([]);
  }

  async function analyze() {
    if (!selectedSourceId || !selectedDocumentId) {
      toast.error("Selecione a fonte e o documento privado da cotacao.");
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch("/api/ai/extract-supplier-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: selectedSourceId,
          sourceDocumentId: selectedDocumentId,
          context,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Nao foi possivel analisar a cotacao.";
        throw new Error(message);
      }

      const parsed = payload && typeof payload === "object" && "analysis" in payload
        ? steelFrameSupplierQuoteAnalysisSchema.safeParse(payload.analysis)
        : null;
      if (!parsed?.success) throw new Error("A IA retornou uma cotacao incompleta ou invalida. Revise o documento e tente novamente.");

      setAnalysis(parsed.data);
      const review = makeReviewState(parsed.data);
      setForm(review.form);
      setItems(review.items);
      toast.success("Rascunho da cotacao pronto para revisao.");
    } catch (analysisError) {
      toast.error(getSteelFrameErrorMessage(analysisError));
    } finally {
      setAnalyzing(false);
    }
  }

  function updateForm(field: keyof QuoteForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateItem(id: string, field: keyof ReviewItem, value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItems((current) => [...current, makeReviewItem(current.length)]);
  }

  async function saveQuote() {
    if (!selectedSourceId || !selectedDocumentId) {
      toast.error("Vincule a cotacao a uma fonte e documento privado.");
      return;
    }

    const parsed = steelFrameSupplierQuoteDraftSchema.safeParse({
      sourceId: selectedSourceId,
      sourceDocumentId: selectedDocumentId,
      supplierId: null,
      supplierName: form.supplierName,
      supplierTaxId: form.supplierTaxId.trim() || null,
      supplierContactName: form.supplierContactName.trim() || null,
      supplierContactPhone: form.supplierContactPhone.trim() || null,
      supplierContactEmail: form.supplierContactEmail.trim() || null,
      quoteNumber: form.quoteNumber.trim() || null,
      issuedOn: form.issuedOn.trim() || null,
      validUntil: form.validUntil.trim() || null,
      expectedBillingOn: form.expectedBillingOn.trim() || null,
      paymentTerms: form.paymentTerms.trim() || null,
      subtotal: parseDecimal(form.subtotal),
      discount: parseDecimal(form.discount),
      freight: parseDecimal(form.freight),
      taxes: parseDecimal(form.taxes),
      total: parseDecimal(form.total),
      currency: "BRL",
      notes: form.notes.trim() || null,
      items: items.map((item) => ({
        sourceLineNumber: parseDecimal(item.sourceLineNumber),
        externalCode: item.externalCode.trim() || null,
        description: item.description,
        ncm: item.ncm.trim() || null,
        quantity: parseDecimal(item.quantity),
        unit: item.unit,
        unitPrice: parseDecimal(item.unitPrice),
        lineTotal: parseDecimal(item.lineTotal),
        materialId: null,
        materialVariantId: null,
        matchingStatus: "unmatched",
      })),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos obrigatorios da cotacao.");
      return;
    }

    setSaving(true);
    try {
      await repository.createSupplierQuote(parsed.data);
      toast.success("Cotacao historica registrada. Nenhum preco foi publicado automaticamente.");
      setAnalysis(null);
      setForm(emptyForm);
      setItems([]);
      setContext("");
      await load();
    } catch (saveError) {
      toast.error(getSteelFrameErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading || accessLoading) return <QuoteImportSkeleton />;

  if (error) {
    return (
      <Card className="border-destructive/25">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium text-destructive">Nao foi possivel carregar as cotacoes de fornecedor.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card className="border-primary/10 bg-secondary/25">
        <CardContent className="flex gap-3 p-5 text-sm text-muted-foreground"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent" /><p>O historico de cotacoes inclui informacoes comerciais sensiveis. Sua conta nao possui permissao para gerencia-lo.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/10 bg-secondary/25">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-accent" />
          <div><p className="font-medium text-foreground">Cotacao revisavel e rastreavel</p><p className="mt-1">Anexe o PDF ou imagem na Biblioteca tecnica com o tipo Cotacao de fornecedor, analise com IA e confirme cada campo. Salvar cria um historico imutavel; nenhum item vira preco ativo ou regra tecnica sem decisao posterior.</p></div>
        </CardContent>
      </Card>

      {!sourceCandidates.length ? (
        <Card className="border-dashed border-primary/20">
          <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <BookOpenText className="mb-3 size-8 text-accent" />
            <h2 className="font-semibold">Comece pela fonte privada</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">Ainda nao existe uma fonte do tipo Cotacao de fornecedor. Crie a fonte, anexe o arquivo e retorne para iniciar a revisao.</p>
            <Button asChild className="mt-4"><Link href="/estimates/catalog/sources">Abrir Biblioteca tecnica</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><FileSearch className="size-4" /> Extrair rascunho de cotacao</CardTitle><CardDescription>A IA recebe somente o arquivo privado selecionado. Confira fornecedor, valores e itens antes de registrar.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fonte de cotacao"><Select value={selectedSourceId} onValueChange={selectSource}><SelectTrigger><SelectValue placeholder="Selecione uma fonte" /></SelectTrigger><SelectContent>{sourceCandidates.map((source) => <SelectItem key={source.id} value={source.id}>{source.title}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Documento privado"><Select value={selectedDocumentId} onValueChange={setSelectedDocumentId} disabled={!selectedSource}><SelectTrigger><SelectValue placeholder={selectedSource ? "Selecione o PDF ou imagem" : "Selecione uma fonte primeiro"} /></SelectTrigger><SelectContent>{selectedSource?.documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.originalFileName}</SelectItem>)}</SelectContent></Select></Field>
            </div>
            {selectedSource && !selectedSource.documents.length ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 text-sm text-muted-foreground">Esta fonte ainda nao possui documento privado. Anexe o PDF ou imagem na Biblioteca tecnica.</p> : null}
            <Field label="Contexto opcional"><Textarea value={context} onChange={(event) => setContext(event.target.value)} maxLength={5_000} placeholder="Ex: revisar somente itens de Steel Frame e manter os demais como referencia." disabled={analyzing || saving} /></Field>
            <Button type="button" onClick={() => void analyze()} disabled={!selectedDocumentId || analyzing || saving}>{analyzing ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}{analyzing ? "Lendo cotacao..." : "Analisar documento privado"}</Button>
          </CardContent>
        </Card>
      )}

      {analysis ? <QuoteReview form={form} items={items} analysis={analysis} saving={saving} onFormChange={updateForm} onItemChange={updateItem} onAddItem={addItem} onRemoveItem={(id) => setItems((current) => current.filter((item) => item.id !== id))} onSave={() => void saveQuote()} /> : null}

      <SupplierQuoteHistory quotes={quotes} />
    </div>
  );
}

function QuoteReview({
  form,
  items,
  analysis,
  saving,
  onFormChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSave,
}: {
  form: QuoteForm;
  items: ReviewItem[];
  analysis: SteelFrameSupplierQuoteAnalysis;
  saving: boolean;
  onFormChange: (field: keyof QuoteForm, value: string) => void;
  onItemChange: (id: string, field: keyof ReviewItem, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <Card className="border-primary/15">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base text-primary"><ClipboardCheck className="size-4" /> Revisar antes de registrar</CardTitle><CardDescription>Confianca da IA: {Math.round(analysis.confidence * 100)}%. Ajuste qualquer campo incerto; o historico sera imutavel depois de salvo.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {analysis.warnings.length ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4"><p className="mb-2 text-sm font-medium text-foreground">Pontos para conferir</p><ul className="space-y-1 text-sm text-muted-foreground">{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
        <section className="space-y-3"><p className="text-sm font-medium text-foreground">Fornecedor e cotacao</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Fornecedor"><Input value={form.supplierName} onChange={(event) => onFormChange("supplierName", event.target.value)} /></Field><Field label="CNPJ / identificador"><Input value={form.supplierTaxId} onChange={(event) => onFormChange("supplierTaxId", event.target.value)} /></Field><Field label="Numero da cotacao"><Input value={form.quoteNumber} onChange={(event) => onFormChange("quoteNumber", event.target.value)} /></Field><Field label="Contato"><Input value={form.supplierContactName} onChange={(event) => onFormChange("supplierContactName", event.target.value)} /></Field><Field label="Telefone comercial"><Input value={form.supplierContactPhone} onChange={(event) => onFormChange("supplierContactPhone", event.target.value)} /></Field><Field label="Email comercial"><Input type="email" value={form.supplierContactEmail} onChange={(event) => onFormChange("supplierContactEmail", event.target.value)} /></Field><Field label="Data da cotacao"><Input type="date" value={form.issuedOn} onChange={(event) => onFormChange("issuedOn", event.target.value)} /></Field><Field label="Validade"><Input type="date" value={form.validUntil} onChange={(event) => onFormChange("validUntil", event.target.value)} /></Field><Field label="Previsao de faturamento"><Input type="date" value={form.expectedBillingOn} onChange={(event) => onFormChange("expectedBillingOn", event.target.value)} /></Field></div></section>
        <section className="space-y-3"><p className="text-sm font-medium text-foreground">Valores e condicoes</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Field label="Subtotal"><Input inputMode="decimal" value={form.subtotal} onChange={(event) => onFormChange("subtotal", event.target.value)} placeholder="0,00" /></Field><Field label="Desconto"><Input inputMode="decimal" value={form.discount} onChange={(event) => onFormChange("discount", event.target.value)} placeholder="0,00" /></Field><Field label="Frete"><Input inputMode="decimal" value={form.freight} onChange={(event) => onFormChange("freight", event.target.value)} placeholder="0,00" /></Field><Field label="Impostos"><Input inputMode="decimal" value={form.taxes} onChange={(event) => onFormChange("taxes", event.target.value)} placeholder="0,00" /></Field><Field label="Total"><Input required inputMode="decimal" value={form.total} onChange={(event) => onFormChange("total", event.target.value)} placeholder="0,00" /></Field></div><Field label="Condicoes de pagamento"><Input value={form.paymentTerms} onChange={(event) => onFormChange("paymentTerms", event.target.value)} placeholder="Ex: A vista" /></Field></section>
        <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-foreground">Itens revisados</p><Button type="button" size="sm" variant="outline" onClick={onAddItem}><Plus className="size-4" /> Adicionar item</Button></div>{items.length ? <div className="space-y-3">{items.map((item, index) => <QuoteItemEditor key={item.id} item={item} index={index} canRemove={items.length > 1} onChange={onItemChange} onRemove={onRemoveItem} />)}</div> : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">A IA nao encontrou itens completos. Adicione-os manualmente antes de registrar a cotacao.</div>}</section>
        <Field label="Resumo e observacoes"><Textarea className="min-h-28" value={form.notes} onChange={(event) => onFormChange("notes", event.target.value)} /></Field>
        <div className="flex flex-col gap-3 rounded-xl border bg-secondary/25 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm text-muted-foreground">Salvar registra um snapshot comercial historico. A associacao com materiais e a publicacao de preco permanecem manuais e auditaveis.</p><Button type="button" onClick={onSave} disabled={saving || !items.length}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Registrando..." : "Registrar cotacao revisada"}</Button></div>
      </CardContent>
    </Card>
  );
}

function QuoteItemEditor({ item, index, canRemove, onChange, onRemove }: { item: ReviewItem; index: number; canRemove: boolean; onChange: (id: string, field: keyof ReviewItem, value: string) => void; onRemove: (id: string) => void }) {
  return <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-2 xl:grid-cols-[0.42fr_0.72fr_2fr_0.7fr_0.7fr_0.7fr_0.85fr_auto]"><Field label={`Linha ${index + 1}`}><Input inputMode="numeric" value={item.sourceLineNumber} onChange={(event) => onChange(item.id, "sourceLineNumber", event.target.value)} /></Field><Field label="Codigo"><Input value={item.externalCode} onChange={(event) => onChange(item.id, "externalCode", event.target.value)} /></Field><Field label="Descricao"><Input value={item.description} onChange={(event) => onChange(item.id, "description", event.target.value)} /></Field><Field label="Qtd."><Input inputMode="decimal" value={item.quantity} onChange={(event) => onChange(item.id, "quantity", event.target.value)} /></Field><Field label="Unidade"><Input value={item.unit} onChange={(event) => onChange(item.id, "unit", event.target.value)} /></Field><Field label="Unitario"><Input inputMode="decimal" value={item.unitPrice} onChange={(event) => onChange(item.id, "unitPrice", event.target.value)} /></Field><Field label="Total"><Input inputMode="decimal" value={item.lineTotal} onChange={(event) => onChange(item.id, "lineTotal", event.target.value)} /></Field><div className="flex items-end">{canRemove ? <Button type="button" size="icon" variant="ghost" aria-label={`Remover item ${index + 1}`} onClick={() => onRemove(item.id)}><Trash2 className="size-4 text-destructive" /></Button> : null}</div></div>;
}

function SupplierQuoteHistory({ quotes }: { quotes: SteelFrameSupplierQuoteRecord[] }) {
  return <section className="space-y-3"><div className="flex items-center gap-2"><History className="size-4 text-primary" /><h2 className="text-base font-semibold">Historico de cotacoes</h2></div>{quotes.length ? <div className="grid gap-3 xl:grid-cols-2">{quotes.map((quote) => <Card key={quote.id} className="border-primary/10"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{quote.supplierName}</p><p className="mt-1 text-sm text-muted-foreground">{quote.quoteNumber ? `Cotacao ${quote.quoteNumber}` : "Numero a confirmar"} - {quote.sourceDocumentName || quote.sourceTitle || "Documento privado"}</p></div><Badge variant="secondary">Historica</Badge></div><div className="grid grid-cols-2 gap-2 border-y border-border/70 py-3 text-sm"><p><span className="text-muted-foreground">Itens:</span> {quote.items.length}</p><p><span className="text-muted-foreground">Total:</span> {formatCurrency(quote.total)}</p><p><span className="text-muted-foreground">Emitida:</span> {quote.issuedOn || "A confirmar"}</p><p><span className="text-muted-foreground">Validade:</span> {quote.validUntil || "A confirmar"}</p></div><p className="text-xs text-muted-foreground">Valores permanecem historicos ate uma selecao manual de preco no catalogo.</p></CardContent></Card>)}</div> : <Card className="border-dashed border-primary/20"><CardContent className="flex min-h-36 flex-col items-center justify-center p-5 text-center"><History className="mb-2 size-6 text-accent" /><p className="font-medium">Nenhuma cotacao historica</p><p className="mt-1 text-sm text-muted-foreground">As cotacoes revisadas aparecerao aqui, preservando o arquivo privado que as fundamenta.</p></CardContent></Card>}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function QuoteImportSkeleton() {
  return <div className="space-y-5" aria-label="Carregando cotacoes de fornecedor"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /><div className="h-80 animate-pulse rounded-xl bg-muted" /></div>;
}
