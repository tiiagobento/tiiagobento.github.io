import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskList } from "@/components/task-list";
import { leadFixture, taskFixture } from "@/test/fixtures";

describe("TaskList", () => {
  it("marks pending past tasks as overdue and completes a task", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);

    render(<TaskList leads={[leadFixture()]} tasks={[taskFixture({ due_date: "2000-01-01T12:00:00.000Z" })]} onComplete={onComplete} />);

    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /concluir/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("task-1"));
  });

  it("does not show complete tasks as overdue", () => {
    render(<TaskList leads={[leadFixture()]} tasks={[taskFixture({ status: "concluida", due_date: "2000-01-01T12:00:00.000Z" })]} onComplete={vi.fn()} />);

    expect(screen.queryByText("Atrasada")).not.toBeInTheDocument();
    expect(screen.getByText("Concluida")).toBeInTheDocument();
  });
});
