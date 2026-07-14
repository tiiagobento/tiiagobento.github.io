import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyExecutionAssistant } from "@/components/daily-execution-assistant";
import { leadFixture, taskFixture } from "@/test/fixtures";

describe("DailyExecutionAssistant", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "open", { configurable: true, writable: true, value: vi.fn(() => ({ closed: false })) });
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

    await user.click(screen.getByRole("button", { name: /registrar e criar follow-up/i }));
    await waitFor(() => {
      expect(addInteraction).toHaveBeenCalledWith(
        lead.id,
        expect.objectContaining({ interaction_type: "WhatsApp", next_contact_at: expect.any(String) }),
        { status: "Aguardando resposta" },
      );
      expect(completeTask).toHaveBeenCalledWith(task.id);
    });
  });
});
