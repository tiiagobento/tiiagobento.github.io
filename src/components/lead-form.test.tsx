import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeadForm } from "@/components/lead-form";

describe("LeadForm", () => {
  it("shows validation errors for required fields", async () => {
    const onSubmit = vi.fn();
    render(<LeadForm onSubmit={onSubmit} />);

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, { target: { value: "" } });
    fireEvent.change(document.querySelector('input[name="phone"]') as HTMLInputElement, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar lead/i }));

    expect(await screen.findByText("Informe o nome do cliente")).toBeInTheDocument();
    expect(screen.getByText("Informe um telefone/WhatsApp valido")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits sanitized lead data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LeadForm onSubmit={onSubmit} />);

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, { target: { value: "Israel Forte" } });
    fireEvent.change(document.querySelector('input[name="phone"]') as HTMLInputElement, { target: { value: "(51) 99265-3858" } });
    fireEvent.change(document.querySelector('input[name="city"]') as HTMLInputElement, { target: { value: "Florianopolis" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar lead/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Israel Forte",
      phone: "5551992653858",
      source: "Site",
      status: "Novo lead",
      priority: "Media",
      city: "Florianopolis",
    });
  });
});
