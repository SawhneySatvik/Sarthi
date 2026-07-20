import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionForRuntimeRequest } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { withByok } from "@/app/lib/byok";
import { createCommitService } from "@/core/capture";
import { ToolCommandError, createToolsService } from "@/core/tools";

/** A measured Focus completion; the authenticated server resolves the scoped skill. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const { repos, llm } = withByok(await getSessionForRuntimeRequest(request), request);
    const tools = createToolsService({ repos, commits: createCommitService({ repos, llm }) });
    const result = await tools.completeFocus(body);
    return NextResponse.json({ ok: true, commitId: result.commitId, result });
  } catch (error) {
    if (error instanceof ZodError || error instanceof ToolCommandError || isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "could not complete focus" }, { status: 500 });
  }
}
