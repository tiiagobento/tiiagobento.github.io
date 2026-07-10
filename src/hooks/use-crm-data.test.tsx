import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leadFixture } from "@/test/fixtures";
import type { Lead } from "@/lib/types";

const db = vi.hoisted(() => ({
  leads: [] as Lead[],
  interactions: [] as unknown[],
  tasks: [] as unknown[],
  templates: [] as unknown[],
  profiles: [{ id: "user-1", name: "Tiago", email: "tiago@example.com", role: "admin" }],
  upserts: [] as unknown[],
  deletes: [] as string[],
  updates: [] as unknown[],
}));

function createTableBuilder(table: string) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(async () => ({ data: db[table as keyof typeof db] ?? [], error: null })),
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
    update: vi.fn((payload: Partial<Lead>) => ({
      eq: vi.fn(async (_column: string, id: string) => {
        db.updates.push({ table, id, payload });
        db.leads = db.leads.map((lead) => (lead.id === id ? { ...lead, ...payload } : lead));
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
  loadCrmSnapshot: vi.fn(async () => null),
  putLocalRecord: vi.fn(async () => undefined),
  saveCrmSnapshot: vi.fn(async () => undefined),
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
    db.upserts = [];
    db.deletes = [];
    db.updates = [];
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "tiago@example.com" } }, error: null });
    supabaseMocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1", email: "tiago@example.com" } } }, error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
    supabaseMocks.from.mockImplementation((table: string) => createTableBuilder(table));
  });

  it("creates and edits leads through Supabase upsert", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveLead({
        name: "Lucas Ferreira",
        phone: "(48) 99999-0000",
        first_contact_date: "2026-07-07",
        source: "Site",
        status: "Novo lead",
        priority: "Media",
      });
    });

    expect(db.upserts.at(-1)).toMatchObject({
      name: "Lucas Ferreira",
      phone: "5548999990000",
      user_id: "user-1",
    });

    await act(async () => {
      await result.current.updateLead(db.leads[0].id, { priority: "Alta" });
    });

    expect(db.upserts.at(-1)).toMatchObject({ priority: "Alta" });
  });

  it("deletes leads through Supabase delete", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteLead("lead-1");
    });

    expect(db.deletes).toContain("lead-1");
  });

  it("records last contact through lead update", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.recordLastContact("lead-1");
    });

    expect(db.upserts.at(-1)).toMatchObject({ id: "lead-1" });
    expect((db.upserts.at(-1) as Lead).last_contact_at).toBeTruthy();
  });

  it("creates interaction, updates lead last contact and creates follow-up task", async () => {
    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addInteraction("lead-1", {
        interaction_type: "WhatsApp",
        responsible: "Tiago",
        description: "Cliente pediu retorno com proposta.",
        next_step: "Enviar proposta",
        next_contact_at: "2026-07-10T13:00:00.000Z",
      });
    });

    expect(db.interactions[0]).toMatchObject({ lead_id: "lead-1", description: "Cliente pediu retorno com proposta." });
    expect(db.tasks[0]).toMatchObject({ lead_id: "lead-1", title: "Follow-up: Enviar proposta", status: "pendente" });
    expect(db.updates[0]).toMatchObject({
      table: "leads",
      id: "lead-1",
      payload: expect.objectContaining({ next_action_at: "2026-07-10T13:00:00.000Z" }),
    });
  });
});
