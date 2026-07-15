import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/lib/types";

const userId = "user-offline";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    user_id: userId,
    name: "Cliente remoto",
    phone: "5548999999999",
    first_contact_date: "2026-07-14",
    source: "WhatsApp",
    status: "Novo lead",
    priority: "Media",
    lead_score: 40,
    created_at: "2026-07-14T12:00:00.000Z",
    updated_at: "2026-07-14T12:00:00.000Z",
    ...overrides,
  };
}

function snapshot(leads: Lead[]) {
  return { leads, interactions: [], tasks: [], templates: [], profiles: [] };
}

describe("offline store", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { getOfflineDb } = await import("@/lib/offline/db");
    const db = getOfflineDb();
    await Promise.all(db?.tables.map((table) => table.clear()) ?? []);
  });

  afterEach(async () => {
    const { getOfflineDb } = await import("@/lib/offline/db");
    const db = getOfflineDb();
    await Promise.all(db?.tables.map((table) => table.clear()) ?? []);
  });

  it("preserves a queued local edit when refreshing the remote snapshot", async () => {
    const { loadCrmSnapshot, putLocalRecord, saveCrmSnapshot } = await import("@/lib/offline/offline-store");
    await saveCrmSnapshot(userId, snapshot([lead()]));

    await putLocalRecord("leads", lead({ name: "Cliente alterado offline" }), userId, "update");
    const merged = await saveCrmSnapshot(userId, snapshot([lead({ name: "Cliente remoto atualizado" })]));

    expect(merged.leads).toHaveLength(1);
    expect(merged.leads[0]?.name).toBe("Cliente alterado offline");
    await expect(loadCrmSnapshot(userId)).resolves.toMatchObject({ leads: [{ name: "Cliente alterado offline" }] });
  });

  it("keeps a queued deletion hidden even if the old remote record is returned", async () => {
    const { loadCrmSnapshot, putLocalRecord, saveCrmSnapshot } = await import("@/lib/offline/offline-store");
    await saveCrmSnapshot(userId, snapshot([lead()]));

    await putLocalRecord("leads", lead(), userId, "delete");
    const merged = await saveCrmSnapshot(userId, snapshot([lead()]));

    expect(merged.leads).toEqual([]);
    await expect(loadCrmSnapshot(userId)).resolves.toMatchObject({ leads: [] });
  });

  it("keeps a partner cache scoped to the signed-in partner while preserving the lead owner", async () => {
    const partnerId = "partner-1";
    const ownerId = "owner-1";
    const partnerLead = lead({ user_id: ownerId, partner_id: partnerId });
    const { loadCrmSnapshot, saveCrmSnapshot } = await import("@/lib/offline/offline-store");

    await saveCrmSnapshot(partnerId, snapshot([partnerLead]));

    await expect(loadCrmSnapshot(partnerId)).resolves.toMatchObject({
      leads: [{ id: "lead-1", user_id: ownerId, partner_id: partnerId }],
    });
    await expect(loadCrmSnapshot(ownerId)).resolves.toMatchObject({ leads: [] });
  });
});
