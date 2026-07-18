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

export interface TranscriptionResponse {
  ok: boolean;
  transcription?: { text: string; confidenceBps: number | null; languageCode: string | null };
  retryable?: boolean;
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

export async function parseText(
  text: string,
  metadata?: { source: "voice"; transcriptConfidenceBps: number | null },
): Promise<ParseResponse> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Preserve the original text body exactly unless this is a successful voice STT
  // handoff. Voice metadata is transport context; parse still uses this same endpoint.
  const body = metadata ? { text, timezone, ...metadata } : { text, timezone };
  return postJson("/api/capture/parse", body, { ok: false, error: "network" });
}

/** Submit an ephemeral browser clip only to the STT seam. Network/non-JSON failures
 * deliberately keep the caller's File untouched so the sheet can offer Retry. */
export async function transcribeVoice(file: File, durationMs: number): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append("audio", file);
  form.append("mimeType", file.type);
  form.append("durationMs", String(durationMs));
  try {
    const res = await fetch("/api/capture/transcribe", { method: "POST", body: form });
    return (await res.json()) as TranscriptionResponse;
  } catch {
    return { ok: false, retryable: true, error: "network" };
  }
}

/** Photo parse (SAR-011): multipart to the sibling route. `type` is the meal/receipt
 *  UI toggle. Same degrade-to-`ok:false` posture as `parseText` — a fetch rejection
 *  never throws into the sheet; the caller shows the retry state. */
export async function parsePhoto(file: File, photoType: "meal" | "receipt"): Promise<ParseResponse> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = new FormData();
  form.append("photo", file);
  form.append("timezone", timezone);
  form.append("type", photoType);
  try {
    // No explicit content-type header: the browser sets the multipart boundary.
    const res = await fetch("/api/capture/parse-photo", { method: "POST", body: form });
    return (await res.json()) as ParseResponse;
  } catch {
    return { ok: false, error: "network" };
  }
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
