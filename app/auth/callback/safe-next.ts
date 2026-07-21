/**
 * app/auth/callback/safe-next.ts — open-redirect guard for the reset/confirm callback's `next`
 * param (SCREEN-AUTH §4). Kept import-free (no `next/*`, no `@/…`) so it is a pure, unit-testable
 * predicate — `new URL("//evil.com", origin)` resolves to `https://evil.com/`, so a bare
 * `startsWith("/")` is NOT sufficient. Accept `next` ONLY when it is an unambiguous same-origin
 * relative path: a single leading slash, not `//host` (protocol-relative) and not `/\host` (which
 * some parsers treat like `//`). Anything else falls back to the safe reset destination.
 */
const DEFAULT_NEXT = "/reset-password/update";

export function safeRelativeNext(next: string | null | undefined): string {
  if (
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return DEFAULT_NEXT;
}
