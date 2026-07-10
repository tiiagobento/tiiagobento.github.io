import { getOfflineDb, type LocalRecord } from "@/lib/offline/db";
import type { Interaction, Lead, MessageTemplate, Profile, Task } from "@/lib/types";

type CrmSnapshot = {
  leads: Lead[];
  interactions: Interaction[];
  tasks: Task[];
  templates: MessageTemplate[];
  profiles: Profile[];
};

function now() {
  return new Date().toISOString();
}

function toLocalRecord<T extends { id: string; user_id?: string | null }>(item: T, userId: string, status: LocalRecord<T>["sync_status"] = "synced"): LocalRecord<T> {
  const timestamp = now();
  return {
    id: item.id,
    remote_id: item.id,
    user_id: item.user_id ?? userId,
    data: { ...item, user_id: item.user_id ?? userId },
    created_at: "created_at" in item && typeof item.created_at === "string" ? item.created_at : timestamp,
    updated_at: "updated_at" in item && typeof item.updated_at === "string" ? item.updated_at : timestamp,
    sync_status: status,
    operation: status === "synced" ? null : "update",
    last_error: null,
  };
}

export async function saveCrmSnapshot(userId: string, snapshot: CrmSnapshot) {
  const db = getOfflineDb();
  if (!db) return;

  await db.transaction("rw", [db.leads, db.interactions, db.tasks, db.message_templates, db.profiles, db.dashboard_snapshots], async () => {
    await Promise.all([
      db.leads.bulkPut(snapshot.leads.map((lead) => toLocalRecord(lead, userId))),
      db.interactions.bulkPut(snapshot.interactions.map((interaction) => toLocalRecord(interaction, userId))),
      db.tasks.bulkPut(snapshot.tasks.map((task) => toLocalRecord(task, userId))),
      db.message_templates.bulkPut(snapshot.templates.map((template) => toLocalRecord(template, userId))),
      db.profiles.bulkPut(snapshot.profiles.map((profile) => toLocalRecord(profile, userId))),
      db.dashboard_snapshots.put({ id: `dashboard:${userId}`, user_id: userId, data: snapshot, updated_at: now() }),
    ]);
  });
}

export async function loadCrmSnapshot(userId: string): Promise<CrmSnapshot | null> {
  const db = getOfflineDb();
  if (!db) return null;

  const [leads, interactions, tasks, templates, profiles] = await Promise.all([
    db.leads.where("user_id").equals(userId).toArray(),
    db.interactions.where("user_id").equals(userId).toArray(),
    db.tasks.where("user_id").equals(userId).toArray(),
    db.message_templates.where("user_id").equals(userId).toArray(),
    db.profiles.where("user_id").equals(userId).toArray(),
  ]);

  return {
    leads: leads.filter((item) => item.operation !== "delete").map((item) => item.data),
    interactions: interactions.filter((item) => item.operation !== "delete").map((item) => item.data),
    tasks: tasks.filter((item) => item.operation !== "delete").map((item) => item.data),
    templates: templates.filter((item) => item.operation !== "delete").map((item) => item.data),
    profiles: profiles.filter((item) => item.operation !== "delete").map((item) => item.data),
  };
}

export async function putLocalRecord<T extends { id: string; user_id?: string | null }>(
  table: "leads" | "tasks" | "interactions" | "message_templates",
  item: T,
  userId: string,
  operation: "create" | "update" | "delete",
) {
  const db = getOfflineDb();
  if (!db) return;
  const record = {
    ...toLocalRecord(item, userId, "pending"),
    operation,
    last_error: null,
    updated_at: now(),
  };
  await db.table(table).put(record);
}
