import type { RepositoryChange, RepositoryChangeListener } from "@mobile/adapters/repository";

/**
 * Tiny framework-neutral external-store bridge. A React screen can adapt this
 * with `useSyncExternalStore`; keeping it outside the repository means the core
 * and adapter work unchanged in tests and in future native surfaces.
 */
export class RepositoryVersionStore {
  #versions = new Map<string, number>();
  #listeners = new Set<RepositoryChangeListener>();

  getVersion(userId: string): number {
    return this.#versions.get(userId) ?? 0;
  }

  subscribe(listener: RepositoryChangeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  receive(change: RepositoryChange): void {
    this.#versions.set(change.userId, change.version);
    for (const listener of this.#listeners) listener(change);
  }
}
