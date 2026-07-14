import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardView } from "@/components/dashboard-view";
import { interactionFixture, leadFixture, taskFixture } from "@/test/fixtures";

describe("DashboardView", () => {
  it("renders real metrics from provided CRM data", () => {
    render(
      <DashboardView
        leads={[
          leadFixture({ id: "lead-1", status: "Novo lead", lead_score: 80, potential_value: 500000 }),
          leadFixture({ id: "lead-2", status: "Fechado", lead_score: 55, potential_value: 300000 }),
          leadFixture({ id: "lead-3", status: "Perdido", lead_score: 25, potential_value: null }),
        ]}
        interactions={[interactionFixture()]}
        tasks={[taskFixture()]}
      />,
    );

    expect(screen.getByText("Total de leads")).toBeInTheDocument();
    expect(screen.getByText("O que fazer agora")).toBeInTheDocument();
    expect(screen.getByText("Meu dia")).toBeInTheDocument();
    expect(screen.getByText("Nova Forma IA")).toBeInTheDocument();
    expect(screen.getAllByText("3")[0]).toBeInTheDocument();
    expect(screen.getByText("Leads quentes")).toBeInTheDocument();
    expect(screen.getAllByText("Tarefas atrasadas").length).toBeGreaterThan(0);
    expect(screen.queryByText("Valor potencial total")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expandir metricas/i }));

    expect(screen.getByText("Valor potencial total")).toBeInTheDocument();
    expect(screen.getByText("R$ 800.000")).toBeInTheDocument();
    expect(screen.getByText("Taxa de conversao")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("Leads por origem")).toBeInTheDocument();
  });

  it("renders empty state without data", () => {
    render(<DashboardView leads={[]} interactions={[]} tasks={[]} />);

    expect(screen.getByText("Dashboard pronto para receber dados")).toBeInTheDocument();
    expect(screen.getByText("O que fazer agora")).toBeInTheDocument();
    expect(screen.getByText(/Cadastre o primeiro lead/i)).toBeInTheDocument();
  });
});
