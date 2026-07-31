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
});
