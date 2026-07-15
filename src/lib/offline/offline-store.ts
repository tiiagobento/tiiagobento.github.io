import { getOfflineDb, type LocalRecord } from "@/lib/offline/db";
import type { Interaction, Lead, MessageTemplate, Profile, Task } from "@/lib/types";

export type CrmSnapshot = {
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
    // The IndexedDB record belongs to the authenticated device user. The
    // payload keeps its original owner, which can be a different user for a
    // partner-assigned lead.
    user_id: userId,
    data: { ...item },
    created_at: "created_at" in item && typeof item.created_at === "string" ? item.created_at : timestamp,
    updated_at: "updated_at" in item && typeof item.updated_at === "string" ? item.updated_at : timestamp,
    sync_status: status,
    operation: status === "synced" ? null : "update",
    last_error: null,
  };
}

type SnapshotTable = "leads" | "interactions" | "tasks" | "message_templates" | "profiles";

async function mergeSnapshotTable<T extends { id: string; user_id?: string | null }>(
  tableName: SnapshotTable,
  userId: string,
  remoteItems: T[],
) {
  const db = getOfflineDb();
  if (!db) return remoteItems;

  const table = db.table<LocalRecord<T>, string>(tableName);
  const localRecords = await table.where("user_id").equals(userId).toArray();
  const localChanges = new Map(
    localRecords
      .filter((record) => record.sync_status !== "synced" || record.operation)
      .map((record) => [record.id, record]),
  );
  const remoteIds = new Set(remoteItems.map((item) => item.id));

  const recordsToSave = remoteItems
    .filter((item) => !localChanges.has(item.id))
    .map((item) => toLocalRecord(item, userId));

  const staleSyncedIds = localRecords
    .filter((record) => record.sync_status === "synced" && !record.operation && !remoteIds.has(record.id))
    .map((record) => record.id);

  if (recordsToSave.length) await table.bulkPut(recordsToSave);
  if (staleSyncedIds.length) await table.bulkDelete(staleSyncedIds);

  return [...remoteItems.filter((item) => !localChanges.has(item.id)), ...[...localChanges.values()]
    .filter((record) => record.operation !== "delete")
    .map((record) => record.data)];
}

export async function saveCrmSnapshot(userId: string, snapshot: CrmSnapshot): Promise<CrmSnapshot> {
  const db = getOfflineDb();
  if (!db) return snapshot;

  await db.transaction("rw", [db.leads, db.interactions, db.tasks, db.message_templates, db.profiles, db.dashboard_snapshots], async () => {
    const [leads, interactions, tasks, templates, profiles] = await Promise.all([
      mergeSnapshotTable("leads", userId, snapshot.leads),
      mergeSnapshotTable("interactions", userId, snapshot.interactions),
      mergeSnapshotTable("tasks", userId, snapshot.tasks),
      mergeSnapshotTable("message_templates", userId, snapshot.templates),
      mergeSnapshotTable("profiles", userId, snapshot.profiles),
    ]);

    const mergedSnapshot = { leads, interactions, tasks, templates, profiles } as CrmSnapshot;
    await db.dashboard_snapshots.put({ id: `dashboard:${userId}`, user_id: userId, data: mergedSnapshot, updated_at: now() });
  });

  return loadCrmSnapshot(userId).then((localSnapshot) => localSnapshot ?? snapshot);
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

export async function putSyncedLocalRecord<T extends { id: string; user_id?: string | null }>(
  table: "leads" | "tasks" | "interactions" | "message_templates",
  item: T,
  userId: string,
) {
  const db = getOfflineDb();
  if (!db) return;
  await db.table(table).put(toLocalRecord(item, userId, "synced"));
}
