import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";

/** Scoped, read-only composer context. The authenticated session supplies user scope. */
export async function GET(): Promise<Response> {
  const { repos } = await getSession();
  const activity = (await repos.evidence.list({}))
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))[0] ?? null;
  return NextResponse.json({ activity: activity && { caption: activity.caption, domain: activity.domain, localDate: activity.localDate } });
}
