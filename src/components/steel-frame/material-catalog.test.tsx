// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MaterialCatalog } from "./material-catalog";

const dataMocks = vi.hoisted(() => ({
  archiveSteelFrameMaterial: vi.fn(),
  createSteelFrameMaterial: vi.fn(),
  listSteelFrameMaterials: vi.fn(),
  registerSteelFrameMaterialPrice: vi.fn(),
  updateSteelFrameMaterial: vi.fn(),
}));

vi.mock("@/components/app-navigation", () => ({
  useNavigationAccess: () => ({ role: "admin", permissions: ["*"], loading: false }),
}));

vi.mock("@/lib/steel-frame/data", () => ({
  archiveSteelFrameMaterial: dataMocks.archiveSteelFrameMaterial,
  createSteelFrameMaterial: dataMocks.createSteelFrameMaterial,
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro no catalogo.",
  listSteelFrameMaterials: dataMocks.listSteelFrameMaterials,
  registerSteelFrameMaterialPrice: dataMocks.registerSteelFrameMaterialPrice,
  updateSteelFrameMaterial: dataMocks.updateSteelFrameMaterial,
}));

const material = {
  id: "11111111-1111-4111-8111-111111111111",
  created_by: "22222222-2222-4222-8222-222222222222",
  supplier_id: null,
  sku: "M90",
  name: "Perfil montante",
  category: "Perfis",
  unit: "barra",
  technical_specification: {},
  active: true,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  prices: [{
    id: "33333333-3333-4333-8333-333333333333",
    unit_cost: 39.9,
    currency: "BRL",
    effective_from: "2026-08-01",
    effective_to: null,
    source_reference: "Cotacao 21279",
    preferred: true,
    created_at: "2026-08-01T10:00:00Z",
  }],
};

describe("MaterialCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataMocks.listSteelFrameMaterials.mockResolvedValue([material]);
    dataMocks.updateSteelFrameMaterial.mockResolvedValue(material);
    dataMocks.registerSteelFrameMaterialPrice.mockResolvedValue(material.prices[0]);
    dataMocks.archiveSteelFrameMaterial.mockResolvedValue({ ...material, active: false });
  });

  it("edits commercial metadata without touching technical fields", async () => {
    render(<MaterialCatalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar Perfil montante" }));
    fireEvent.change(screen.getByDisplayValue("Perfil montante"), { target: { value: "Perfil montante 90" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteracao" }));

    await waitFor(() => expect(dataMocks.updateSteelFrameMaterial).toHaveBeenCalledWith(expect.objectContaining({
      materialId: material.id,
      name: "Perfil montante 90",
    })));
  });

  it("shows price history and registers a sourced price", async () => {
    render(<MaterialCatalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar preco de Perfil montante" }));
    expect(screen.getByText("Cotacao 21279")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Custo unitario"), { target: { value: "42.50" } });
    fireEvent.change(screen.getByLabelText("Fonte do preco"), { target: { value: "Cotacao fornecedor agosto" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar novo preco" }));

    await waitFor(() => expect(dataMocks.registerSteelFrameMaterialPrice).toHaveBeenCalledWith(expect.objectContaining({
      materialId: material.id,
      unitCost: 42.5,
      sourceReference: "Cotacao fornecedor agosto",
    })));
  });

  it("archives only after a reason is provided", async () => {
    render(<MaterialCatalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Arquivar Perfil montante" }));
    expect(screen.getByRole("button", { name: "Arquivar material" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo do arquivamento"), { target: { value: "Produto descontinuado" } });
    fireEvent.click(screen.getByRole("button", { name: "Arquivar material" }));

    await waitFor(() => expect(dataMocks.archiveSteelFrameMaterial).toHaveBeenCalledWith({
      materialId: material.id,
      reason: "Produto descontinuado",
    }));
  });
});
