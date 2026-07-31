// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBriefingPdfFilename, createVisitBriefingPdf, getBriefingPdfErrorMessage, LeadBriefingActions, type VisitBriefingPdfData } from "@/components/lead-briefing-actions";

const mocks = vi.hoisted(() => ({
  addPage: vi.fn(),
  getNumberOfPages: vi.fn(() => 1),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  save: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setLineWidth: vi.fn(),
  setPage: vi.fn(),
  setTextColor: vi.fn(),
  splitTextToSize: vi.fn((text: string) => [text]),
  text: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdf() {
    return {
      addPage: mocks.addPage,
      getNumberOfPages: mocks.getNumberOfPages,
      rect: mocks.rect,
      roundedRect: mocks.roundedRect,
      save: mocks.save,
      setDrawColor: mocks.setDrawColor,
      setFillColor: mocks.setFillColor,
      setFont: mocks.setFont,
      setFontSize: mocks.setFontSize,
      setLineWidth: mocks.setLineWidth,
      setPage: mocks.setPage,
      setTextColor: mocks.setTextColor,
      splitTextToSize: mocks.splitTextToSize,
      text: mocks.text,
    };
  }),
}));

const briefing: VisitBriefingPdfData = {
  leadName: "Maria da Silva",
  generatedAt: "30/07/2026 10:30",
  responsible: "Tiago",
  partner: "Bruno",
  customer: [{ label: "Nome", value: "Maria da Silva" }, { label: "Telefone", value: "+55 48 99999-9999" }],
  visit: [{ label: "Data", value: "31/07/2026 14:00" }],
  project: [{ label: "Obra", value: "Casa em steel frame" }],
  commercial: [{ label: "Status", value: "Visita agendada" }],
  visitSummary: "Cliente possui terreno e deseja avaliar uma casa em steel frame.",
  checklist: ["Confirmar acesso ao terreno", "Registrar fotos do local"],
  history: [{ date: "29/07/2026 16:00", type: "WhatsApp", description: "Cliente confirmou interesse.", nextStep: "Visitar o terreno" }],
  internalNotes: "Levar referencias de acabamento.",
};

function pdfMock() {
  return {
    addPage: mocks.addPage,
    getNumberOfPages: mocks.getNumberOfPages,
    rect: mocks.rect,
    roundedRect: mocks.roundedRect,
    save: mocks.save,
    setDrawColor: mocks.setDrawColor,
    setFillColor: mocks.setFillColor,
    setFont: mocks.setFont,
    setFontSize: mocks.setFontSize,
    setLineWidth: mocks.setLineWidth,
    setPage: mocks.setPage,
    setTextColor: mocks.setTextColor,
    splitTextToSize: mocks.splitTextToSize,
    text: mocks.text,
  };
}

describe("LeadBriefingActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds a structured PDF with visual sections and page footer", () => {
    createVisitBriefingPdf(pdfMock(), briefing);

    expect(mocks.text).toHaveBeenCalledWith("NOVA FORMA", 14, 13);
    expect(mocks.text).toHaveBeenCalledWith("Visita programada", 22, expect.any(Number));
    expect(mocks.text).toHaveBeenCalledWith("Dados do cliente", 22, expect.any(Number));
    expect(mocks.text).toHaveBeenCalledWith(expect.stringContaining("Pagina 1 de 1"), 196, 288.5, { align: "right" });
    expect(mocks.roundedRect).toHaveBeenCalled();
  });

  it("generates and downloads a vector PDF from real briefing data", async () => {
    render(<LeadBriefingActions leadId="lead-123" leadName="Maria da Silva" briefing={briefing} />);
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringMatching(/^briefing-visita-maria-da-silva-\d{4}-\d{2}-\d{2}\.pdf$/)));
    expect(mocks.text).toHaveBeenCalledWith("BRIEFING DE VISITA", 196, 13, { align: "right" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("PDF do briefing baixado.");
  });

  it("creates additional pages instead of cutting a long visit history", () => {
    createVisitBriefingPdf(pdfMock(), {
      ...briefing,
      history: Array.from({ length: 30 }, (_, index) => ({
        date: `29/07/2026 ${String(index).padStart(2, "0")}:00`,
        type: "WhatsApp",
        description: "Registro comercial para acompanhamento da visita e proximos passos.",
      })),
    });

    expect(mocks.addPage).toHaveBeenCalled();
  });

  it("builds a stable safe filename", () => {
    expect(buildBriefingPdfFilename("Joao & Ana", "lead-123")).toMatch(/^briefing-visita-joao-ana-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("guides the user to refresh if an obsolete HTML renderer reports oklab", () => {
    expect(getBriefingPdfErrorMessage(new Error('Attempting to parse an unsupported color function "oklab"')))
      .toContain("Atualize a pagina");
  });
});
