// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstimateProposalActions } from "./estimate-proposal-actions";

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
});
