/**
 * data/repository/coach-memory.ts — the durable memory repository (COACH-1, Layer 2).
 *
 * `coach_memory` is neither a plain mutable table nor an append-only one: its
 * CONTENT (`text`/`kind`/`domain`) is immutable post-create, but a small
 * lifecycle/bookkeeping surface (`pinned` / `useCount` / `lastUsedAt` / `retired`)
 * is updatable — and rows are RETIRED, never deleted. So it reuses the append-only
 * primitive for create/byId/list and adds ONE bounded update, validated against the
 * `coachMemoryUpdate` Zod schema before it ever reaches SQL (invariant #6: a bounded
 * update surface, never a generic event log). There is no `softDelete`.
 *
 * The guard is atomic and race-free: the tenant scope (`userId = ctx.userId`) lives
 * in the WHERE clause alongside the id, so a foreign/absent id simply matches zero
 * rows and throws. `userId` is sourced ONLY from `ctx` (D-D). The table handle is
 * injected by the composition root so the Postgres branch binds the SAME logic to
 * its own dialect table (mirrors `createCommitStateTransitions`).
 */
import { and, eq } from "drizzle-orm";

import { RepositoryError } from "@/core/contracts/errors";
import type { CoachMemoryRepository } from "@/core/contracts/repositories";
import {
  coachMemoryUpdate,
  type CoachMemoryCreate,
  type CoachMemoryQuery,
  type CoachMemoryRecord,
  type CoachMemoryUpdate,
} from "@/data/schema/contract";
import { coachMemory } from "@/data/schema/sqlite";

import { createAppendOnlyRepository, updateRows } from "./base";
import type { ScopeContext } from "./scope";

/**
 * Assemble the `coach_memory` repository for one already-scoped request. `create`/
 * `byId`/`list` come straight from the append-only primitive (immutable base: no
 * `updatedAt` stamped, no `deletedAt`); `update` is the bounded lifecycle mutation.
 */
export function createCoachMemoryRepository(
  ctx: ScopeContext,
  table: typeof coachMemory = coachMemory,
): CoachMemoryRepository {
  const base = createAppendOnlyRepository<CoachMemoryRecord, CoachMemoryCreate, CoachMemoryQuery>(
    "coach_memory",
    table,
    ctx,
  );

  const update = async (id: string, patch: CoachMemoryUpdate): Promise<CoachMemoryRecord> => {
    // Parse strips anything outside the bounded surface — text/kind/domain can
    // NEVER be mutated here, so a poisoned patch is inert.
    const validated = coachMemoryUpdate.parse(patch) as Record<string, unknown>;
    delete validated.userId;
    delete validated.id;

    // An empty (or fully-stripped) patch is a no-op; return the current row so a
    // caller never gets a spurious "not found" for a valid but empty update.
    if (Object.keys(validated).length === 0) {
      const current = await base.byId(id);
      if (!current) {
        throw new RepositoryError(`coach_memory ${id}: not found for this user`);
      }
      return current;
    }

    const rows = await updateRows<CoachMemoryRecord>(
      ctx.getExecutor(),
      table,
      validated,
      and(eq(table.id, id), eq(table.userId, ctx.userId)),
    );
    if (rows.length === 0) {
      throw new RepositoryError(
        `coach_memory ${id}: no row for this user (not found or not owned)`,
      );
    }
    return rows[0];
  };

  return {
    create: base.create,
    byId: base.byId,
    list: base.list,
    update,
  };
}
