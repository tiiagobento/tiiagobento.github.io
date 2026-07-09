import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { leadFixture } from "@/test/fixtures";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WhatsAppButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens WhatsApp with rendered text and an accessible icon label", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const lead = leadFixture({ name: "Solange", phone: "(48) 98461-6671", city: "Biguacu" });

    render(<WhatsAppButton lead={lead} message="Oi {nome}, obra em {cidade}?" size="icon" />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp de Solange" }));

    expect(open).toHaveBeenCalledWith("https://wa.me/5548984616671?text=Oi%20Solange%2C%20obra%20em%20Biguacu%3F", "_blank", "noopener,noreferrer");
    expect(toast.success).toHaveBeenCalledWith("WhatsApp aberto.");
  });

  it("shows a friendly error for incomplete phones", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<WhatsAppButton lead={leadFixture({ phone: "123" })} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir whatsapp/i }));

    expect(open).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Telefone incompleto ou invalido para abrir o WhatsApp.");
  });
});
