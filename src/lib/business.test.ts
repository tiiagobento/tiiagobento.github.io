// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { addDays, subDays } from "date-fns";
import { applyTemplate, buildWhatsAppUrl, isStaleLead, isValidWhatsAppPhone, sanitizePhone, scoreLabel, scoreLead } from "@/lib/business";
import { leadSchema } from "@/lib/schemas";
import { leadFixture } from "@/test/fixtures";

describe("business rules", () => {
  it("sanitizes phones and builds encoded WhatsApp links", () => {
    expect(sanitizePhone("(48) 98461-6671")).toBe("5548984616671");
    expect(sanitizePhone("+55 48 98461-6671")).toBe("5548984616671");
    expect(sanitizePhone("+34 628 11 36 31")).toBe("34628113631");
    expect(isValidWhatsAppPhone("(48) 98461-6671")).toBe(true);
    expect(isValidWhatsAppPhone("+34 628 11 36 31")).toBe(true);
    expect(buildWhatsAppUrl("(48) 98461-6671", "Olá, visita às 14h?")).toBe("https://wa.me/5548984616671?text=Ol%C3%A1%2C%20visita%20%C3%A0s%2014h%3F");
    expect(buildWhatsAppUrl("+34 628 11 36 31", "Hola Enzo")).toBe("https://wa.me/34628113631?text=Hola%20Enzo");
    expect(buildWhatsAppUrl("123")).toBe("");
  });

  it("calculates hot lead score from qualification signals", () => {
    const score = scoreLead(
      leadFixture({
        phone: "(48) 98461-6671",
        city: "Biguacu",
        has_land: true,
        has_blueprint: true,
        approximate_area: 150,
        wants_visit: true,
        desired_start_time: "30 dias",
        priority: "Alta",
      }),
    );

    expect(score).toBeGreaterThanOrEqual(70);
    expect(scoreLabel(score)).toBe("Lead quente");
  });

  it("does not mark closed or lost leads as stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));
    expect(isStaleLead(leadFixture({ last_contact_at: subDays(new Date(), 5).toISOString(), status: "Novo lead" }))).toBe(true);
    expect(isStaleLead(leadFixture({ last_contact_at: subDays(new Date(), 5).toISOString(), status: "Fechado" }))).toBe(false);
    expect(isStaleLead(leadFixture({ last_contact_at: subDays(new Date(), 5).toISOString(), status: "Perdido" }))).toBe(false);
    vi.useRealTimers();
  });

  it("applies template variables without breaking accents", () => {
    const lead = leadFixture({ name: "Cibelle", city: "Imbituba", neighborhood: "Itapiruba", visit_scheduled_at: "2026-07-10T17:30:00" });
    expect(applyTemplate("Olá {nome}, visita em {cidade}/{bairro} dia {data_visita} às {horario_visita}.", lead)).toBe(
      "Olá Cibelle, visita em Imbituba/Itapiruba dia 10/07/2026 às 17:30.",
    );
  });

  it("validates lead form and sanitizes phone", () => {
    const parsed = leadSchema.parse({
      name: "Mario Coelho",
      phone: "(48) 99115-3990",
      first_contact_date: "2026-07-07",
      source: "Site",
      status: "Novo lead",
      priority: "Media",
      city: "",
      email: "",
    });

    expect(parsed.phone).toBe("5548991153990");
    expect(leadSchema.safeParse({ ...parsed, name: "M", phone: "12" }).success).toBe(false);
  });

  it("treats a future last contact as not stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));
    expect(isStaleLead(leadFixture({ last_contact_at: addDays(new Date(), 1).toISOString() }))).toBe(false);
    vi.useRealTimers();
  });
});
