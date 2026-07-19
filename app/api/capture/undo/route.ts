import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { UndoNotAvailableError, createCommitService } from "@/core/capture";

/*
 * POST /api/capture/undo (SAR-006, D-A) — the five-minute latest-batch undo seam.
 * Body: { commitId: string }. Reverses every side effect atomically via the commit
 * service; an expired/superseded/non-latest batch is a 409, not a crash.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { commitId?: unknown };
  const commitId = typeof body.commitId === "string" ? body.commitId : "";
  if (!commitId) {
    return NextResponse.json({ ok: false, error: "commitId required" }, { status: 400 });
  }

  const { repos, llm } = await getSession();
  const service = createCommitService({ repos, llm });

  try {
    const result = await service.undoLatest({ commitId, now: new Date().toISOString() });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof UndoNotAvailableError) {
      return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    }
    throw error;
  }
}
