// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TechnicalValidationPanel } from "./technical-validation-panel";

const dataMocks = vi.hoisted(() => ({
  createSteelFrameTechnicalAssessment: vi.fn(),
  getLatestSteelFrameTechnicalAssessment: vi.fn(),
  listSteelFrameTechnicalCompositions: vi.fn(),
}));

vi.mock("@/lib/steel-frame/data", () => ({
  createSteelFrameTechnicalAssessment: dataMocks.createSteelFrameTechnicalAssessment,
  getLatestSteelFrameTechnicalAssessment: dataMocks.getLatestSteelFrameTechnicalAssessment,
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro ao carregar.",
  listSteelFrameTechnicalCompositions: dataMocks.listSteelFrameTechnicalCompositions,
}));

const estimate = {
  id: "estimate-1",
  standard_wall_height_meters: 2.8,
  expected_floors: 1,
};

describe("TechnicalValidationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataMocks.listSteelFrameTechnicalCompositions.mockResolvedValue([]);
    dataMocks.getLatestSteelFrameTechnicalAssessment.mockResolvedValue(null);
    dataMocks.createSteelFrameTechnicalAssessment.mockResolvedValue({
      id: "assessment-1",
      classification: "preliminary",
      created_at: "2026-07-31T12:00:00.000Z",
    });
  });

  it("keeps an estimate preliminary without an approved composition and records an audit snapshot on confirmation", async () => {
    const user = userEvent.setup();
    render(<TechnicalValidationPanel estimate={estimate as never} walls={[]} openings={[]} />);

    expect(await screen.findByText(/Nenhuma composicao tecnica aprovada esta disponivel/i)).toBeInTheDocument();
    expect(screen.getByText("ORCAMENTO PRELIMINAR")).toBeInTheDocument();
    expect(screen.getByText(/Nao substitui projeto estrutural/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar validacao" }));

    await waitFor(() => expect(dataMocks.createSteelFrameTechnicalAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: "estimate-1",
        compositionId: null,
        classification: "preliminary",
      }),
    ));
  });
});
