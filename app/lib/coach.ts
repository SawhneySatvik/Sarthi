import "server-only";

import { createCommitService } from "@/core/capture";
import { createCoachEngine } from "@/core/coach";

import type { Session } from "./session";

/** Server-only composition seam for Coach routes and the later SAR-015 readers. */
export function coachForSession(session: Session) {
  return createCoachEngine({
    repos: session.repos,
    llm: session.llm,
    commits: createCommitService({ repos: session.repos, llm: session.llm }),
  });
}
