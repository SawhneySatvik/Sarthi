import type { LocalRepositoryStorage } from "@mobile/db/types";

import { RepositoryChangeStore, type RepositoryMutation } from "./changes";
import { ConfirmedCommitOutbox } from "./outbox";

/**
 * A fresh scope is minted for every authenticated user. The immutable user id
 * is the only tenant value repository operations ever read; callers cannot
 * pass a user filter through a port.
 */
export class NativeRepositoryScope {
  #transactionDepth = 0;
  #pending: RepositoryMutation[] = [];

  constructor(
    readonly userId: string,
    readonly storage: LocalRepositoryStorage,
    private readonly changes: RepositoryChangeStore,
    private readonly outbox: ConfirmedCommitOutbox,
    private readonly createId: () => string,
  ) {}

  nextId(): string {
    return this.createId();
  }

  async record(mutation: RepositoryMutation): Promise<void> {
    this.#pending.push(mutation);
    if (this.#transactionDepth === 0) await this.flush();
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.#transactionDepth > 0) return work();
    this.#transactionDepth += 1;
    try {
      const result = await this.storage.transaction(work);
      await this.flush();
      return result;
    } catch (error) {
      this.#pending = [];
      throw error;
    } finally {
      this.#transactionDepth -= 1;
    }
  }

  private async flush(): Promise<void> {
    if (this.#pending.length === 0) return;
    const mutations = this.#pending;
    this.#pending = [];

    // This runs after `storage.transaction` resolves, never while writes are
    // speculative. A rollback clears pending mutations in transaction().
    await this.outbox.recordAfterCommit(this.userId, mutations);
    await this.changes.publish(this.userId, mutations);
  }
}
