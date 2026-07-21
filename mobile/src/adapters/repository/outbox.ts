import type { LocalOutboxRow, LocalRepositoryStorage } from "@mobile/db/types";

import type { RepositoryMutation } from "./changes";

export interface ConfirmedOutboxEntry {
  id: string;
  userId: string;
  commitId: string;
  mutations: readonly RepositoryMutation[];
  createdAt: string;
  state: "pending" | "acked";
}

/**
 * Local sync preparation only. It is intentionally NOT a general offline queue:
 * an entry is created only after the transaction that wrote a `committed`
 * envelope has returned successfully. M4 owns replay, idempotency and remote
 * acknowledgement.
 */
export class ConfirmedCommitOutbox {
  constructor(
    private readonly storage: LocalRepositoryStorage,
    private readonly createId: () => string,
  ) {}

  async recordAfterCommit(
    userId: string,
    mutations: readonly RepositoryMutation[],
  ): Promise<void> {
    const envelope = mutations.find(
      (mutation) => mutation.table === "commits" && mutation.operation === "create" && mutation.commitStatus === "committed",
    );
    if (!envelope) return;

    const createdAt = new Date().toISOString();
    await this.storage.insertConfirmedOutbox({
      id: this.createId(),
      userId,
      commitId: envelope.id,
      payloadJson: JSON.stringify({ version: 1, commitId: envelope.id, mutations }),
      createdAt,
      state: "pending",
    });
  }

  async list(userId: string): Promise<readonly ConfirmedOutboxEntry[]> {
    const rows = await this.storage.listConfirmedOutbox(userId);
    return rows.map((row) => this.decode(row));
  }

  private decode(row: LocalOutboxRow): ConfirmedOutboxEntry {
    const payload = JSON.parse(row.payloadJson) as { mutations: RepositoryMutation[] };
    return {
      id: row.id,
      userId: row.userId,
      commitId: row.commitId,
      mutations: payload.mutations,
      createdAt: row.createdAt,
      state: row.state,
    };
  }
}
