import Dexie, { type Table } from "dexie";
import type { Interaction, Lead, MessageTemplate, Profile, Task } from "@/lib/types";

export type OfflineEntity = "leads" | "tasks" | "interactions" | "message_templates";
export type SyncStatus = "synced" | "pending" | "conflict" | "failed";
export type OfflineOperation = "create" | "update" | "delete";

export type LocalRecord<T> = {
  id: string;
  remote_id?: string | null;
  user_id: string;
  data: T;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  operation?: OfflineOperation | null;
  last_error?: string | null;
};

export type PendingOperation = {
  id: string;
  entity: OfflineEntity;
  entity_id: string;
  remote_id?: string | null;
  user_id: string;
  operation: OfflineOperation;
  data: unknown;
  status: Extract<SyncStatus, "pending" | "failed" | "conflict">;
  attempts: number;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
};

export type DashboardSnapshot = {
  id: string;
  user_id: string;
  data: unknown;
  updated_at: string;
};

export type LocalProfile = LocalRecord<Profile>;
export type LocalLead = LocalRecord<Lead>;
export type LocalTask = LocalRecord<Task>;
export type LocalInteraction = LocalRecord<Interaction>;
export type LocalTemplate = LocalRecord<MessageTemplate>;

class NovaFormaOfflineDb extends Dexie {
  leads!: Table<LocalLead, string>;
  tasks!: Table<LocalTask, string>;
  interactions!: Table<LocalInteraction, string>;
  message_templates!: Table<LocalTemplate, string>;
  profiles!: Table<LocalProfile, string>;
  dashboard_snapshots!: Table<DashboardSnapshot, string>;
  pending_operations!: Table<PendingOperation, string>;

  constructor() {
    super("nova-forma-crm-offline");
    this.version(1).stores({
      leads: "id, remote_id, user_id, sync_status, updated_at",
      tasks: "id, remote_id, user_id, sync_status, updated_at, data.lead_id",
      interactions: "id, remote_id, user_id, sync_status, created_at, data.lead_id",
      message_templates: "id, remote_id, user_id, sync_status, updated_at",
      profiles: "id, remote_id, user_id, sync_status, updated_at",
      dashboard_snapshots: "id, user_id, updated_at",
      pending_operations: "id, entity, entity_id, user_id, status, created_at",
    });
  }
}

let db: NovaFormaOfflineDb | null = null;

export function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function getOfflineDb() {
  if (!isBrowserStorageAvailable()) return null;
  db ??= new NovaFormaOfflineDb();
  return db;
}

export async function clearOfflineDbForUser(userId: string) {
  const database = getOfflineDb();
  if (!database) return;
  await Promise.all([
    database.leads.where("user_id").equals(userId).delete(),
    database.tasks.where("user_id").equals(userId).delete(),
    database.interactions.where("user_id").equals(userId).delete(),
    database.message_templates.where("user_id").equals(userId).delete(),
    database.profiles.where("user_id").equals(userId).delete(),
    database.dashboard_snapshots.where("user_id").equals(userId).delete(),
    database.pending_operations.where("user_id").equals(userId).delete(),
  ]);
}
