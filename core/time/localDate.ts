/**
 * core/time/localDate.ts — the ONE shared local-day module (D-053, UIE-0a).
 *
 * Every day-key read/write boundary (Today read, coach-note query, plan rollover,
 * onboarding accept, capture vision ramp) must agree on "what local day is it" —
 * before UIE-0a the trick was copy-pasted into three private helpers and the Today
 * read used a UTC slice, so writes stamped the local day and the read looked at the
 * UTC day (`docs/ui-audit/UI-AUDIT-01.md` C6). This module is the single source of
 * truth for that conversion so the mismatch cannot re-appear.
 *
 * Framework-import-clean (invariant #9): `Intl` and `Date` are JS globals, not a
 * framework import — this file imports NOTHING, so the mobile bake-off winner can
 * lift it into a shared package mechanically. Every function is pure (no clock read):
 * given the same arguments it always returns the same value.
 */

/**
 * `localDate` (YYYY-MM-DD) for a UTC instant in an IANA zone. `en-CA` formats a date
 * as ISO `YYYY-MM-DD`, so this is the timezone-correct "what calendar day is it there".
 * Lifted verbatim from the (now-deleted) private copies in `core/onboarding/accept.ts`
 * and `core/capture/vision.ts`.
 */
export function localDateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * True iff `timeZone` is a resolvable IANA zone. `Intl.DateTimeFormat` throws
 * RangeError on junk, so this closes the RangeError at every read boundary: callers
 * fall back to a safe default (`'UTC'`) rather than 500. The `'UTC'` DB default and a
 * pre-migration row carrying junk are both absorbed here on read.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Whole-day number for an ISO `YYYY-MM-DD` (UTC midnight / 86400s) — a pure parse. */
function toDayNumber(localDate: string): number {
  const [year, month, day] = localDate.split("-").map((part) => Number.parseInt(part, 10));
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * Signed whole calendar days from `a` to `b` (both YYYY-MM-DD): positive when `b` is
 * later, zero when equal, negative when earlier. Pure YYYY-MM-DD arithmetic via
 * `Date.UTC` — never a clock read. Used to derive `arc.dayNumber` in the rollover.
 */
export function daysBetweenLocal(a: string, b: string): number {
  return toDayNumber(b) - toDayNumber(a);
}

/**
 * `date` (YYYY-MM-DD) shifted by `n` whole calendar days (n may be negative). Pure
 * YYYY-MM-DD arithmetic via `Date.UTC` — no timezone, no clock. Mirrors the
 * `monthWindow` style in `core/onboarding/accept.ts`.
 */
export function addDaysLocal(date: string, n: number): string {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + n));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
