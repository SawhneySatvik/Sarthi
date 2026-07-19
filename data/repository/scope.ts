/**
 * data/repository/scope.ts — the per-request execution scope + transaction rail.
 *
 * A `ScopeContext` carries the immutable `userId` a request runs as plus the
 * *current* Drizzle executor. Outside a transaction the executor is the base
 * database; inside `runInTransaction` it is swapped to the transaction handle
 * so every repository call made by `work` participates in one atomic batch, and
 * restored afterwards. Repositories MUST read `ctx.getExecutor()` at call time
 * (never capture it) so the swap takes effect.
 *
 * Security: `userId` is the ONLY source of tenant scope. It is set once at
 * construction from the authenticated identity and is never derived from
 * caller-supplied input.
 */
import type { ResultSet } from "@libsql/client";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { SqliteDb } from "@/data/db/sqlite";
import type * as schema from "@/data/schema/sqlite";

/**
 * The common Drizzle surface shared by the base database and a transaction
 * handle (both extend this). Typed concretely against SQLite; the Postgres
 * composition root binds the same repository logic to its own executor later.
 */
export type SqliteExecutor = BaseSQLiteDatabase<"async", ResultSet, typeof schema>;

export class ScopeContext {
  /** The authenticated tenant. Immutable — never overwritten from input. */
  readonly userId: string;

  /** The live executor: base db, or the tx handle while a transaction runs. */
  #executor: SqliteExecutor;

  constructor(userId: string, executor: SqliteExecutor) {
    this.userId = userId;
    this.#executor = executor;
  }

  /** The executor to run against right now. Read this at call time, per op. */
  getExecutor(): SqliteExecutor {
    return this.#executor;
  }

  /**
   * Internal: swap the live executor. Only `runInTransaction` calls this — to
   * point the scope at the tx handle and then restore the base db.
   */
  setExecutor(executor: SqliteExecutor): void {
    this.#executor = executor;
  }
}

/**
 * Backs `UserScopedRepositories.transaction`. Points `ctx` at the tx handle for
 * the duration of `work`, then restores the base db. libSQL runs the callback
 * in a real transaction: a throw inside `work` rolls the whole batch back.
 */
export async function runInTransaction<T>(
  db: SqliteDb,
  ctx: ScopeContext,
  work: () => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    ctx.setExecutor(tx);
    try {
      return await work();
    } finally {
      ctx.setExecutor(db);
    }
  });
}
