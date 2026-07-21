import "server-only";

import type { AdminWaitlistRepository } from "@/core/contracts";
import type { WaitlistStatus } from "@/data/schema/contract";
import { createAuthProvider } from "@/providers/auth";

import {
  adminAccessAllowed,
  isAdminEmail,
  mayEmailSignUp,
  parseAdminEmails,
} from "./admin-policy";
import { getRuntimeConfig } from "./runtime";
import { adminWaitlistRepository } from "./session";

/*
 * app/lib/admin.ts — the WIRED PL-2 admin gate + signup gate (server-only).
 *
 * Feeds the pure decisions in `admin-policy.ts` with env (`ADMIN_EMAILS`), the authenticated
 * identity, and the unscoped admin waitlist repository. Both the /admin route and the signup
 * action re-enter through here so the gate is enforced server-side on every call — never trusted
 * from the client. Under `AUTH_PROVIDER` ≠ `supabase` the admin surface simply does not exist and
 * the signup gate is inert, so the anonymous demo / keyless default is byte-for-byte unchanged.
 */

/** The allowlist as configured for this server instance. */
function adminEmails(): ReadonlySet<string> {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

export interface AdminContext {
  email: string;
  repo: AdminWaitlistRepository;
}

/**
 * Gate for the /admin route + its server actions. Returns the admin context ONLY for an
 * authenticated, allowlisted admin under real (supabase) auth; otherwise raises `notFound()` so
 * the route 404s and never reveals it exists. `requireUser()` first bounces an unauthenticated
 * visitor to /login (defense-in-depth behind the middleware protection of non-public paths).
 */
export async function requireAdminContext(): Promise<AdminContext> {
  const config = getRuntimeConfig();
  if (config.authProvider !== "supabase") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  const user = await createAuthProvider(config.authProvider).requireUser();
  if (!adminAccessAllowed({ authProvider: config.authProvider, email: user.email, adminEmails: adminEmails() })) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return { email: user.email as string, repo: adminWaitlistRepository() };
}

/** What the signup gate decided, so the caller can word an honest "not yet" message. */
export interface SignupGateResult {
  allowed: boolean;
  /** True when the email is already recorded on the waitlist (any status). */
  onList: boolean;
}

/**
 * The selective-rollout signup gate. Under non-supabase auth the gate is INACTIVE (returns
 * allowed — those providers already refuse signUp elsewhere, so the default is untouched). Under
 * supabase: allowlisted admins bootstrap through; otherwise only `approved`/`invited` waitlist
 * emails may proceed. No side effects — it never writes, so a probe cannot spam rows.
 */
export async function checkSignupGate(email: string): Promise<SignupGateResult> {
  const config = getRuntimeConfig();
  if (config.authProvider !== "supabase") {
    return { allowed: true, onList: false };
  }
  const emails = adminEmails();
  // Admin bootstrap is checked BEFORE any DB read, so an admin can always sign in even if the
  // waitlist lookup below fails.
  if (isAdminEmail(email, emails)) {
    return { allowed: true, onList: false };
  }
  let status: WaitlistStatus | null;
  try {
    status = await adminWaitlistRepository().statusForEmail(email);
  } catch {
    // A transient lookup failure must NOT 500 the signup form or silently open the gate. Fail
    // CLOSED (the safe default for selective rollout): the caller shows the waitlist notice and
    // the user can retry. Admins are unaffected (handled above).
    return { allowed: false, onList: false };
  }
  return {
    allowed: mayEmailSignUp({ email, adminEmails: emails, waitlistStatus: status }),
    onList: status !== null,
  };
}
