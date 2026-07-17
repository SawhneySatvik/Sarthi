"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/app/lib/session";

/*
 * Done/Skip on the Today NEXT UP card (SAR-005, D-H). An explicit manual tap —
 * NEVER an estimate — persisted through the user-scoped repository (the id is only
 * updatable if it belongs to this user; SAR-003 scoping enforces that). This is the
 * plain plan-item update, NOT the capture commit/auto-check path (that is SAR-006).
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
