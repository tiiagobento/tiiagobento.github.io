// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupplierCatalog } from "./supplier-catalog";

const repositoryMocks = vi.hoisted(() => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  archiveSupplier: vi.fn(),
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
}));

const supplierId = "88888888-8888-4888-8888-888888888888";
const supplier = {
  id: supplierId,
  createdBy: "44444444-4444-4444-8444-444444444444",
  name: "Atacadao Drywall",
  taxId: "03.321.303/0001-02",
  contactName: "Comercial",
  phone: "48999990000",
  email: "comercial@fornecedor.com.br",
  notes: "Fornecedor regional",
  active: true,
  archivedAt: null,
  archivedBy: null,
  archiveReason: null,
  createdAt: "2026-08-02T22:00:00Z",
  updatedAt: "2026-08-02T22:00:00Z",
};

describe("SupplierCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.listSuppliers.mockResolvedValue([supplier]);
    repositoryMocks.createSupplier.mockResolvedValue(supplier);
    repositoryMocks.updateSupplier.mockResolvedValue(supplier);
    repositoryMocks.archiveSupplier.mockResolvedValue({ ...supplier, active: false });
  });

  it("creates, edits and archives a supplier through audited repository actions", async () => {
    const user = userEvent.setup();
    render(<SupplierCatalog />);

    expect(await screen.findByText("Atacadao Drywall")).toBeInTheDocument();
    const supplierInputs = screen.getAllByPlaceholderText("Razao social ou nome comercial");
    await user.type(supplierInputs[0], "Fornecedor Teste");
    await user.click(screen.getByRole("button", { name: "Cadastrar fornecedor" }));
    await waitFor(() => expect(repositoryMocks.createSupplier).toHaveBeenCalledWith(expect.objectContaining({
      name: "Fornecedor Teste",
    })));

    await user.click(screen.getByRole("button", { name: "Editar Atacadao Drywall" }));
    expect(await screen.findByRole("heading", { name: "Editar fornecedor" })).toBeInTheDocument();
    const phoneInputs = screen.getAllByRole("textbox").filter((input) => input.getAttribute("inputmode") === "tel");
    await user.clear(phoneInputs.at(-1)!);
    await user.type(phoneInputs.at(-1)!, "48988887777");
    await user.click(screen.getByRole("button", { name: "Salvar alteracoes" }));
    await waitFor(() => expect(repositoryMocks.updateSupplier).toHaveBeenCalledWith(expect.objectContaining({
      supplierId,
      phone: "48988887777",
    })));

    await user.click(screen.getByRole("button", { name: "Arquivar Atacadao Drywall" }));
    await user.type(await screen.findByLabelText("Motivo do arquivamento"), "Fornecedor descontinuado");
    await user.click(screen.getByRole("button", { name: "Arquivar fornecedor" }));
    await waitFor(() => expect(repositoryMocks.archiveSupplier).toHaveBeenCalledWith({
      supplierId,
      reason: "Fornecedor descontinuado",
    }));
  });
});
