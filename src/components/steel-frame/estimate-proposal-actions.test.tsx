// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEstimateProposalPdf, EstimateProposalActions } from "./estimate-proposal-actions";

const dataMocks = vi.hoisted(() => ({
  getSteelFrameCosting: vi.fn(),
}));

vi.mock("@/components/app-navigation", () => ({
  useNavigationAccess: () => ({ role: "admin", permissions: ["*"], loading: false }),
}));

vi.mock("@/lib/steel-frame/data", () => ({
  getSteelFrameCosting: dataMocks.getSteelFrameCosting,
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro ao carregar.",
  markSteelFrameProposalGenerated: vi.fn(),
  uploadSteelFrameDocument: vi.fn(),
}));

const estimate = {
  id: "estimate-1",
  title: "Residencia em Biguacu",
  status: "approved",
  current_version_number: 2,
  city: "Biguacu",
  neighborhood: "Deltaville",
  project_type: "Casa residencial",
  notes: null,
  lead: { name: "Carlos", city: "Biguacu", neighborhood: "Deltaville" },
};

const completeSnapshot = {
  calculatedItems: [{ total_cost: 1000 }],
  laborItems: [{ total_cost: 500 }],
  operationalCosts: [{ amount: 250 }],
  commercialComponents: [
    { component_key: "contingency", percentage: 5 },
    { component_key: "tax", percentage: 6 },
    { component_key: "sales_commission", percentage: 4 },
    { component_key: "platform_commission", percentage: 0 },
    { component_key: "target_margin", percentage: 20 },
    { component_key: "max_discount", percentage: 3 },
  ],
};

describe("EstimateProposalActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataMocks.getSteelFrameCosting.mockResolvedValue(completeSnapshot);
  });

  it("uses stored costs to show a proposal preview after technical approval", async () => {
    render(<EstimateProposalActions estimate={estimate as never} onGenerated={vi.fn()} />);

    expect(await screen.findByText("Valor recomendado")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.750,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar proposta PDF" })).toBeInTheDocument();
  });

  it("does not fabricate a proposal when the persisted commercial setup is incomplete", async () => {
    dataMocks.getSteelFrameCosting.mockResolvedValue({ ...completeSnapshot, commercialComponents: [] });

    render(<EstimateProposalActions estimate={estimate as never} onGenerated={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Configure todos os componentes comerciais antes de gerar a proposta.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Gerar proposta PDF" })).not.toBeInTheDocument();
  });

  it("renders quantities without internal costs and includes a formal acceptance area in the PDF", () => {
    const pdf = new ProposalPdfSpy();

    createEstimateProposalPdf(pdf as never, {
      proposalCode: "NFSF-V2-20260802090000",
      generatedAt: "02/08/2026, 09:00",
      estimateTitle: "Residencia em Biguacu",
      clientName: "Carlos",
      city: "Biguacu",
      neighborhood: "Deltaville",
      projectType: "Casa residencial",
      versionNumber: 2,
      salePrice: 50000,
      validityDays: 7,
      scope: "Execucao da estrutura e dos fechamentos definidos no escopo aprovado.",
      terms: "Pagamento e cronograma a confirmar no aceite.",
      notes: "Altura e medidas ainda serao conferidas na visita tecnica.",
      materials: [{ label: "Montante Steel Frame 90 x 0,95 x 6.000 mm", category: "Estrutura", unit: "barra", quantity: 18 }],
    });

    expect(pdf.content).toContain("Relacao tecnica de materiais");
    expect(pdf.content).toContain("Montante Steel Frame 90 x 0,95 x 6.000 mm");
    expect(pdf.content).toContain("Aceite da proposta");
    expect(pdf.content).not.toContain("123.45");
  });
});

class ProposalPdfSpy {
  content: string[] = [];
  pageCount = 1;

  addPage() { this.pageCount += 1; }
  getNumberOfPages() { return this.pageCount; }
  output() { return new Blob(); }
  rect() {}
  roundedRect() {}
  save() {}
  setDrawColor() {}
  setFillColor() {}
  setFont() {}
  setFontSize() {}
  setLineWidth() {}
  setPage() {}
  setTextColor() {}
  splitTextToSize(text: string) { return [text]; }
  text(value: string | string[]) {
    this.content.push(...(Array.isArray(value) ? value : [value]));
  }
}
