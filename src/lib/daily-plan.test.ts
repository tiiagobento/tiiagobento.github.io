import { describe, expect, it } from "vitest";
import { buildDailyPlan, reorganizeDailyPlan, summarizeDailyPlan } from "@/lib/daily-plan";
import { interactionFixture, leadFixture, taskFixture } from "@/test/fixtures";

const now = new Date("2026-07-14T13:00:00.000Z");

describe("daily plan", () => {
  it("keeps scheduled commitments and overdue tasks ahead of generated suggestions", () => {
    const actions = buildDailyPlan({
      now,
      interactions: [],
      leads: [
        leadFixture({ id: "visit-lead", name: "Visita Hoje", lead_score: 50 }),
        leadFixture({ id: "new-lead", name: "Lead Novo", lead_score: 95, created_at: "2026-07-14T12:40:00.000Z", last_contact_at: null }),
      ],
      tasks: [
        taskFixture({ id: "overdue", lead_id: "new-lead", title: "Follow-up atrasado", due_date: "2026-07-12T12:00:00.000Z" }),
        taskFixture({ id: "visit", lead_id: "visit-lead", title: "Visita tecnica", due_date: "2026-07-14T16:00:00.000Z" }),
      ],
    });

    expect(actions[0]).toMatchObject({ kind: "scheduled", taskId: "visit" });
    expect(actions[1]).toMatchObject({ kind: "overdue", taskId: "overdue" });
    expect(actions.filter((action) => action.leadId === "new-lead")).toHaveLength(1);
  });

  it("creates an unattended new-lead action with an evidence-based reason", () => {
    const actions = buildDailyPlan({
      now,
      tasks: [],
      interactions: [],
      leads: [leadFixture({ created_at: "2026-07-14T12:35:00.000Z", last_contact_at: null, next_action_at: null, status: "Novo lead", source: "Site" })],
    });

    expect(actions[0]).toMatchObject({ kind: "new-lead", primaryAction: "whatsapp", suggestedTemplateCategory: "Cliente vindo do site" });
    expect(actions[0].reason).toContain("25 minutos");
  });

  it("does not create a generated action when a lead already has an open task", () => {
    const lead = leadFixture({ last_contact_at: null, created_at: "2026-07-14T12:35:00.000Z" });
    const actions = buildDailyPlan({ now, leads: [lead], interactions: [interactionFixture({ lead_id: lead.id })], tasks: [taskFixture({ lead_id: lead.id })] });

    expect(actions).toHaveLength(1);
    expect(actions[0].taskId).toBe("task-1");
  });

  it("summarizes the day and only reorders quick wins inside the same urgency band", () => {
    const actions = buildDailyPlan({
      now,
      interactions: [],
      leads: [leadFixture({ last_contact_at: null, created_at: "2026-07-14T12:30:00.000Z" })],
      tasks: [
        taskFixture({ id: "meeting", title: "Reuniao de alinhamento", due_date: "2026-07-14T16:00:00.000Z" }),
        taskFixture({ id: "message", title: "Enviar mensagem", due_date: "2026-07-14T17:00:00.000Z", lead_id: null }),
      ],
    });
    const reorganized = reorganizeDailyPlan(actions, "quick-wins");
    const summary = summarizeDailyPlan(actions);

    expect(reorganized[0].kind).toBe("scheduled");
    expect(summary.total).toBe(2);
    expect(summary.visits).toBe(1);
    expect(summary.estimatedMinutes).toBeGreaterThan(0);
  });
});
