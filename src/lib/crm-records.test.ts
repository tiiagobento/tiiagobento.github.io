// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { isBefore, parseISO, startOfToday, subDays } from "date-fns";
import { buildFollowUpTaskFromInteraction, normalizeLead, normalizeTask } from "@/lib/crm-records";
import { interactionFixture, leadFixture } from "@/test/fixtures";

describe("crm record normalization", () => {
  it("creates a lead with defaults, sanitized phone and automatic score", () => {
    const lead = normalizeLead({
      name: " David Cristiano ",
      phone: "(49) 98823-0647",
      has_land: true,
      has_blueprint: true,
      city: "Governador Celso Ramos",
      wants_visit: true,
      priority: "Alta",
    });

    expect(lead.name).toBe("David Cristiano");
    expect(lead.phone).toBe("5549988230647");
    expect(lead.status).toBe("Novo lead");
    expect(lead.source).toBe("Site");
    expect(lead.whatsapp_link).toBe("https://wa.me/5549988230647");
    expect(lead.lead_score).toBeGreaterThanOrEqual(70);
  });

  it("normalizes a task and can identify overdue pending tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));
    const task = normalizeTask({
      title: "Retomar cliente",
      due_date: subDays(new Date(), 1).toISOString(),
      priority: "Media",
      status: "pendente",
    });

    expect(task.responsible).toBe("Tiago");
    expect(task.status).toBe("pendente");
    expect(isBefore(parseISO(task.due_date), startOfToday())).toBe(true);
    vi.useRealTimers();
  });

  it("builds a follow-up task when interaction has next contact", () => {
    const lead = leadFixture({ priority: "Alta", assigned_to: "Bruno" });
    const interaction = interactionFixture({ next_step: "Enviar proposta", next_contact_at: "2026-07-11T13:00:00.000Z" });
    const task = buildFollowUpTaskFromInteraction({ lead, leadId: lead.id, interaction });

    expect(task).toMatchObject({
      lead_id: lead.id,
      title: "Follow-up: Enviar proposta",
      priority: "Alta",
      responsible: "Tiago",
      status: "pendente",
    });
  });

  it("does not create task when interaction has no next contact", () => {
    const task = buildFollowUpTaskFromInteraction({
      lead: leadFixture(),
      leadId: "lead-1",
      interaction: interactionFixture({ next_contact_at: null }),
    });

    expect(task).toBeNull();
  });
});
