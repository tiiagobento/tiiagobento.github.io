import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateCard } from "@/components/template-card";
import { leadFixture, templateFixture } from "@/test/fixtures";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("TemplateCard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("replaces variables and copies rendered message", async () => {
    const lead = leadFixture({ name: "Karine", city: "Florianopolis", neighborhood: "Rio Vermelho" });
    render(<TemplateCard lead={lead} template={templateFixture()} />);

    const message = "Ola Karine, podemos falar sobre sua obra em Florianopolis/Rio Vermelho?";
    expect(screen.getByText(message)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(message));
  });
});
