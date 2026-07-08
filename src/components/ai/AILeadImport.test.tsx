import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AILeadImport } from "@/components/ai/AILeadImport";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const crmMocks = vi.hoisted(() => ({
  saveLead: vi.fn(),
}));

const aiMocks = vi.hoisted(() => ({
  analyzeLeadWithPuter: vi.fn(),
  isPuterReady: vi.fn(() => true),
  fileToDataUrl: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("@/hooks/use-crm-data", () => ({
  useCrmData: () => crmMocks,
}));

vi.mock("@/lib/ai/puter-client", () => ({
  analyzeLeadWithPuter: aiMocks.analyzeLeadWithPuter,
  fileToDataUrl: aiMocks.fileToDataUrl,
  isPuterReady: aiMocks.isPuterReady,
}));

const analysisResult = {
  leads: [
    {
      name: "Mario Coelho",
      phone: "554891153990",
      city: "Biguacu",
      neighborhood: "Deltaville",
      source: "WhatsApp",
      project_type: "Casa em steel frame",
      interest_type: "Projeto residencial",
      has_land: true,
      has_blueprint: null,
      urgency: "Quer falar sobre projeto",
      notes: "Cliente veio do site.",
      status: "Novo lead",
      priority: "Alta",
      next_step: "Agendar visita",
      lead_score: 80,
    },
  ],
  summary: "Lead quente para visita.",
  warnings: ["Telefone precisa ser revisado."],
};

describe("AILeadImport", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows friendly error when analyzing without text or image", async () => {
    render(<AILeadImport />);

    fireEvent.click(screen.getByRole("button", { name: /analisar com ia/i }));

    expect(await screen.findByText("Envie uma imagem ou cole um texto antes de analisar.")).toBeInTheDocument();
    expect(aiMocks.analyzeLeadWithPuter).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith("Envie uma imagem ou cole um texto antes de analisar.");
  });

  it("shows loading while analysis is pending", async () => {
    let resolveAnalysis!: (value: typeof analysisResult) => void;
    aiMocks.analyzeLeadWithPuter.mockReturnValue(new Promise((resolve) => {
      resolveAnalysis = resolve;
    }));

    render(<AILeadImport />);
    fireEvent.change(screen.getByPlaceholderText(/cole aqui a conversa/i), { target: { value: "Olá, quero orçamento em Biguaçu" } });
    fireEvent.click(screen.getByRole("button", { name: /analisar com ia/i }));

    expect(await screen.findByText("Analisando com IA...")).toBeInTheDocument();
    resolveAnalysis(analysisResult);
    await screen.findByText("Lead quente para visita.");
  });

  it("renders extracted lead result", async () => {
    aiMocks.analyzeLeadWithPuter.mockResolvedValue(analysisResult);

    render(<AILeadImport />);
    fireEvent.change(screen.getByPlaceholderText(/cole aqui a conversa/i), { target: { value: "Olá, vi o site e quero falar sobre um projeto." } });
    fireEvent.click(screen.getByRole("button", { name: /analisar com ia/i }));

    expect(await screen.findByText("Lead quente para visita.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mario Coelho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("554891153990")).toBeInTheDocument();
    expect(screen.getByText("Telefone precisa ser revisado.")).toBeInTheDocument();
  });

  it("loads image preview and sends data URL to analysis", async () => {
    aiMocks.fileToDataUrl.mockResolvedValue("data:image/png;base64,abc");
    aiMocks.analyzeLeadWithPuter.mockResolvedValue(analysisResult);

    render(<AILeadImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "print.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByAltText("Preview print.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /analisar com ia/i }));

    await waitFor(() =>
      expect(aiMocks.analyzeLeadWithPuter).toHaveBeenCalledWith(
        expect.objectContaining({
          images: ["data:image/png;base64,abc"],
        }),
      ),
    );
  });

  it("saves reviewed AI lead through CRM data hook", async () => {
    aiMocks.analyzeLeadWithPuter.mockResolvedValue(analysisResult);
    crmMocks.saveLead.mockResolvedValue({ id: "lead-ai-1" });

    render(<AILeadImport />);
    fireEvent.change(screen.getByPlaceholderText(/cole aqui a conversa/i), { target: { value: "Mario pediu visita em Biguacu." } });
    fireEvent.click(screen.getByRole("button", { name: /analisar com ia/i }));

    expect(await screen.findByDisplayValue("Mario Coelho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^salvar lead$/i }));

    await waitFor(() =>
      expect(crmMocks.saveLead).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mario Coelho",
          phone: "554891153990",
          source: "WhatsApp",
          status: "Novo lead",
          priority: "Alta",
        }),
      ),
    );
    expect(await screen.findByText("Salvo no Supabase.")).toBeInTheDocument();
    expect(toastMocks.success).toHaveBeenCalledWith("Lead Mario Coelho salvo.");
  });
});
