import { describe, expect, it } from "vitest";

import {
  buildSteelFrameSupplierQuoteAnalysisPrompt,
  calculateSupplierQuoteItemsTotal,
  steelFrameSupplierQuoteAnalysisSchema,
  steelFrameSupplierQuoteDraftSchema,
} from "./supplier-quotes";

const sourceId = "11111111-1111-4111-8111-111111111111";
const sourceDocumentId = "22222222-2222-4222-8222-222222222222";

describe("supplier quote catalog contracts", () => {
  it("normalizes Brazilian dates and monetary values returned by the provider", () => {
    const parsed = steelFrameSupplierQuoteAnalysisSchema.parse({
      supplier: { name: "Fornecedor", tax_id: null, contact_name: null, contact_phone: null, contact_email: null },
      quote: {
        number: "Q-100",
        issued_on: "16/07/2026",
        valid_until: "20/07/2026",
        expected_billing_on: null,
        payment_terms: "A vista",
        subtotal: "1.200,50",
        discount: "0,00",
        freight: null,
        taxes: 0,
        total: "1.200,50",
        currency: "BRL",
      },
      items: [{
        source_line_number: 1,
        external_code: "ABC-1",
        description: "Perfil de teste",
        ncm: null,
        quantity: "2,00",
        unit: "PC",
        unit_price: "600,25",
        line_total: "1.200,50",
      }],
      summary: "Cotacao revisavel.",
      warnings: [],
      confidence: 0.9,
    });

    expect(parsed.quote.issued_on).toBe("2026-07-16");
    expect(parsed.quote.total).toBe(1200.5);
    expect(parsed.items[0]).toMatchObject({ quantity: 2, unit_price: 600.25, line_total: 1200.5 });
  });

  it("requires a complete manual review before a historical quote is persisted", () => {
    const result = steelFrameSupplierQuoteDraftSchema.safeParse({
      sourceId,
      sourceDocumentId,
      supplierId: null,
      supplierName: "Fornecedor",
      supplierTaxId: null,
      supplierContactName: null,
      supplierContactPhone: null,
      supplierContactEmail: null,
      quoteNumber: null,
      issuedOn: "2026-07-16",
      validUntil: null,
      expectedBillingOn: null,
      paymentTerms: null,
      subtotal: null,
      discount: null,
      freight: null,
      taxes: null,
      total: 0,
      currency: "BRL",
      notes: null,
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it("totals reviewed line values without promoting prices into the catalog", () => {
    expect(calculateSupplierQuoteItemsTotal([{ lineTotal: 20 }, { lineTotal: 3.5 }])).toBe(23.5);
  });

  it("instructs the AI to omit buyer personal data and return reviewable JSON", () => {
    const prompt = buildSteelFrameSupplierQuoteAnalysisPrompt({ documentName: "cotacao.pdf", additionalContext: "" });

    expect(prompt).toContain("Ignore CPF");
    expect(prompt).toContain("Nao cadastre produto, preco, fornecedor ou regra");
    expect(prompt).toContain("Retorne exclusivamente JSON valido");
  });
});
