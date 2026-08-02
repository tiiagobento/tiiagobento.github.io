import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function nullableText(max: number) {
  return z.string().trim().max(max).nullable().optional().transform((value) => value || null);
}

function normalizeDecimal(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/R\$|\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (datePattern.test(trimmed)) return trimmed;

  const brazilian = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!brazilian) return null;
  const [, day, month, year] = brazilian;
  const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return datePattern.test(normalized) ? normalized : null;
}

const nullableMoney = z.union([z.number(), z.string(), z.null(), z.undefined()])
  .transform(normalizeDecimal)
  .refine((value) => value === null || value >= 0, "O valor nao pode ser negativo.");

const nullableQuantity = z.union([z.number(), z.string(), z.null(), z.undefined()])
  .transform(normalizeDecimal)
  .refine((value) => value === null || value > 0, "A quantidade deve ser maior que zero.");

const nullableDate = z.union([z.string(), z.null(), z.undefined()]).transform(normalizeDate);

const nullableIdentifier = z.string().uuid().nullable().optional().transform((value) => value ?? null);

export const steelFrameSupplierQuoteItemExtractionSchema = z.object({
  source_line_number: z.number().int().positive().nullable().optional().transform((value) => value ?? null),
  external_code: nullableText(120),
  description: z.string().trim().min(1).max(500),
  ncm: nullableText(40),
  quantity: nullableQuantity,
  unit: nullableText(24),
  unit_price: nullableMoney,
  line_total: nullableMoney,
});

export const steelFrameSupplierQuoteAnalysisSchema = z.object({
  supplier: z.object({
    name: nullableText(240),
    tax_id: nullableText(80),
    contact_name: nullableText(160),
    contact_phone: nullableText(80),
    contact_email: nullableText(320),
  }),
  quote: z.object({
    number: nullableText(120),
    issued_on: nullableDate,
    valid_until: nullableDate,
    expected_billing_on: nullableDate,
    payment_terms: nullableText(1000),
    subtotal: nullableMoney,
    discount: nullableMoney,
    freight: nullableMoney,
    taxes: nullableMoney,
    total: nullableMoney,
    currency: z.literal("BRL").default("BRL"),
  }),
  items: z.array(steelFrameSupplierQuoteItemExtractionSchema).max(200).default([]),
  summary: z.string().trim().min(1).max(8_000),
  warnings: z.array(z.string().trim().min(1).max(1_000)).max(50).default([]),
  confidence: z.number().finite().min(0).max(1),
});

export type SteelFrameSupplierQuoteAnalysis = z.infer<typeof steelFrameSupplierQuoteAnalysisSchema>;

export const steelFrameSupplierQuoteItemDraftSchema = z.object({
  sourceLineNumber: z.number().int().positive(),
  externalCode: z.string().trim().max(120).nullable(),
  description: z.string().trim().min(1).max(500),
  ncm: z.string().trim().max(40).nullable(),
  quantity: z.number().finite().positive(),
  unit: z.string().trim().min(1).max(24),
  unitPrice: z.number().finite().min(0),
  lineTotal: z.number().finite().min(0),
  materialId: nullableIdentifier,
  materialVariantId: nullableIdentifier,
  matchingStatus: z.enum(["unmatched", "suggested", "confirmed", "not_applicable"]),
});

export type SteelFrameSupplierQuoteItemDraft = z.infer<typeof steelFrameSupplierQuoteItemDraftSchema>;

export const steelFrameSupplierQuoteDraftSchema = z.object({
  sourceId: z.string().uuid(),
  sourceDocumentId: z.string().uuid(),
  supplierId: nullableIdentifier,
  supplierName: z.string().trim().min(2).max(240),
  supplierTaxId: z.string().trim().max(80).nullable(),
  supplierContactName: z.string().trim().max(160).nullable(),
  supplierContactPhone: z.string().trim().max(80).nullable(),
  supplierContactEmail: z.string().trim().max(320).nullable(),
  quoteNumber: z.string().trim().max(120).nullable(),
  issuedOn: z.string().regex(datePattern).nullable(),
  validUntil: z.string().regex(datePattern).nullable(),
  expectedBillingOn: z.string().regex(datePattern).nullable(),
  paymentTerms: z.string().trim().max(1_000).nullable(),
  subtotal: z.number().finite().min(0).nullable(),
  discount: z.number().finite().min(0).nullable(),
  freight: z.number().finite().min(0).nullable(),
  taxes: z.number().finite().min(0).nullable(),
  total: z.number().finite().min(0),
  currency: z.literal("BRL").default("BRL"),
  notes: z.string().trim().max(8_000).nullable(),
  items: z.array(steelFrameSupplierQuoteItemDraftSchema).min(1).max(200),
}).superRefine((value, context) => {
  if (value.validUntil && value.issuedOn && value.validUntil < value.issuedOn) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validUntil"],
      message: "A validade nao pode ser anterior a data da cotacao.",
    });
  }
});

export type SteelFrameSupplierQuoteDraft = z.infer<typeof steelFrameSupplierQuoteDraftSchema>;

export type SteelFrameSupplierQuoteRecord = SteelFrameSupplierQuoteDraft & {
  id: string;
  status: "captured" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sourceTitle: string | null;
  sourceDocumentName: string | null;
};

export function calculateSupplierQuoteItemsTotal(items: Array<Pick<SteelFrameSupplierQuoteItemDraft, "lineTotal">>) {
  return items.reduce((total, item) => total + item.lineTotal, 0);
}

export function buildSteelFrameSupplierQuoteAnalysisPrompt({
  documentName,
  additionalContext,
}: {
  documentName: string;
  additionalContext: string;
}) {
  return `
Voce e um assistente tecnico-comercial da Nova Forma Steel Frame.
Analise a cotacao ou pedido de venda de fornecedor enviada como documento privado.
Extraia somente dados visiveis e verificaveis. Nao invente fornecedor, produtos, codigos, quantidades, unidades, precos, impostos, frete, vencimento ou condicoes de pagamento.
Ignore CPF, endereco residencial, telefone particular, email pessoal e quaisquer dados pessoais do comprador. Este rascunho registra somente fornecedor e itens comerciais.
Se um dado estiver ausente, ilegivel ou ambiguo, retorne null e informe o problema em warnings.
Nao cadastre produto, preco, fornecedor ou regra; apenas gere um rascunho para revisao humana.

Documento recebido: ${documentName}
Contexto adicional: ${additionalContext.trim() || "Nao informado."}

Use datas em YYYY-MM-DD. Use numeros JSON sem simbolo de moeda e sempre em BRL quando o documento usar reais.
Para cada item, preserve a descricao fornecida, o codigo externo quando houver, quantidade, unidade, preco unitario e total da linha. source_line_number deve seguir a ordem visual da tabela, iniciando em 1.

Retorne exclusivamente JSON valido, sem markdown ou texto externo, neste formato:
{
  "supplier": {
    "name": null,
    "tax_id": null,
    "contact_name": null,
    "contact_phone": null,
    "contact_email": null
  },
  "quote": {
    "number": null,
    "issued_on": null,
    "valid_until": null,
    "expected_billing_on": null,
    "payment_terms": null,
    "subtotal": null,
    "discount": null,
    "freight": null,
    "taxes": null,
    "total": null,
    "currency": "BRL"
  },
  "items": [{
    "source_line_number": 1,
    "external_code": null,
    "description": "",
    "ncm": null,
    "quantity": null,
    "unit": null,
    "unit_price": null,
    "line_total": null
  }],
  "summary": "",
  "warnings": [],
  "confidence": 0
}
`.trim();
}
