"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/app/lib/session";
import { executeManualTick } from "@/core/domains/habits";

/*
 * Done/Skip on the Today NEXT UP card (SAR-005, D-H). An explicit manual tap —
 * NEVER an estimate — persisted through the user-scoped repository (the id is only
 * updatable if it belongs to this user; SAR-003 scoping enforces that). This is the
 * plain plan-item update, NOT the capture commit/auto-check path (that is SAR-006).
 *
 * D-053 decision (c): this does NOT re-stamp `localDate` on completion. With the
 * clone-forward daily rollover (`core/plan/rollover.ts`), the card the user is actioning
 * is ALREADY today's freshly-materialized row, so its `localDate` is today — re-stamping
 * would rewrite a prior day's history for no gain. Status/`completionSource` only.
 */
export async function setItemStatus(id: string, status: "done" | "skipped"): Promise<void> {
  // Server actions are public endpoints — validate the arg at runtime (the type is
  // compile-time only). The repo is user-scoped, so a foreign id already fails closed.
  if (status !== "done" && status !== "skipped") {
    throw new Error(`invalid status '${status}'`);
  }
  const { repos } = await getSession();
  await repos.plans.items.update(id, { status, completionSource: "manual" });
  revalidatePath("/today");
}

/*
 * Manual tap-to-complete for a RULE-FREE habit on the Habits lens (SAR-009, D-A). The
 * same class of write as Done/Skip above — one explicit typed row toggle, NEVER the
 * capture commit path (no XP / domain_progress / undo envelope). The boundary invariant
 * is enforced server-side too: a rule-bearing habit (any active satisfaction rule) or a
 * day already claimed by a `satisfied-by` row REFUSES — the UI guard is not trusted.
 * The toggle mutates the day's single row in place (the full unique index does not
 * exclude tombstones), so a clear becomes `status:"skipped"`, never a soft-delete.
 * `localDate` is derived server-side (no backdating through this endpoint).
 */
export async function setHabitCompletion(habitId: string, next: "done" | "clear"): Promise<void> {
  // Server actions are public endpoints — validate both args at runtime (the types are
  // compile-time only). The repos are user-scoped, and `executeManualTick` re-checks the
  // rule-bearing / satisfied-by boundary server-side (defense in depth), so a forged
  // request cannot hand-tick a satisfied-by habit.
  if (typeof habitId !== "string" || habitId.length === 0) {
    throw new Error("invalid habitId");
  }
  if (next !== "done" && next !== "clear") {
    throw new Error(`invalid next '${next}'`);
  }
  const { repos } = await getSession();
  await executeManualTick(repos, habitId, next, new Date().toISOString());
  revalidatePath("/today");
}
