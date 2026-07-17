import type { CommitResult } from "@/core/capture/commit";
import type { CaptureDraft, ClarificationQuestion, Proposal } from "@/core/capture/contract";

/*
 * Client wrappers over the SAR-006 capture route handlers (D-A). Type-only imports
 * keep the server-only commit/parse code out of the client bundle. The client mints
 * one idempotencyKey per commit attempt (retry-safe, ARCHITECTURE §5.2).
 */
const JSON_HEADERS = { "content-type": "application/json" };

export interface ParseResponse {
  ok: boolean;
  draft?: CaptureDraft;
  error?: string;
}

export interface Unresolved {
  proposalId: string;
  reason: string;
  /** A demotion question (unknown entity) — null when a mislabelled auto proposal just needs confirmation. */
  question: ClarificationQuestion | null;
}

export interface CommitResponse {
  ok: boolean;
  result?: CommitResult;
  unresolved?: Unresolved[];
}

export interface UndoResponse {
  ok: boolean;
  reason?: string;
}

/** A fetch rejection / non-JSON body must never throw into the sheet (R1): it degrades
 *  to a safe `ok:false` so the caller re-decks the card instead of losing it. */
async function postJson<T>(url: string, body: unknown, onError: T): Promise<T> {
  try {
    const res = await fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
    return (await res.json()) as T;
  } catch {
    return onError;
  }
}

export async function parseText(text: string): Promise<ParseResponse> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return postJson("/api/capture/parse", { text, timezone }, { ok: false, error: "network" });
}

export async function commitProposals(
  proposals: readonly Proposal[],
  mode: "auto" | "accept",
  kind: "capture" | "tap" | "edit" = "capture",
): Promise<CommitResponse> {
  return postJson(
    "/api/capture/commit",
    { proposals, idempotencyKey: crypto.randomUUID(), kind, mode },
    { ok: false, unresolved: [] },
  );
}

export async function undoCommit(commitId: string): Promise<UndoResponse> {
  return postJson("/api/capture/undo", { commitId }, { ok: false, reason: "network" });
}
