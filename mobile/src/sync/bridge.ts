import { decodeRow } from "@mobile/db/codec";
import type { LocalRepositoryStorage } from "@mobile/db/types";
import type { TableName } from "@schema/contract";

import type { ConfirmedCommitOutbox } from "@mobile/adapters/repository";

import { NativeSyncEngine } from "./engine";

function conditionsFor(table: TableName, id: string, userId: string) {
  return table === "profiles"
    ? [{ column: "userId", value: userId }]
    : [{ column: "userId", value: userId }, { column: "id", value: id }];
}

/**
 * Turns the post-transaction repository outbox into durable M4 mutations.
 * It runs after local success only, snapshots typed rows, and deliberately has
 * no path for in-memory CaptureDraft cards or unaccepted estimates.
 */
export class ConfirmedOutboxSyncBridge {
  constructor(
    private readonly storage: LocalRepositoryStorage,
    private readonly outbox: ConfirmedCommitOutbox,
    private readonly engine: NativeSyncEngine,
  ) {}

  async enqueueConfirmed(userId: string): Promise<number> {
    const entries = await this.outbox.list(userId);
    let queued = 0;
    for (const entry of entries) {
      if (entry.state !== "pending") continue;
      for (const mutation of entry.mutations) {
        const table = mutation.table as TableName;
        const rows = await this.storage.select(table, conditionsFor(table, mutation.id, userId));
        const row = rows[0];
        // A missing row can be an obsolete local write; never invent a remote payload.
        if (!row) continue;
        await this.engine.enqueue({
          userId,
          idempotencyKey: `${entry.commitId}:${mutation.table}:${mutation.id}:${mutation.operation}`,
          table: mutation.table,
          operation: mutation.operation === "softDelete" ? "delete" : mutation.operation,
          payload: decodeRow<Record<string, unknown>>(table, row),
        });
        queued += 1;
      }
      await this.outbox.markQueued(userId, entry.id);
    }
    return queued;
  }
}
