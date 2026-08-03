// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SupplierQuoteImport } from "./supplier-quote-import";

const repositoryMocks = vi.hoisted(() => ({
  listTechnicalSources: vi.fn(),
  listSupplierQuotes: vi.fn(),
  createSupplierQuote: vi.fn(),
}));

const dataMocks = vi.hoisted(() => ({
  listSteelFrameMaterials: vi.fn(),
}));

vi.mock("@/components/app-navigation", () => ({
  useNavigationAccess: () => ({ role: "admin", permissions: ["*"], loading: false }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({}),
}));

vi.mock("@/lib/steel-frame/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/steel-frame/catalog")>();
  return {
    ...actual,
    createSupabaseSteelFrameCatalogRepository: () => repositoryMocks,
  };
});

vi.mock("@/lib/steel-frame/data", () => ({
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro no catalogo.",
  listSteelFrameMaterials: dataMocks.listSteelFrameMaterials,
}));

const sourceId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const materialId = "33333333-3333-4333-8333-333333333333";

const source = {
  id: sourceId,
  createdBy: "44444444-4444-4444-8444-444444444444",
  title: "Cotacao 21516",
  sourceType: "supplier_quote" as const,
  code: null,
  issuer: null,
  manufacturer: null,
  productName: null,
  edition: null,
  revision: null,
  publishedOn: null,
  effectiveFrom: null,
  effectiveTo: null,
  sourceUrl: null,
  contentSha256: null,
  permittedUse: null,
  notes: null,
  status: "draft" as const,
  approvedBy: null,
  approvedAt: null,
  approvalNotes: null,
  deprecatedAt: null,
  createdAt: "2026-08-02T22:00:00Z",
  updatedAt: "2026-08-02T22:00:00Z",
  documents: [{
    id: documentId,
    sourceId,
    originalFileName: "cotacao-21516.pdf",
    storagePath: "private/cotacao-21516.pdf",
    mimeType: "application/pdf" as const,
    fileSizeBytes: 2048,
    pageCount: 1,
    contentSha256: null,
    visibility: "restricted" as const,
    notes: null,
    status: "draft" as const,
    createdAt: "2026-08-02T22:00:00Z",
  }],
};

const material = {
  id: materialId,
  created_by: "44444444-4444-4444-8444-444444444444",
  supplier_id: null,
  sku: "1823",
  name: "Guia Steel Frame 90 mm",
  category: "Perfis",
  unit: "barra",
  technical_specification: {},
  active: true,
  created_at: "2026-08-02T22:00:00Z",
  updated_at: "2026-08-02T22:00:00Z",
  prices: [],
};

describe("SupplierQuoteImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.listTechnicalSources.mockResolvedValue([source]);
    repositoryMocks.listSupplierQuotes.mockResolvedValue([]);
    repositoryMocks.createSupplierQuote.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" });
    dataMocks.listSteelFrameMaterials.mockResolvedValue([material]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      analysis: {
        supplier: { name: "Atacadao Drywall", tax_id: "03.321.303/0001-02", contact_name: null, contact_phone: null, contact_email: null },
        quote: {
          number: "21516",
          issued_on: "2026-08-02",
          valid_until: null,
          expected_billing_on: "2026-08-02",
          payment_terms: "A Vista",
          subtotal: 7140,
          discount: 0,
          freight: 0,
          taxes: 0,
          total: 7140,
          currency: "BRL",
        },
        items: [{
          source_line_number: 1,
          external_code: "1823",
          description: "GUIA STELL FRAME 90 X 0,95 X 6000MM",
          ncm: "7216.91.00",
          quantity: 60,
          unit: "PC",
          unit_price: 119,
          line_total: 7140,
        }],
        summary: "Cotacao comercial para revisao.",
        warnings: [],
        confidence: 1,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires explicit confirmation before saving a suggested material match", async () => {
    const user = userEvent.setup();
    render(<SupplierQuoteImport />);

    expect(await screen.findByText("Extrair rascunho de cotacao")).toBeInTheDocument();
    const sourceSelect = screen.getAllByRole("combobox")[0];
    await user.click(sourceSelect);
    await user.click(await screen.findByRole("option", { name: "Cotacao 21516" }));

    const documentSelect = screen.getAllByRole("combobox")[1];
    await user.click(documentSelect);
    await user.click(await screen.findByRole("option", { name: "cotacao-21516.pdf" }));
    await user.click(screen.getByRole("button", { name: "Analisar documento privado" }));

    expect(await screen.findByText("Sugestao alta")).toBeInTheDocument();
    expect(screen.getByText("Guia Steel Frame 90 mm")).toBeInTheDocument();
    expect(repositoryMocks.createSupplierQuote).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar sugestao" }));
    expect(await screen.findByText("Vinculo revisado pelo administrador.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar cotacao revisada" }));
    await waitFor(() => expect(repositoryMocks.createSupplierQuote).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({
        materialId,
        matchingStatus: "confirmed",
      })],
    })));
  });
});
