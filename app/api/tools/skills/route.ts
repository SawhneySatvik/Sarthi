import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSession } from "@/app/lib/session";
import { createCommitService } from "@/core/capture";
import { ToolCommandError, createToolsService } from "@/core/tools";

/** Explicit Focus setup only. It never creates a session, commit, or XP row. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const { repos, llm } = await getSession();
    const tools = createToolsService({ repos, commits: createCommitService({ repos, llm }) });
    const skill = await tools.createSkill(body);
    return NextResponse.json({ ok: true, skill });
  } catch (error) {
    if (error instanceof ZodError || error instanceof ToolCommandError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "could not create skill" }, { status: 500 });
  }
}
