import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { leadFixture } from "@/test/fixtures";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

describe("WhatsAppButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens WhatsApp with rendered text and an accessible icon label", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const lead = leadFixture({ name: "Solange", phone: "(48) 98461-6671", city: "Biguacu" });

    render(<WhatsAppButton lead={lead} message="Oi {nome}, obra em {cidade}?" size="icon" />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp de Solange" }));

    expect(open).toHaveBeenCalledWith("https://wa.me/5548984616671?text=Oi%20Solange%2C%20obra%20em%20Biguacu%3F", "_blank", "noopener,noreferrer");
  });

  it("shows a friendly error for incomplete phones", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<WhatsAppButton lead={leadFixture({ phone: "123" })} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir whatsapp/i }));

    expect(open).not.toHaveBeenCalled();
  });
});
