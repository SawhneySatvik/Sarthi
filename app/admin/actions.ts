"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/app/lib/admin";
import type { WaitlistStatus } from "@/data/schema/contract";

/*
 * app/admin/actions.ts — PL-2 admin mutations. Every action RE-ENTERS `requireAdminContext()`
 * (which re-verifies supabase auth + the ADMIN_EMAILS allowlist) before touching a row, so the
 * gate is enforced server-side on each call and is never trusted from the client. `id` arrives
 * from the row's hidden form field; the unscoped admin repo flips exactly that row's status.
 */
async function setStatus(formData: FormData, status: WaitlistStatus): Promise<void> {
  const { repo } = await requireAdminContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await repo.updateStatus(id, status);
  revalidatePath("/admin");
}

/** Approve an email — opens the signup gate for it. */
export async function approveEntry(formData: FormData): Promise<void> {
  await setStatus(formData, "approved");
}

/** Reject an email — keeps the signup gate closed. */
export async function rejectEntry(formData: FormData): Promise<void> {
  await setStatus(formData, "rejected");
}

/**
 * Generate an invite: mark the email `invited` (approved + notified). This is the tokenless
 * "this email may now sign up" invite — the admin sends the mail out of band; the status is the
 * durable record that the gate now lets them in.
 */
export async function inviteEntry(formData: FormData): Promise<void> {
  await setStatus(formData, "invited");
}
