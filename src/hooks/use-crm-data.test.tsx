// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leadFixture } from "@/test/fixtures";
import type { Lead, PartnerNotification } from "@/lib/types";

const db = vi.hoisted(() => ({
  leads: [] as Lead[],
  interactions: [] as unknown[],
  tasks: [] as unknown[],
  templates: [] as unknown[],
  notifications: [] as PartnerNotification[],
  profiles: [{ id: "user-1", name: "Tiago", email: "tiago@example.com", role: "admin" }],
  upserts: [] as unknown[],
  deletes: [] as string[],
  updates: [] as unknown[],
  tableErrors: {} as Record<string, unknown>,
}));

function createTableBuilder(table: string) {
  const rows = () => table === "partner_notifications" ? db.notifications : (db[table as keyof typeof db] ?? []);

  return {
    select: vi.fn(() => ({
      order: vi.fn(async () => ({ data: rows(), error: db.tableErrors[table] ?? null })),
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: table === "profiles" ? db.profiles[0] : null,
          error: null,
        })),
      })),
      single: vi.fn(async () => ({ data: db.leads[0], error: null })),
    })),
    upsert: vi.fn((payload: Lead) => {
      db.upserts.push(payload);
      db.leads = [payload];
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: payload, error: null })),
        })),
      };
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(async (_column: string, id: string) => {
        db.deletes.push(id);
        db.leads = db.leads.filter((lead) => lead.id !== id);
        return { error: null };
      }),
    })),
    insert: vi.fn(async (payload: unknown) => {
      if (table === "interactions") db.interactions.push(payload);
      if (table === "tasks") db.tasks.push(payload);
      return { error: null };
    }),
    update: vi.fn((payload: Record<string, unknown>) => ({
      eq: vi.fn(async (_column: string, id: string) => {
        db.updates.push({ table, id, payload });
        db.leads = db.leads.map((lead) => (lead.id === id ? { ...lead, ...payload } : lead));
        if (table === "partner_notifications") {
          db.notifications = db.notifications.map((notification) => notification.id === id ? { ...notification, ...payload } : notification);
        }
        return { error: null };
      }),
    })),
  };
}

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email: "tiago@example.com" } }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "user-1", email: "tiago@example.com" } } }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  from: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/offline/db", () => ({
  clearOfflineDbForUser: vi.fn(),
}));

vi.mock("@/lib/offline/network-status", () => ({
  useNetworkStatus: () => ({ online: true, lastChangedAt: "2026-07-10T00:00:00.000Z" }),
}));

vi.mock("@/lib/offline/offline-store", () => ({
  accessSignature: vi.fn((profile: { id?: string; role?: string; active?: boolean; updated_at?: string } | null) => profile ? `${profile.id}:${profile.role}:${profile.active !== false}:${profile.updated_at ?? "unknown"}` : "missing-profile"),
  loadCrmSnapshot: vi.fn(async () => null),
  putLocalRecord: vi.fn(async () => undefined),
  saveCrmSnapshot: vi.fn(async (_userId: string, snapshot: unknown) => snapshot),
}));

vi.mock("@/lib/offline/sync-queue", () => ({
  enqueueOperation: vi.fn(async () => null),
  getSyncSummary: vi.fn(async () => ({ pending: 0, failed: 0, conflict: 0, operations: [] })),
  retryFailedOperations: vi.fn(async () => undefined),
  syncPendingOperations: vi.fn(async () => ({ synced: 0, failed: 0 })),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: supabaseMocks.getUser,
      getSession: supabaseMocks.getSession,
      signOut: supabaseMocks.signOut,
    },
    from: supabaseMocks.from,
  },
}));

async function renderCrmHook() {
  vi.resetModules();
  const { useCrmData } = await import("@/hooks/use-crm-data");
  return renderHook(() => useCrmData());
}

describe("useCrmData CRUD", () => {
  beforeEach(() => {
    db.leads = [leadFixture()];
    db.interactions = [];
    db.tasks = [];
    db.templates = [];
    db.notifications = [];
    db.upserts = [];
    db.deletes = [];
    db.updates = [];
    db.tableErrors = {};
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "tiago@example.com" } }, error: null });
    supabaseMocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1", email: "tiago@example.com" } } }, error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
    supabaseMocks.from.mockImplementation((table: string) => createTableBuilder(table));
  });

  it("creates and edits leads through Supabase upsert", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.saveLead({
      name: "Lucas Ferreira",
      phone: "(48) 99999-0000",
      first_contact_date: "2026-07-07",
      source: "Site",
      status: "Novo lead",
      priority: "Media",
    });

    expect(db.upserts.at(-1)).toMatchObject({
      name: "Lucas Ferreira",
      phone: "5548999990000",
      user_id: "user-1",
    });

    await waitFor(() => expect(result.current.leads.some((lead) => lead.name === "Lucas Ferreira")).toBe(true));

    await result.current.updateLead(db.leads[0].id, { priority: "Alta" });

    expect(db.upserts.at(-1)).toMatchObject({ priority: "Alta" });
  });

  it("deletes leads through Supabase delete", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.deleteLead("lead-1");

    expect(db.deletes).toContain("lead-1");
  });

  it("records last contact through lead update", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.recordLastContact("lead-1");

    expect(db.upserts.at(-1)).toMatchObject({ id: "lead-1" });
    expect((db.upserts.at(-1) as Lead).last_contact_at).toBeTruthy();
  });

  it("creates interaction and lets the Supabase trigger create its follow-up task", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.addInteraction(
      "lead-1",
      {
        interaction_type: "WhatsApp",
        responsible: "Tiago",
        description: "Cliente pediu retorno com proposta.",
        next_step: "Enviar proposta",
        next_contact_at: "2026-07-10T13:00:00.000Z",
      },
      { status: "Orcamento a enviar" },
    );

    expect(db.interactions[0]).toMatchObject({ lead_id: "lead-1", description: "Cliente pediu retorno com proposta." });
    expect(db.tasks).toHaveLength(0);
    expect(db.updates[0]).toMatchObject({
      table: "leads",
      id: "lead-1",
      payload: expect.objectContaining({ next_action_at: "2026-07-10T13:00:00.000Z", status: "Orcamento a enviar" }),
    });
  });

  it("marks a partner briefing notification as read through Supabase", async () => {
    db.notifications = [{
      id: "notification-1",
      user_id: "user-1",
      lead_id: "lead-1",
      type: "visit_briefing_assigned",
      title: "Novo briefing de visita",
      body: "Lead Cliente remoto.",
      read_at: null,
      created_at: "2026-07-15T12:00:00.000Z",
    }];
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.markPartnerNotificationRead("notification-1");

    expect(db.updates).toContainEqual(expect.objectContaining({
      table: "partner_notifications",
      id: "notification-1",
      payload: expect.objectContaining({ read_at: expect.any(String) }),
    }));
    await waitFor(() => expect(result.current.notifications[0]?.read_at).toEqual(expect.any(String)));
  });

  it("keeps the CRM available before the additive notification migration is applied", async () => {
    db.tableErrors.partner_notifications = {
      code: "PGRST205",
      message: "Could not find the table 'public.partner_notifications' in the schema cache",
    };

    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leads).toHaveLength(1);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.configurationError).toBeNull();
  });
});
