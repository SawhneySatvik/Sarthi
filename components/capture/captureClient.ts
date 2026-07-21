import type { CommitResult } from "@/core/capture/commit";
import type { CaptureDraft, ClarificationQuestion, Proposal } from "@/core/capture/contract";
import { runtimeProviderHeaders } from "@/components/settings/runtimeOverride";
import { byokHeaders } from "@/components/settings/byok";
import { offlineQueueEnabled } from "@/app/lib/offline/flag";
import { enqueueCaptureMutation } from "@/app/lib/offline/capture-queue";

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
  /** Offline-queue only (flag on): the mutation was queued for reconnect, NOT written yet. */
  pendingSync?: boolean;
}

export interface UndoResponse {
  ok: boolean;
  reason?: string;
  /** Offline-queue only (flag on): the undo was queued for reconnect, NOT applied yet. */
  pendingSync?: boolean;
}

/** A fetch rejection / non-JSON body must never throw into the sheet (R1): it degrades
 *  to a safe `ok:false` so the caller re-decks the card instead of losing it. */
async function postJson<T>(url: string, body: unknown, onError: T, includeRuntimeProvider = false): Promise<T> {
  try {
    // BYOK: real-AI requests (parse/commit) carry the user's key + provider so the server
    // routes to their own model. Absent a key the headers are empty and the fake path runs.
    const headers = includeRuntimeProvider
      ? { ...JSON_HEADERS, ...runtimeProviderHeaders(), ...byokHeaders() }
      : JSON_HEADERS;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
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
  return postJson("/api/capture/parse", body, { ok: false, error: "network" }, true);
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
    // No explicit content-type header: the browser sets the multipart boundary. BYOK key
    // (when saved) routes the photo to the user's real vision provider.
    const res = await fetch("/api/capture/parse-photo", { method: "POST", body: form, headers: byokHeaders() });
    return (await res.json()) as ParseResponse;
  } catch {
    return { ok: false, error: "network" };
  }
}

/*
 * OFFLINE ADDITIVE QUEUE (T10/PL-3), gated by NEXT_PUBLIC_ENABLE_OFFLINE_QUEUE.
 *
 * Flag OFF: `offlineQueueEnabled()` is false, so commit/undo run the EXACT original
 * `postJson` call below — same body, same headers, same `{ok:false}` degrade, no
 * IndexedDB. Byte-identical to today.
 *
 * Flag ON: when a commit/undo fetch fails while genuinely offline, the mutation is
 * persisted to the IndexedDB queue with a STABLE idempotency key and replayed once on
 * reconnect. An unreachable-but-thought-online fetch is also queued (safe: the same key
 * dedupes server-side). `pendingSync:true` tells the sheet to show an explicit
 * "will sync when online" state — NOT a confirmed typed write (invariant #1).
 */

/** Unique sentinel: a transport failure (fetch/JSON threw), distinct from a server ok:false. */
const TRANSPORT_FAILED = Symbol("transport-failed");

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function commitProposals(
  proposals: readonly Proposal[],
  mode: "auto" | "accept",
  kind: "capture" | "tap" | "edit" = "capture",
): Promise<CommitResponse> {
  const idempotencyKey = crypto.randomUUID();
  const body = { proposals, idempotencyKey, kind, mode };
  if (!offlineQueueEnabled()) {
    return postJson("/api/capture/commit", body, { ok: false, unresolved: [] }, true);
  }
  // Snapshot the same headers the online commit sends (runtime provider + BYOK), so a
  // queued replay routes identically. The helpers only ever return plain objects.
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    ...(runtimeProviderHeaders() as Record<string, string>),
    ...(byokHeaders() as Record<string, string>),
  };
  if (isOffline()) {
    await enqueueCaptureMutation({ idempotencyKey, kind: "commit", url: "/api/capture/commit", body, headers });
    return { ok: false, unresolved: [], pendingSync: true };
  }
  const res = await postSentinel<CommitResponse>("/api/capture/commit", body, headers);
  if (res === TRANSPORT_FAILED) {
    await enqueueCaptureMutation({ idempotencyKey, kind: "commit", url: "/api/capture/commit", body, headers });
    return { ok: false, unresolved: [], pendingSync: true };
  }
  return res;
}

export async function undoCommit(commitId: string): Promise<UndoResponse> {
  const body = { commitId };
  if (!offlineQueueEnabled()) {
    return postJson("/api/capture/undo", body, { ok: false, reason: "network" });
  }
  // Undo is naturally idempotent server-side (a second undo of an undone commit is a 409),
  // so the queue key is queue-local. NOTE: the 5-minute undo window may lapse before
  // reconnect — an expired replay is an honest 409, never a double effect.
  const idempotencyKey = `undo:${commitId}`;
  if (isOffline()) {
    await enqueueCaptureMutation({ idempotencyKey, kind: "undo", url: "/api/capture/undo", body, headers: { ...JSON_HEADERS } });
    return { ok: false, reason: "offline", pendingSync: true };
  }
  const res = await postSentinel<UndoResponse>("/api/capture/undo", body, { ...JSON_HEADERS });
  if (res === TRANSPORT_FAILED) {
    await enqueueCaptureMutation({ idempotencyKey, kind: "undo", url: "/api/capture/undo", body, headers: { ...JSON_HEADERS } });
    return { ok: false, reason: "offline", pendingSync: true };
  }
  return res;
}

/**
 * POST that signals TRANSPORT_FAILED ONLY when `fetch` itself rejects (server unreachable
 * → queue offline). A server that DID respond but with a non-JSON body is online, not
 * offline, so it degrades to `{ok:false}` exactly like the original path (re-deck), never
 * queued — otherwise an online 5xx could be mistaken for an offline mutation.
 */
async function postSentinel<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T | typeof TRANSPORT_FAILED> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    return TRANSPORT_FAILED;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return { ok: false } as T;
  }
}
