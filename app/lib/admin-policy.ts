/**
 * app/lib/admin-policy.ts — the PURE decisions behind the PL-2 admin gate + signup gate.
 *
 * Deliberately a leaf module: NO `server-only`, NO next/supabase imports, NO env reads. The
 * wired server helpers (`app/lib/admin.ts`) feed it env + repository data; keeping the security
 * decisions pure lets them be unit-tested keyless (mirrors the `components/auth/types.ts` split).
 */
import type { WaitlistStatus } from "@/data/schema/contract";

/** The waitlist statuses that OPEN the signup gate. `pending`/`rejected`/absent stay closed. */
const OPEN_STATUSES: ReadonlySet<WaitlistStatus> = new Set(["approved", "invited"]);

/** Normalize an email for comparison the same way the waitlist stores it (lower + trim). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Parse the comma-separated `ADMIN_EMAILS` allowlist into a normalized set. Blank/absent → empty
 * set (nobody is an admin — the strict default), so a mis-set env never silently grants access.
 */
export function parseAdminEmails(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter((entry) => entry.length > 0),
  );
}

/** True when `email` is on the admin allowlist (normalized compare). */
export function isAdminEmail(email: string, adminEmails: ReadonlySet<string>): boolean {
  return adminEmails.has(normalizeEmail(email));
}

/**
 * The /admin route gate decision. Admin is reachable ONLY under real auth (`supabase`) AND when
 * the authenticated email is allowlisted. Anonymous/local modes and any non-listed email → denied
 * (the caller renders a 404 — never revealing the route exists).
 */
export function adminAccessAllowed(input: {
  authProvider: string;
  email: string | null | undefined;
  adminEmails: ReadonlySet<string>;
}): boolean {
  if (input.authProvider !== "supabase") return false;
  if (!input.email) return false;
  return isAdminEmail(input.email, input.adminEmails);
}

/**
 * The signup gate decision (selective rollout). An email may complete signup when it is either an
 * allowlisted admin (bootstrap escape — so the first admin can sign in) OR its waitlist status is
 * `approved`/`invited`. Everything else (never joined → null, still `pending`, or `rejected`) is
 * held back with the "you're on the waitlist" message — never an account.
 */
export function mayEmailSignUp(input: {
  email: string;
  adminEmails: ReadonlySet<string>;
  waitlistStatus: WaitlistStatus | null;
}): boolean {
  if (isAdminEmail(input.email, input.adminEmails)) return true;
  return input.waitlistStatus !== null && OPEN_STATUSES.has(input.waitlistStatus);
}
