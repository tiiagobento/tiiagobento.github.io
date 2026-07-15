import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  deleteEq: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
    from: () => ({
      upsert: supabaseMocks.upsert,
      delete: () => ({
        eq: supabaseMocks.deleteEq,
      }),
    }),
  },
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("offline sync queue", () => {
  beforeEach(async () => {
    setOnline(true);
    vi.resetModules();
    vi.clearAllMocks();
    const { getOfflineDb } = await import("@/lib/offline/db");
    const db = getOfflineDb();
    await Promise.all(db?.tables.map((table) => table.clear()) ?? []);
  });

  afterEach(async () => {
    const { getOfflineDb } = await import("@/lib/offline/db");
    const db = getOfflineDb();
    await Promise.all(db?.tables.map((table) => table.clear()) ?? []);
  });

  it("tracks pending operations", async () => {
    const { enqueueOperation, getSyncSummary } = await import("@/lib/offline/sync-queue");

    await enqueueOperation({
      entity: "leads",
      entityId: "lead-local-1",
      userId: "user-1",
      operation: "create",
      data: { id: "lead-local-1", user_id: "user-1", name: "Lead offline" },
    });

    await expect(getSyncSummary("user-1")).resolves.toMatchObject({ pending: 1, failed: 0, conflict: 0 });
  });

  it("syncs pending operations with Supabase when online", async () => {
    const { enqueueOperation, getSyncSummary, syncPendingOperations } = await import("@/lib/offline/sync-queue");
    supabaseMocks.upsert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "lead-local-1", user_id: "user-1", name: "Lead offline" }, error: null }),
      }),
    });

    await enqueueOperation({
      entity: "leads",
      entityId: "lead-local-1",
      userId: "user-1",
      operation: "create",
      data: { id: "lead-local-1", user_id: "user-1", name: "Lead offline" },
    });

    await expect(syncPendingOperations("user-1")).resolves.toEqual({ synced: 1, failed: 0 });
    await expect(getSyncSummary("user-1")).resolves.toMatchObject({ pending: 0 });

    const { getOfflineDb } = await import("@/lib/offline/db");
    const localLead = await getOfflineDb()?.leads.get("lead-local-1");
    expect(localLead).toMatchObject({ sync_status: "synced", operation: null, data: { name: "Lead offline" } });
  });

  it("does not sync while offline", async () => {
    const { enqueueOperation, syncPendingOperations } = await import("@/lib/offline/sync-queue");
    setOnline(false);

    await enqueueOperation({
      entity: "tasks",
      entityId: "task-local-1",
      userId: "user-1",
      operation: "create",
      data: { id: "task-local-1", user_id: "user-1", title: "Ligar" },
    });

    await expect(syncPendingOperations("user-1")).resolves.toEqual({ synced: 0, failed: 0 });
    expect(supabaseMocks.upsert).not.toHaveBeenCalled();
  });

  it("syncs partner visit feedback through the restricted RPC", async () => {
    const { enqueueOperation, syncPendingOperations } = await import("@/lib/offline/sync-queue");
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        id: "lead-partner-1",
        user_id: "owner-1",
        visit_status: "Visita realizada",
        partner_notes: "Acesso confirmado.",
        partner_visit_feedback: "Levantamento concluido.",
      },
      error: null,
    });

    await enqueueOperation({
      entity: "leads",
      entityId: "lead-partner-1",
      userId: "partner-1",
      operation: "update",
      syncMode: "partner_visit_feedback",
      data: {
        visit_status: "Visita realizada",
        partner_notes: "Acesso confirmado.",
        partner_visit_feedback: "Levantamento concluido.",
      },
    });

    await expect(syncPendingOperations("partner-1")).resolves.toEqual({ synced: 1, failed: 0 });
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("partner_update_visit_feedback", {
      target_lead_id: "lead-partner-1",
      new_visit_status: "Visita realizada",
      new_partner_notes: "Acesso confirmado.",
      new_partner_visit_feedback: "Levantamento concluido.",
    });
    expect(supabaseMocks.upsert).not.toHaveBeenCalled();
  });
});
