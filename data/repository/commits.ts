/**
 * data/repository/commits.ts — guarded audit-state transitions for the commit
 * envelope (D-E / NB-4).
 *
 * The `commits` table is otherwise append-only (built via
 * `createAppendOnlyRepository`). Undo and supersede are the ONLY mutations the
 * audit group permits, and they touch only the envelope's lifecycle `status`
 * (+ `undoneAt`) — never the business payload, and never the true ledgers
 * (`commit_rows` / the effect tables), which have no mutation surface at all.
 *
 * The guard is ATOMIC and race-free: the `status = 'committed'` predicate lives
 * in the WHERE clause alongside the tenant scope, so a wrong from-state (already
 * undone/superseded) or a foreign/absent id simply matches zero rows and throws —
 * there is no read-then-write window. `userId` is sourced only from `ctx`.
 */
import { and, eq } from "drizzle-orm";

import { RepositoryError } from "@/core/contracts/errors";
import type { CommitRecord } from "@/data/schema/contract";
import { commits } from "@/data/schema/sqlite";

import { updateRows } from "./base";
import type { ScopeContext } from "./scope";

export interface CommitStateTransitions {
  markUndone(commitId: string, undoneAt: string): Promise<CommitRecord>;
  markSuperseded(commitId: string): Promise<CommitRecord>;
}

/**
 * Build the two guarded transitions for one already-scoped request. Bound to the
 * same `ScopeContext` as the rest of the repository surface, so it reads the
 * current executor at call time and participates in an open `transaction()`.
 */
export function createCommitStateTransitions(ctx: ScopeContext): CommitStateTransitions {
  const transition = async (
    commitId: string,
    set: Record<string, unknown>,
  ): Promise<CommitRecord> => {
    const rows = await updateRows<CommitRecord>(
      ctx.getExecutor(),
      commits,
      set,
      and(
        eq(commits.id, commitId),
        eq(commits.userId, ctx.userId),
        eq(commits.status, "committed"),
      ),
    );
    const row = rows[0];
    if (!row) {
      throw new RepositoryError(
        `commits ${commitId}: not found, not owned, or not in 'committed' state`,
      );
    }
    return row;
  };

  return {
    markUndone: (commitId, undoneAt) => transition(commitId, { status: "undone", undoneAt }),
    markSuperseded: (commitId) => transition(commitId, { status: "superseded" }),
  };
}
