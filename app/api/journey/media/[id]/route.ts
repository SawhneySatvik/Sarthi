import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";

/** Authenticated scoped media read: id lookup and storage read are both user-bound. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { repos, media, user } = await getSession();
    const record = await repos.journey.media.byId((await params).id);
    if (!record) return new NextResponse(null, { status: 404 });
    const file = await media.read({ userId: user.userId, storagePath: record.storagePath });
    return new NextResponse(new Uint8Array(file.bytes).buffer, { headers: { "content-type": file.mimeType, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
