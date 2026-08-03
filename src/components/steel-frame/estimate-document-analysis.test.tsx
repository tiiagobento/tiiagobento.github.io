// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SteelFrameDocumentRecord } from "@/lib/steel-frame/types";
import { EstimateDocumentAnalysis } from "./estimate-document-analysis";

const dataMocks = vi.hoisted(() => ({
  addSteelFrameAICorrection: vi.fn(),
  addSteelFrameOpening: vi.fn(),
  addSteelFrameWall: vi.fn(),
}));

vi.mock("@/lib/steel-frame/data", () => ({
  addSteelFrameAICorrection: dataMocks.addSteelFrameAICorrection,
  addSteelFrameOpening: dataMocks.addSteelFrameOpening,
  addSteelFrameWall: dataMocks.addSteelFrameWall,
  getSteelFrameErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Erro ao salvar.",
}));

const document = {
  id: "document-1",
  original_file_name: "planta.pdf",
  mime_type: "application/pdf",
  metadata: { upload_state: "uploaded" },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("EstimateDocumentAnalysis", () => {
  it("shows editable AI suggestions without adding them automatically", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        extractionId: "extraction-1",
        analysis: {
          summary: "Planta com uma parede principal identificada.",
          estimate: { title: null, city: null, neighborhood: null, approximate_address: null, project_type: null, standard_wall_height_meters: null, expected_floors: null },
          walls: [{
            label: "Parede frontal",
            length_meters: 5,
            height_meters: 2.8,
            quantity: 1,
            confidence: 0.72,
            evidence: { document_index: 1, page_number: 1, source_text: "5,00", bounding_box: null },
          }],
          openings: [],
          missing_information: ["Confirmar espessura da parede"],
          warnings: [],
          confidence: 0.72,
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EstimateDocumentAnalysis estimateId="estimate-1" documents={[document] as unknown as SteelFrameDocumentRecord[]} wallCount={0} openingCount={0} onGeometryChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Analisar com IA" }));

    expect(await screen.findByText("Planta com uma parede principal identificada.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Parede frontal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    expect(dataMocks.addSteelFrameWall).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/ai/extract-estimate", expect.objectContaining({ method: "POST" })));
  });

  it("links an extracted opening to its reviewed wall and persists the AI evidence", async () => {
    const wallId = "11111111-1111-4111-8111-111111111111";
    dataMocks.addSteelFrameWall.mockResolvedValue({ id: wallId });
    dataMocks.addSteelFrameOpening.mockResolvedValue({ id: "opening-1" });
    dataMocks.addSteelFrameAICorrection.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        extractionId: "extraction-1",
        analysis: {
          summary: "Parede e janela identificadas.",
          estimate: { title: null, city: null, neighborhood: null, approximate_address: null, project_type: null, standard_wall_height_meters: null, expected_floors: null },
          walls: [{
            label: "Parede A",
            length_meters: 6,
            height_meters: 3,
            quantity: 1,
            confidence: 0.7,
            evidence: { document_index: 1, page_number: 2, source_text: "Parede A 6,00 m", bounding_box: null },
          }],
          openings: [{
            label: "Janela A",
            opening_type: "window",
            width_meters: 1.2,
            height_meters: 1.2,
            quantity: 1,
            wall_label: "Parede A",
            confidence: 0.65,
            evidence: { document_index: 1, page_number: 2, source_text: "J1 1,20 x 1,20", bounding_box: null },
          }],
          missing_information: [],
          warnings: [],
          confidence: 0.68,
        },
      }),
    })));

    render(<EstimateDocumentAnalysis estimateId="estimate-1" documents={[document] as unknown as SteelFrameDocumentRecord[]} wallCount={0} openingCount={0} onGeometryChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Analisar com IA" }));

    expect(await screen.findByText("Parede e janela identificadas.")).toBeInTheDocument();
    expect(screen.getAllByText("Doc. 1, pag. 2")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar itens revisados" }));

    await waitFor(() => expect(dataMocks.addSteelFrameOpening).toHaveBeenCalledWith(
      "estimate-1",
      expect.objectContaining({
        wallSegmentId: wallId,
        sourceData: expect.objectContaining({
          ai_confidence: 0.65,
          ai_evidence: expect.objectContaining({ source_text: "J1 1,20 x 1,20" }),
        }),
      }),
      0,
    ));
  });
});
