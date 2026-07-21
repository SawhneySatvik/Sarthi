/**
 * data/repository/admin.ts — the DELIBERATELY UNSCOPED admin waitlist seam (PL-2).
 *
 * The per-user repositories in `base.ts` are always `eq(userId, ctx.userId)`-scoped, so no
 * tenant can enumerate the whole waitlist. Selective rollout needs exactly that: list every
 * email, and flip one row's lifecycle status. This module provides that as a typed repository
 * (invariant #5 — no raw SQL escapes into routes; the ONLY difference from `base.ts` is the
 * absence of a tenant filter, which is correct because `waitlist.userId` is metadata, never a
 * scope key). It is handed out ONLY behind the authenticated + allowlisted admin gate in
 * `app/lib/admin.ts`; nothing reaches it through `RepositoryFactory.forUser`.
 *
 * Dialect-agnostic like `base.ts`: the query LOGIC runs unchanged over SQLite (dev) and the
 * Postgres executor (prod); ORM-boundary casts stay confined to the tiny run helpers here.
 */
import { eq, getTableColumns, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import { RepositoryError } from "@/core/contracts/errors";
import type { AdminWaitlistRepository } from "@/core/contracts/repositories";
import { waitlistStatusEnum, type WaitlistRecord, type WaitlistStatus } from "@/data/schema/contract";

import type { SqliteExecutor } from "./scope";

type Row = Record<string, unknown>;

/** Normalize an email the same way the public waitlist stores it (lower + trim). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ── ORM-boundary run helpers (the only casts) — mirror base.ts, minus tenant scope. */
interface SelectRunner {
  from(table: SQLiteTable): { where(where: SQL | undefined): Promise<Row[]> };
}
interface UpdateRunner {
  set(values: Row): { where(where: SQL | undefined): { returning(): Promise<Row[]> } };
}

async function selectRows(executor: SqliteExecutor, table: SQLiteTable, where: SQL | undefined): Promise<Row[]> {
  const runner = executor.select() as unknown as SelectRunner;
  return runner.from(table).where(where);
}

/**
 * Build the admin waitlist repository over a shared executor + the active dialect's `waitlist`
 * table. `executor` is the shared db handle (never a tenant `ScopeContext`), so every query
 * spans ALL rows — the whole point of this seam.
 */
export function createAdminWaitlistRepository(
  executor: SqliteExecutor,
  waitlistTable: SQLiteTable,
): AdminWaitlistRepository {
  const columns = getTableColumns(waitlistTable) as unknown as Record<string, SQLiteColumn>;

  const listAll = async (): Promise<readonly WaitlistRecord[]> => {
    const rows = (await selectRows(executor, waitlistTable, undefined)) as unknown as WaitlistRecord[];
    // Order most-recent-first in JS — dialect-agnostic and the waitlist is small (admin surface).
    return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  };

  const statusForEmail = async (email: string): Promise<WaitlistStatus | null> => {
    const rows = await selectRows(executor, waitlistTable, eq(columns.email, normalizeEmail(email) as never));
    const row = rows[0];
    if (!row) return null;
    // Defensive parse: a legacy/foreign value must not silently pass as a known status.
    const parsed = waitlistStatusEnum.safeParse(row.status);
    return parsed.success ? parsed.data : null;
  };

  const updateStatus = async (id: string, status: WaitlistStatus): Promise<WaitlistRecord> => {
    const nextStatus = waitlistStatusEnum.parse(status);
    const runner = executor.update(waitlistTable) as unknown as UpdateRunner;
    const rows = (await runner
      .set({ status: nextStatus })
      .where(eq(columns.id, id as never))
      .returning()) as unknown as WaitlistRecord[];
    const updated = rows[0];
    if (!updated) {
      throw new RepositoryError(`waitlist: no row ${id} to update`);
    }
    return updated;
  };

  return { listAll, statusForEmail, updateStatus };
}
