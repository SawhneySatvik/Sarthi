import { encodeRow } from "@mobile/db/codec";
import type { LocalRepositoryStorage, SqliteCondition, SqlitePrimitive, SqliteRow } from "@mobile/db/types";
import { allTableDescriptors, schemaContract, type TableName } from "@schema/contract";

import type { InboundChange, SyncMutation, SyncQueueStore } from "./contracts";

const mutationTable = "sarthi_native_sync_mutations";
const watermarkTable = "sarthi_native_sync_watermarks";

type StoredMutation = {
  id: string;
  userId: string;
  idempotencyKey: string;
  tableName: string;
  operation: SyncMutation["operation"];
  payloadJson: string;
  createdAtMs: number;
  attempts: number;
  state: SyncMutation["state"];
};

function asString(row: SqliteRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Invalid native sync ${key}`);
  return value;
}

function asNumber(row: SqliteRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Invalid native sync ${key}`);
  return value;
}

function decodeMutation(row: SqliteRow): SyncMutation {
  const operation = asString(row, "operation");
  const state = asString(row, "state");
  if (!(["create", "update", "delete", "undo"] as const).includes(operation as SyncMutation["operation"])) {
    throw new Error("Invalid native sync operation");
  }
  if (state !== "pending" && state !== "sending") throw new Error("Invalid native sync state");
  return {
    id: asString(row, "id"),
    userId: asString(row, "userId"),
    idempotencyKey: asString(row, "idempotencyKey"),
    table: asString(row, "tableName"),
    operation: operation as SyncMutation["operation"],
    payload: JSON.parse(asString(row, "payloadJson")),
    createdAtMs: asNumber(row, "createdAtMs"),
    attempts: asNumber(row, "attempts"),
    state,
  };
}

function encodeMutation(mutation: SyncMutation): SqliteRow {
  return {
    id: mutation.id,
    userId: mutation.userId,
    idempotencyKey: mutation.idempotencyKey,
    tableName: mutation.table,
    operation: mutation.operation,
    payloadJson: JSON.stringify(mutation.payload),
    createdAtMs: mutation.createdAtMs,
    attempts: mutation.attempts,
    state: mutation.state,
  };
}

function descriptorFor(table: string) {
  return allTableDescriptors.find((descriptor) => descriptor.name === table) ?? null;
}

function primitive(value: unknown): SqlitePrimitive | null {
  if (typeof value === "string" || typeof value === "number" || value === null) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

function inputConditions(table: TableName, row: Record<string, unknown>): SqliteCondition[] | null {
  const descriptor = descriptorFor(table);
  if (!descriptor) return null;
  const conditions: SqliteCondition[] = [];
  for (const key of descriptor.primaryKey) {
    const value = primitive(row[key]);
    if (value === null && row[key] !== null) return null;
    conditions.push({ column: key, value });
  }
  return conditions;
}

function newer(existing: SqliteRow, incomingUpdatedAt: string): boolean {
  const current = existing.updatedAt ?? existing.createdAt;
  return typeof current === "string" && current > incomingUpdatedAt;
}

/**
 * SQLite-backed M4 queue and inbound projection store. The rows being synced are
 * always already-confirmed typed local rows; this adapter never sees capture cards.
 */
export class SqliteSyncQueueStore implements SyncQueueStore {
  constructor(private readonly storage: LocalRepositoryStorage) {}

  async listMutations(userId: string): Promise<SyncMutation[]> {
    return (await this.storage.select(mutationTable, [{ column: "userId", value: userId }]))
      .map((row) => decodeMutation(row));
  }

  async putMutation(mutation: SyncMutation): Promise<void> {
    const conditions = [{ column: "id", value: mutation.id }, { column: "userId", value: mutation.userId }];
    const existing = await this.storage.select(mutationTable, conditions);
    if (existing.length === 0) {
      await this.storage.insert(mutationTable, encodeMutation(mutation));
      return;
    }
    await this.storage.update(mutationTable, conditions, encodeMutation(mutation));
  }

  async deleteMutation(userId: string, id: string): Promise<void> {
    await this.storage.delete(mutationTable, [{ column: "userId", value: userId }, { column: "id", value: id }]);
  }

  async getWatermark(userId: string, table: string): Promise<string | null> {
    const rows = await this.storage.select(watermarkTable, [{ column: "userId", value: userId }, { column: "tableName", value: table }]);
    return typeof rows[0]?.watermark === "string" ? rows[0].watermark : null;
  }

  async applyInbound(userId: string, table: string, rows: InboundChange[], watermark: string | null): Promise<void> {
    const descriptor = descriptorFor(table);
    if (!descriptor) return;
    await this.storage.transaction(async () => {
      for (const change of rows) {
        if (change.table !== table || !change.row || typeof change.row !== "object") continue;
        const input = change.row as Record<string, unknown>;
        if (input.userId !== userId) continue;
        const conditions = inputConditions(table as TableName, input);
        if (!conditions) continue;
        try {
          // Inbound snapshots must still satisfy the exact shared typed contract.
          const validated = schemaContract[table as TableName].create.parse(input) as Record<string, unknown>;
          // Create schemas deliberately omit persistence-managed timestamps; a remote
          // snapshot must retain them for LWW and subsequent pulls.
          const persisted = {
            ...validated,
            ...(typeof input.createdAt === "string" ? { createdAt: input.createdAt } : {}),
            ...(typeof input.updatedAt === "string" ? { updatedAt: input.updatedAt } : {}),
            ...(input.deletedAt === null || typeof input.deletedAt === "string" ? { deletedAt: input.deletedAt } : {}),
          };
          const existing = await this.storage.select(table, conditions);
          if (existing[0] && newer(existing[0], change.updatedAt)) continue;
          const encoded = encodeRow(table as TableName, persisted) as SqliteRow;
          if (existing.length === 0) await this.storage.insert(table, encoded);
          else await this.storage.update(table, conditions, encoded);
        } catch {
          // A malformed remote row is never allowed to poison the local typed store.
        }
      }
      if (watermark !== null) {
        const conditions = [{ column: "userId", value: userId }, { column: "tableName", value: table }];
        const existing = await this.storage.select(watermarkTable, conditions);
        if (existing.length === 0) await this.storage.insert(watermarkTable, { userId, tableName: table, watermark });
        else await this.storage.update(watermarkTable, conditions, { watermark });
      }
    });
  }

  async purgeUser(userId: string): Promise<void> {
    await this.storage.transaction(async () => {
      for (const descriptor of allTableDescriptors) {
        await this.storage.delete(descriptor.name, [{ column: "userId", value: userId }]);
      }
      await this.storage.delete(mutationTable, [{ column: "userId", value: userId }]);
      await this.storage.delete(watermarkTable, [{ column: "userId", value: userId }]);
      await this.storage.delete("sarthi_native_outbox", [{ column: "userId", value: userId }]);
      await this.storage.delete("sarthi_native_meta", [{ column: "key", value: `repository-version:${userId}` }]);
    });
  }
}
