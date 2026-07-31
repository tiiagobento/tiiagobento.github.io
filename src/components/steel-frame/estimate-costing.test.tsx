// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstimateCosting } from "./estimate-costing";

const dataMocks = vi.hoisted(() => ({
  getSteelFrameCosting: vi.fn(),
  listSteelFrameMaterials: vi.fn(),
}));

vi.mock("@/lib/steel-frame/data", () => ({
  addSteelFrameCalculatedItem: vi.fn(),
  addSteelFrameLaborItem: vi.fn(),
  addSteelFrameOperationalCost: vi.fn(),
  getSteelFrameCosting: dataMocks.getSteelFrameCosting,
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro ao carregar.",
  listSteelFrameMaterials: dataMocks.listSteelFrameMaterials,
  upsertSteelFrameCommercialComponents: vi.fn(),
}));

const emptySnapshot = {
  calculatedItems: [],
  laborItems: [],
  operationalCosts: [],
  commercialComponents: [],
};

describe("EstimateCosting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataMocks.getSteelFrameCosting.mockResolvedValue(emptySnapshot);
  });

  it("renders current catalog cost and direct-cost summary from real data", async () => {
    dataMocks.listSteelFrameMaterials.mockResolvedValue([
      {
        id: "material-1",
        name: "Placa cimenticia",
        category: "Fechamento",
        unit: "un",
        prices: [{ id: "price-1", unit_cost: 99.9, currency: "BRL", effective_from: "2026-01-01", effective_to: null }],
      },
    ]);
    dataMocks.getSteelFrameCosting.mockResolvedValue({
      ...emptySnapshot,
      calculatedItems: [{ id: "item-1", label: "Placa cimenticia", calculated_quantity: 2, unit: "un", calculation_rule: "MANUAL", total_cost: 199.8, requires_technical_review: true }],
      laborItems: [{ id: "labor-1", label: "Montagem", quantity: 1, unit: "diaria", unit_cost: 300, total_cost: 300 }],
      operationalCosts: [{ id: "op-1", label: "Frete", category: "Logistica", amount: 50 }],
    });

    render(<EstimateCosting estimateId="estimate-1" walls={[]} openings={[]} />);

    expect(await screen.findByText("Placa cimenticia - un - R$ 99,90")).toBeInTheDocument();
    expect(screen.getByText("R$ 549,80")).toBeInTheDocument();
    expect(screen.getByText("Revisao tecnica")).toBeInTheDocument();
  });

  it("shows a permission or migration problem instead of inventing financial data", async () => {
    dataMocks.listSteelFrameMaterials.mockRejectedValue(new Error("Sua conta nao possui permissao para executar esta acao no orcamento."));

    render(<EstimateCosting estimateId="estimate-1" walls={[]} openings={[]} />);

    await waitFor(() => expect(screen.getByText("Sua conta nao possui permissao para executar esta acao no orcamento.")).toBeInTheDocument());
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("keeps financial inputs read-only after a version is frozen", async () => {
    dataMocks.listSteelFrameMaterials.mockResolvedValue([]);

    render(<EstimateCosting estimateId="estimate-1" walls={[]} openings={[]} readOnly />);

    expect(await screen.findByText("A versao aprovada preserva estes custos e percentuais somente para consulta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar mao de obra" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar custo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar composicao" })).toBeDisabled();
  });
});
