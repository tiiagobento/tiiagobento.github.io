import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadBriefingActions, buildBriefingPdfFilename } from "@/components/lead-briefing-actions";

const mocks = vi.hoisted(() => ({
  addImage: vi.fn(),
  addPage: vi.fn(),
  html2canvas: vi.fn(),
  save: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("html2canvas", () => ({ default: mocks.html2canvas }));
vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdf() {
    return {
    addImage: mocks.addImage,
    addPage: mocks.addPage,
    save: mocks.save,
    };
  }),
}));

describe("LeadBriefingActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<article id="visit-briefing-document">Briefing</article>';
    mocks.html2canvas.mockResolvedValue({
      height: 1400,
      toDataURL: vi.fn(() => "data:image/jpeg;base64,briefing"),
      width: 800,
    });
  });

  it("generates and downloads a PDF from the briefing document", async () => {
    render(<LeadBriefingActions leadId="lead-123" leadName="Maria da Silva" />);

    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringMatching(/^briefing-visita-maria-da-silva-\d{4}-\d{2}-\d{2}\.pdf$/)));
    expect(mocks.html2canvas).toHaveBeenCalledWith(document.getElementById("visit-briefing-document"), expect.objectContaining({ backgroundColor: "#ffffff" }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("PDF do briefing baixado.");
  });

  it("shows a friendly error when the briefing document is missing", async () => {
    document.body.innerHTML = "";
    render(<LeadBriefingActions leadId="lead-123" leadName="Maria" />);

    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Nao encontramos o conteudo do briefing para gerar o PDF."));
  });

  it("builds a stable safe filename", () => {
    expect(buildBriefingPdfFilename("Joao & Ana", "lead-123")).toMatch(/^briefing-visita-joao-ana-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
