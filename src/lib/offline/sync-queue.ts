import { getOfflineDb, type OfflineEntity, type OfflineOperation, type PendingOperation } from "@/lib/offline/db";
import { putLocalRecord } from "@/lib/offline/offline-store";
import { supabase } from "@/lib/supabase/client";

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export type SyncSummary = {
  pending: number;
  failed: number;
  conflict: number;
  operations: PendingOperation[];
};

export async function enqueueOperation(input: {
  entity: OfflineEntity;
  entityId: string;
  userId: string;
  operation: OfflineOperation;
  data: unknown;
  remoteId?: string | null;
}) {
  const db = getOfflineDb();
  if (!db) return null;
  const timestamp = now();
  const operation: PendingOperation = {
    id: uuid(),
    entity: input.entity,
    entity_id: input.entityId,
    remote_id: input.remoteId ?? input.entityId,
    user_id: input.userId,
    operation: input.operation,
    data: input.data,
    status: "pending",
    attempts: 0,
    created_at: timestamp,
    updated_at: timestamp,
    last_error: null,
  };
  await db.pending_operations.put(operation);
  window.dispatchEvent(new CustomEvent("novaforma:sync-queue-changed"));
  return operation;
}

export async function getSyncSummary(userId?: string | null): Promise<SyncSummary> {
  const db = getOfflineDb();
  if (!db || !userId) return { pending: 0, failed: 0, conflict: 0, operations: [] };
  const operations = await db.pending_operations.where("user_id").equals(userId).toArray();
  return {
    pending: operations.filter((item) => item.status === "pending").length,
    failed: operations.filter((item) => item.status === "failed").length,
    conflict: operations.filter((item) => item.status === "conflict").length,
    operations,
  };
}

function getTableName(entity: OfflineEntity) {
  return entity;
}

async function runOperation(operation: PendingOperation) {
  if (!supabase) throw new Error("Supabase nao configurado.");
  const table = getTableName(operation.entity);

  if (operation.operation === "delete") {
    const { error } = await supabase.from(table).delete().eq("id", operation.remote_id ?? operation.entity_id);
    if (error) throw error;
    return null;
  }

  const payload = { ...(operation.data as Record<string, unknown>), id: operation.remote_id ?? operation.entity_id, user_id: operation.user_id };
  const { data, error } = await supabase.from(table).upsert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function syncPendingOperations(userId: string) {
  const db = getOfflineDb();
  if (!db) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const operations = await db.pending_operations.where("user_id").equals(userId).and((item) => item.status !== "conflict").sortBy("created_at");
  let synced = 0;
  let failed = 0;

  for (const operation of operations) {
    try {
      const data = await runOperation(operation);
      await db.pending_operations.delete(operation.id);
      if (operation.operation === "delete") {
        await db.table(operation.entity).delete(operation.entity_id);
      } else if (data && typeof data === "object" && "id" in data) {
        await putLocalRecord(operation.entity, data as { id: string; user_id?: string | null }, operation.user_id, "update");
        await db.table(operation.entity).update(operation.entity_id, { sync_status: "synced", operation: null, last_error: null });
      }
      synced += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Erro ao sincronizar.";
      await db.pending_operations.update(operation.id, {
        status: "failed",
        attempts: operation.attempts + 1,
        updated_at: now(),
        last_error: message,
      });
      await db.table(operation.entity).update(operation.entity_id, { sync_status: "failed", last_error: message });
    }
  }

  window.dispatchEvent(new CustomEvent("novaforma:sync-queue-changed"));
  return { synced, failed };
}

export async function retryFailedOperations(userId: string) {
  const db = getOfflineDb();
  if (!db) return;
  const failed = await db.pending_operations.where("user_id").equals(userId).and((item) => item.status === "failed").toArray();
  await Promise.all(failed.map((item) => db.pending_operations.update(item.id, { status: "pending", updated_at: now(), last_error: null })));
  window.dispatchEvent(new CustomEvent("novaforma:sync-queue-changed"));
}

export async function discardPendingOperation(operationId: string) {
  const db = getOfflineDb();
  if (!db) return;
  await db.pending_operations.delete(operationId);
  window.dispatchEvent(new CustomEvent("novaforma:sync-queue-changed"));
}
