import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIReplyComposer } from "@/components/ai/ai-reply-composer";
import { AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE } from "@/lib/ai/image-utils";
import type { Lead } from "@/lib/types";

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const imageMocks = vi.hoisted(() => ({ fileToDataUrl: vi.fn() }));

vi.mock("sonner", () => ({ toast: toastMocks }));
vi.mock("@/lib/ai/image-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/image-utils")>();
  return { ...actual, fileToDataUrl: imageMocks.fileToDataUrl };
});

const lead: Lead = {
  id: "lead-1",
  name: "Cibelle",
  phone: "554898295786",
  first_contact_date: "2026-07-14",
  source: "WhatsApp",
  status: "Novo lead",
  priority: "Alta",
  city: "Biguacu",
  neighborhood: "Deltaville",
  project_type: "Casa em steel frame",
  interest_type: "Orcamento",
  has_land: true,
  has_blueprint: false,
  notes: null,
  lead_score: 82,
  created_at: "2026-07-14T12:00:00.000Z",
  updated_at: "2026-07-14T12:00:00.000Z",
};

describe("AIReplyComposer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("generates an editable reply using the pasted latest client message", async () => {
    const onGenerated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Ola, Cibelle! Vamos confirmar uma visita ao local?", warnings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AIReplyComposer lead={lead} onGenerated={onGenerated} />);
    fireEvent.change(screen.getByPlaceholderText(/cole aqui a ultima mensagem/i), { target: { value: "Quero saber quando podemos visitar." } });
    fireEvent.click(screen.getByRole("button", { name: /gerar resposta com ia/i }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith("Ola, Cibelle! Vamos confirmar uma visita ao local?"));
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/generate-message", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      context: "Quero saber quando podemos visitar.",
      images: [],
      lead: { name: "Cibelle", city: "Biguacu" },
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Resposta sugerida pela IA. Revise antes de enviar.");
  });

  it("previews and removes an attached conversation print", async () => {
    imageMocks.fileToDataUrl.mockResolvedValue("data:image/png;base64,YWJj");
    render(<AIReplyComposer lead={lead} onGenerated={vi.fn()} />);

    const input = document.querySelector("#reply-print-upload") as HTMLInputElement;
    const file = new File(["image"], "whatsapp.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByAltText("Preview do print whatsapp.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover print whatsapp.png" }));
    expect(screen.queryByAltText("Preview do print whatsapp.png")).not.toBeInTheDocument();
  });

  it("blocks prints that exceed the safe total payload size", async () => {
    imageMocks.fileToDataUrl.mockResolvedValue("data:image/png;base64,YWJj");
    render(<AIReplyComposer lead={lead} onGenerated={vi.fn()} />);

    const input = document.querySelector("#reply-print-upload") as HTMLInputElement;
    const files = ["one.png", "two.png", "three.png"].map((name) => {
      const file = new File(["image"], name, { type: "image/png" });
      Object.defineProperty(file, "size", { value: 4.5 * 1024 * 1024 });
      return file;
    });
    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE));
    expect(imageMocks.fileToDataUrl).toHaveBeenCalledTimes(2);
  });

  it("shows a friendly validation error without text or image", () => {
    render(<AIReplyComposer lead={lead} onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /gerar resposta com ia/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Cole a ultima mensagem do cliente ou envie ao menos um print.");
    expect(toastMocks.error).toHaveBeenCalledWith("Cole a ultima mensagem do cliente ou envie ao menos um print.");
  });
});
