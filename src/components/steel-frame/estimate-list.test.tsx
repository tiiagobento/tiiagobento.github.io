// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstimateList } from "./estimate-list";

const dataMocks = vi.hoisted(() => ({
  listSteelFrameEstimates: vi.fn(),
}));

vi.mock("@/lib/steel-frame/data", () => ({
  listSteelFrameEstimates: dataMocks.listSteelFrameEstimates,
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro ao carregar.",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));

describe("EstimateList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders saved estimates from the data source", async () => {
    dataMocks.listSteelFrameEstimates.mockResolvedValue([
      {
        id: "estimate-1",
        title: "Residencia terrea - Biguacu",
        mode: "commercial",
        status: "draft",
        city: "Biguacu",
        neighborhood: "Deltaville",
        current_version_number: 1,
        lead: { id: "lead-1", name: "Carlos", phone: "5548999999999", city: "Biguacu", neighborhood: "Deltaville" },
      },
    ]);

    render(<EstimateList />);

    expect(await screen.findByText("Residencia terrea - Biguacu")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /residencia terrea/i })).toHaveAttribute("href", "/estimates/estimate-1");
  });

  it("shows an actionable migration error instead of mock data", async () => {
    dataMocks.listSteelFrameEstimates.mockRejectedValue(new Error("Execute a migration antes de continuar."));

    render(<EstimateList />);

    await waitFor(() => expect(screen.getByText("Nao foi possivel carregar os orcamentos.")).toBeInTheDocument());
    expect(screen.getByText("Execute a migration antes de continuar.")).toBeInTheDocument();
    expect(screen.queryByText("Residencia terrea - Biguacu")).not.toBeInTheDocument();
  });
});
