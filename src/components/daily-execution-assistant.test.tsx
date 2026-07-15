import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyExecutionAssistant } from "@/components/daily-execution-assistant";
import { leadFixture, taskFixture } from "@/test/fixtures";

describe("DailyExecutionAssistant", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "open", { configurable: true, writable: true, value: vi.fn(() => ({ closed: false })) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prepares WhatsApp, waits for confirmation and records the result", async () => {
    const user = userEvent.setup();
    const lead = leadFixture({ id: "lead-contact", name: "Carlos Eduardo", phone: "5548999999999", next_action_at: null });
    const task = taskFixture({
      id: "task-contact",
      lead_id: lead.id,
      title: "Responder WhatsApp do Carlos",
      due_date: new Date().toISOString(),
    });
    const completeTask = vi.fn().mockResolvedValue(undefined);
    const addInteraction = vi.fn().mockResolvedValue(undefined);

    render(
      <DailyExecutionAssistant
        leads={[lead]}
        interactions={[]}
        tasks={[task]}
        templates={[]}
        profileName="Tiago"
        isOnline={false}
        automationLevel="semi-automatic"
        handlers={{ completeTask, addInteraction, saveTask: vi.fn().mockResolvedValue(undefined) }}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /preparar whatsapp/i })[0]);
    const message = await screen.findByRole("textbox", { name: /mensagem para whatsapp/i });
    expect((message as HTMLTextAreaElement).value).toContain("Carlos");

    await user.click(screen.getByRole("button", { name: /abrir whatsapp/i }));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/5548999999999"), "_blank", "noopener,noreferrer");
    expect(await screen.findByText(/voce conseguiu enviar/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sim, foi enviada/i }));
    await waitFor(() => {
      expect(addInteraction).toHaveBeenCalledWith(
        lead.id,
        expect.objectContaining({ interaction_type: "WhatsApp", next_contact_at: expect.any(String) }),
        { status: "Aguardando resposta" },
      );
      expect(completeTask).toHaveBeenCalledWith(task.id);
    });
  });

  it("renders a validated server suggestion with an actionable lead card", async () => {
    const user = userEvent.setup();
    const lead = leadFixture({ id: "lead-priority", name: "Carlos Eduardo", lead_score: 91 });
    const task = taskFixture({ id: "task-priority", lead_id: lead.id, title: "Responder Carlos", due_date: new Date().toISOString() });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      message: "Carlos precisa de retorno antes de novas prioridades.",
      suggested_action_id: "task:task-priority",
      missing_information: ["bairro"],
      suggested_question: "Em qual bairro sera a obra?",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DailyExecutionAssistant
        leads={[lead]}
        interactions={[]}
        tasks={[task]}
        templates={[]}
        profileName="Tiago"
        isOnline
        automationLevel="semi-automatic"
      />,
    );

    await user.click(screen.getByRole("button", { name: /mostrar prioridades/i }));

    expect(await screen.findByText("Sugestao da IA")).toBeInTheDocument();
    expect(screen.getByText(/Carlos precisa de retorno/i)).toBeInTheDocument();
    expect(screen.getByText(/Pergunta sugerida: Em qual bairro/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /ver contexto/i }).some((link) => link.getAttribute("href") === "/leads/lead-priority")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/daily-assistant", expect.objectContaining({ method: "POST" }));
  });
});
