import type { LocalRepositoryStorage } from "@mobile/db/types";

export type RepositoryMutationOperation = "create" | "update" | "softDelete";

export interface RepositoryMutation {
  table: string;
  id: string;
  operation: RepositoryMutationOperation;
  /** Captured only for an envelope created in the same committed transaction. */
  commitStatus?: string;
}

export interface RepositoryChange {
  userId: string;
  version: number;
  mutations: readonly RepositoryMutation[];
}

export type RepositoryChangeListener = (change: RepositoryChange) => void;

/**
 * A small external-store-compatible event rail. Versions live in local meta so
 * a screen can detect a restart/reopen without trusting a process-local number.
 */
export class RepositoryChangeStore {
  #listeners = new Set<RepositoryChangeListener>();
  #versions = new Map<string, number>();

  constructor(private readonly storage: LocalRepositoryStorage) {}

  async versionFor(userId: string): Promise<number> {
    const cached = this.#versions.get(userId);
    if (cached !== undefined) return cached;
    const persisted = Number((await this.storage.getMeta(`repository-version:${userId}`)) ?? "0");
    this.#versions.set(userId, persisted);
    return persisted;
  }

  subscribe(listener: RepositoryChangeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async publish(userId: string, mutations: readonly RepositoryMutation[]): Promise<RepositoryChange> {
    const version = await this.storage.bumpMetaCounter(
      `repository-version:${userId}`,
      new Date().toISOString(),
    );
    this.#versions.set(userId, version);
    const change: RepositoryChange = { userId, version, mutations };
    for (const listener of this.#listeners) listener(change);
    return change;
  }
}
