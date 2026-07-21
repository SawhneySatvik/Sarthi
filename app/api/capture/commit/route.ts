import { NextResponse } from "next/server";

import { getSessionForRuntimeRequest, isBearerAuthenticationError, type Session } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { withByok } from "@/app/lib/byok";
import {
  createCommitService,
  proposalSchema,
  resolveProposal,
  routeProposal,
  type ClarificationQuestion,
  type ResolvedProposal,
} from "@/core/capture";

type CommitKind = "capture" | "tap" | "edit";

const EMPTY_BLOCKED = new Set<string>();

interface Unresolved {
  proposalId: string;
  reason: string;
  question: ClarificationQuestion | null;
}

/*
 * POST /api/capture/commit (SAR-006, D-A). Resolve-then-commit seam.
 * Body: { proposals: Proposal[], idempotencyKey, kind?, mode: "auto" | "accept" }.
 *
 * Untrusted client JSON is Zod-parsed (SAR-004 N-2). `mode:"auto"` is the SILENT
 * auto-file batch: the server RE-ROUTES each proposal intrinsically (B4 defense in
 * depth — the client's "this is auto" claim is re-verified, not trusted) and commits
 * genuinely-auto rows with `status:'auto'`; anything the client mislabelled is
 * returned in `unresolved` (never written). `mode:"accept"` is an explicit user
 * accept (`status:'accepted'`). Proposals that fail resolution are returned in
 * `unresolved` so the client re-decks them — nothing estimated/unknown is written.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    proposals?: unknown;
    idempotencyKey?: unknown;
    kind?: unknown;
    mode?: unknown;
  };

  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "idempotencyKey required" }, { status: 400 });
  }
  const kind: CommitKind = body.kind === "tap" || body.kind === "edit" ? body.kind : "capture";
  const mode: "auto" | "accept" = body.mode === "accept" ? "accept" : "auto";
  const rawProposals = Array.isArray(body.proposals) ? body.proposals : [];

  let proposals;
  try {
    proposals = rawProposals.map((p) => proposalSchema.parse(p));
  } catch {
    return NextResponse.json({ ok: false, error: "malformed proposal payload" }, { status: 400 });
  }

  let repos: Session["repos"];
  let llm: Session["llm"];
  try {
    // BYOK: the coach-line generation on commit uses the user's key when present. The
    // server still RE-ROUTES every proposal below (D-040) — BYOK never touches the trust seam.
    ({ repos, llm } = withByok(await getSessionForRuntimeRequest(request), request));
  } catch (error) {
    if (isBearerAuthenticationError(error)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }

  const resolved: ResolvedProposal[] = [];
  const unresolved: Unresolved[] = [];
  for (const proposal of proposals) {
    // Defense in depth: in auto mode the server re-routes; a non-auto proposal the
    // client mislabelled is never silently written — it goes back to the deck.
    if (mode === "auto" && routeProposal(proposal, EMPTY_BLOCKED).route !== "auto") {
      const reasons = routeProposal(proposal, EMPTY_BLOCKED).reasons;
      unresolved.push({ proposalId: proposal.proposalId, reason: reasons.join("; ") || "needs confirmation", question: null });
      continue;
    }
    const outcome = await resolveProposal(proposal, repos, mode === "auto" ? "auto" : "accepted");
    if (outcome.ok) {
      resolved.push(outcome.resolved);
    } else {
      unresolved.push({ proposalId: proposal.proposalId, reason: outcome.reason, question: outcome.question });
    }
  }

  if (resolved.length === 0) {
    return NextResponse.json({ ok: false, unresolved }, { status: 409 });
  }

  const service = createCommitService({ repos, llm });
  const result = await service.commit({ idempotencyKey, kind, proposals: resolved });
  return NextResponse.json({ ok: true, result, unresolved });
}
