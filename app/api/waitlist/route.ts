import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/app/lib/session";

// Writes a row + reads the session cookie — never static/cached.
export const dynamic = "force-dynamic";

/*
 * POST /api/waitlist — a PUBLIC, ANONYMOUS email waitlist (the point is a
 * contactable email). No login is required: `getSession()` resolves the keyless
 * dev identity or the per-browser anonymous sandbox id, so a not-signed-in
 * visitor is never rejected. `email` is the dedupe key (global unique index);
 * `userId` is attached only as metadata (invariant D-2 keeps it NOT NULL).
 *
 * Dedupe is enforced by the DB unique index, caught here → a friendly "already on
 * the list" ok. A duplicate email must NEVER surface as a 500. Keyless on both the
 * SQLite (dev) and Postgres (prod) stacks.
 */
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  source: z.literal("pricing").optional(),
});

/**
 * True when `error` (or anything in its `cause` chain) is a unique-constraint
 * violation, across BOTH dialects: SQLite reports code `SQLITE_CONSTRAINT*` /
 * message "UNIQUE constraint failed"; Postgres reports SQLSTATE `23505` /
 * message "duplicate key value violates unique constraint".
 */
function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && current !== undefined && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && (/SQLITE_CONSTRAINT/i.test(code) || code === "23505")) {
      return true;
    }
    const message = (current as { message?: unknown }).message;
    if (typeof message === "string" && /unique constraint|duplicate key/i.test(message)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function POST(request: Request): Promise<Response> {
  let email: string;
  try {
    const json: unknown = await request.json();
    email = bodySchema.parse(json).email;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const { repos } = await getSession();
    await repos.billing.waitlist.create({ email, source: "pricing" });
    return NextResponse.json({ ok: true, status: "added" });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ ok: true, status: "already" });
    }
    return NextResponse.json(
      { ok: false, error: "Could not join the waitlist. Please try again." },
      { status: 500 },
    );
  }
}
