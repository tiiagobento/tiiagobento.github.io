import { describe, expect, it } from "vitest";

import {
  buildSupplierQuotePriceSourceReference,
  buildSteelFrameSupplierQuoteAnalysisPrompt,
  calculateSupplierQuoteItemsTotal,
  isSupplierQuoteItemPriceCandidate,
  suggestSupplierQuoteMaterial,
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
    expect(prompt).toContain("unidade estiver quebrada na linha visual seguinte");
  });

  it("accepts the 13 commercial lines from quote 21516 without buyer data", () => {
    const items = [
      ["1823", "GUIA STELL FRAME 90 X 0,95 X 6000MM", 60, "PC", 119, 7140],
      ["1822", "MONTANTE STEEL FRAME 90 X 0,95 X 6000MM", 80, "PC", 129, 10320],
      ["1258", "PERFIL CARTOLA STEEL #0,95 6M", 15, "PC", 79.8, 1197],
      ["PGG2400", "PLACA GESSO GLASROC 12,5 1200X2400P", 50, "PC", 274.9, 13745],
      ["1266", "MANTA HIDROFUGA WALWRAP (1,05 X 50 M)", 125, "METRO", 10.9, 1362.5],
      ["1655", "TELA PARA REFORCO WALTEX", 125, "METRO", 10.6, 1325],
      ["1725", "FITA JUNTA 10CM X 50M PROFORT BC SYSTEM", 3, "UN", 65, 195],
      ["1510", "PARAFUSO AUT PONTA BROCA CAB FLANG ZINCADO", 4000, "UN", 0.16, 640],
      ["1052", "PARAFUSO PONTA BROCA 4,2X32MM CABECA CHATA", 4000, "UN", 0.2, 800],
      ["1397", "PARABOLT 3/8X3.3/4", 50, "UN", 4.5, 225],
      ["MPROF", "MASSA BASECOAT PROFORT SC 20 KG", 30, "SC", 75.45, 2263.5],
      ["1784", "CANTONEIRA PVC PROFORT 2,50M", 50, "UN", 31.5, 1575],
      ["1898", "LA DE ROCHA 1200MMX600MMX51MM 6C", 29, "PACOTE", 116.5, 3378.5],
    ];

    const parsed = steelFrameSupplierQuoteAnalysisSchema.parse({
      supplier: { name: "Atacadao Drywall", tax_id: "03.321.303/0001-02", contact_name: null, contact_phone: null, contact_email: null },
      quote: {
        number: "21516",
        issued_on: "2026-08-02",
        valid_until: null,
        expected_billing_on: "2026-08-02",
        payment_terms: "A Vista",
        subtotal: 44166.5,
        discount: 0,
        freight: 0,
        taxes: 0,
        total: 44166.5,
        currency: "BRL",
      },
      items: items.map(([code, description, quantity, unit, unitPrice, lineTotal], index) => ({
        source_line_number: index + 1,
        external_code: code,
        description,
        ncm: null,
        quantity,
        unit,
        unit_price: unitPrice,
        line_total: lineTotal,
      })),
      summary: "Cotacao de materiais Steel Frame para revisao comercial.",
      warnings: [],
      confidence: 1,
    });

    expect(parsed.items).toHaveLength(13);
    expect(parsed.items[4].unit).toBe("METRO");
    expect(parsed.items[12].unit).toBe("PACOTE");
    expect(parsed.items.reduce((total, item) => total + (item.line_total ?? 0), 0)).toBe(44166.5);
    expect(JSON.stringify(parsed)).not.toContain("CPF");
  });

  it("suggests a catalog material by an exact external SKU", () => {
    const suggestion = suggestSupplierQuoteMaterial(
      { externalCode: "1823", description: "GUIA STELL FRAME 90 X 0,95 X 6000MM" },
      [
        { id: sourceId, sku: "1823", name: "Guia Steel Frame 90 mm", category: "Perfis", unit: "barra" },
        { id: sourceDocumentId, sku: "1822", name: "Montante Steel Frame 90 mm", category: "Perfis", unit: "barra" },
      ],
    );

    expect(suggestion).toEqual(expect.objectContaining({ materialId: sourceId, confidence: "high" }));
  });

  it("uses a unique descriptive match but rejects ambiguous or weak matches", () => {
    const materials = [
      { id: sourceId, sku: null, name: "Manta hidrofuga Walwrap", category: "Membranas", unit: "m2" },
      { id: sourceDocumentId, sku: null, name: "Parafuso ponta broca", category: "Fixadores", unit: "un" },
    ];

    expect(suggestSupplierQuoteMaterial(
      { externalCode: null, description: "MANTA HIDROFUGA WALWRAP (1,05 X 50 M)" },
      materials,
    )).toEqual(expect.objectContaining({ materialId: sourceId, confidence: "medium" }));
    expect(suggestSupplierQuoteMaterial(
      { externalCode: null, description: "PARAFUSO" },
      materials,
    )).toBeNull();
  });

  it("requires explicit catalog linkage consistency before saving", () => {
    const result = steelFrameSupplierQuoteDraftSchema.safeParse({
      sourceId,
      sourceDocumentId,
      supplierId: null,
      supplierName: "Fornecedor",
      supplierTaxId: null,
      supplierContactName: null,
      supplierContactPhone: null,
      supplierContactEmail: null,
      quoteNumber: "Q-1",
      issuedOn: "2026-08-02",
      validUntil: null,
      expectedBillingOn: null,
      paymentTerms: null,
      subtotal: 10,
      discount: 0,
      freight: 0,
      taxes: 0,
      total: 10,
      currency: "BRL",
      notes: null,
      items: [{
        sourceLineNumber: 1,
        externalCode: null,
        description: "Material",
        ncm: null,
        quantity: 1,
        unit: "UN",
        unitPrice: 10,
        lineTotal: 10,
        materialId: null,
        materialVariantId: null,
        matchingStatus: "confirmed",
      }],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("exige um material");
  });

  it("only allows reviewed quote items with a valid unit price to become price candidates", () => {
    expect(isSupplierQuoteItemPriceCandidate({
      matchingStatus: "confirmed",
      materialId: sourceId,
      unitPrice: 119,
      unit: "PC",
    })).toBe(true);
    expect(isSupplierQuoteItemPriceCandidate({
      matchingStatus: "unmatched",
      materialId: null,
      unitPrice: 119,
      unit: "PC",
    })).toBe(false);
    expect(isSupplierQuoteItemPriceCandidate({
      matchingStatus: "confirmed",
      materialId: sourceId,
      unitPrice: 0,
      unit: "PC",
    })).toBe(false);
  });

  it("creates a traceable source reference without changing the historic quote", () => {
    expect(buildSupplierQuotePriceSourceReference({
      quoteId: sourceId,
      quoteNumber: "21516",
      supplierName: "Atacadao Drywall",
      sourceDocumentName: "cotacao-21516.pdf",
      sourceLineNumber: 1,
    })).toBe("Cotacao 21516 - Atacadao Drywall - linha 1");
  });
});
