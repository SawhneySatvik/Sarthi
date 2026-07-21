/**
 * app/lib/offline/queue.ts — the PURE, storage-agnostic capture mutation queue.
 *
 * This module holds ZERO browser globals (no `indexedDB`, no `window`) so it is unit
 * testable in node against an in-memory backend, and so importing it flag-off has no
 * side effects. The IndexedDB-backed backend lives in `capture-queue.ts`.
 *
 * IDEMPOTENCY (the safety core, T10 requirement #4):
 * - Each queued mutation carries a STABLE `idempotencyKey`. For a capture COMMIT this is
 *   the very key the server's commit service dedupes on (`core/capture/commit.ts` returns
 *   `reconstruct(existing)` for a replayed key — at most one typed write, ever). For UNDO
 *   the server is naturally idempotent (a second undo of an already-undone commit is a
 *   409, not a double effect), so the key only guards the CLIENT queue against duplicate
 *   rows.
 * - `enqueue` DEDUPES by `idempotencyKey`: re-queuing the same logical mutation is a no-op.
 * - `replay` drains PENDING mutations sequentially. Each is flipped to `sent` (in-flight)
 *   BEFORE the POST so a concurrent replay pass cannot double-send it, then DELETED on a
 *   definitive server answer (`ack`) or reverted to `pending` on a genuine network miss
 *   (`retry`). Combined with the server's key dedupe, a mutation writes AT MOST ONCE even
 *   in the "server wrote but the response was lost" case: the retry re-POSTs the same key,
 *   the server returns the reconstructed result, `ack` removes it — no second write.
 */

export type MutationKind = "commit" | "undo";

/** A single queued capture mutation. `body`/`headers` are replayed verbatim on reconnect. */
export interface QueuedMutation {
  /** Unique queue-row id (NOT the idempotency key). */
  id: string;
  /** Stable dedupe key — threaded to the server for commits; queue-local for undo. */
  idempotencyKey: string;
  kind: MutationKind;
  url: string;
  /** The exact JSON body to POST on replay. */
  body: unknown;
  /** Header snapshot (runtime-provider + BYOK) captured at enqueue time. */
  headers: Record<string, string>;
  createdAt: number;
  status: "pending" | "sent";
  attempts: number;
}

/** The async persistence seam. IndexedDB in the browser; a Map in tests. */
export interface QueueBackend {
  getAll(): Promise<QueuedMutation[]>;
  put(mutation: QueuedMutation): Promise<void>;
  delete(id: string): Promise<void>;
}

/** A definitive server answer (`ack` = stop retrying) vs. an unreachable server (`retry`). */
export type PostOutcome = "ack" | "retry";
export type Poster = (mutation: QueuedMutation) => Promise<PostOutcome>;

export interface NewMutation {
  idempotencyKey: string;
  kind: MutationKind;
  url: string;
  body: unknown;
  headers?: Record<string, string>;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Persist a new mutation, DEDUPING by `idempotencyKey`: if one with the same key is
 * already queued (pending or in-flight), this is a no-op and returns the existing row.
 */
export async function enqueue(
  backend: QueueBackend,
  input: NewMutation,
  now: number = Date.now(),
): Promise<QueuedMutation> {
  const existing = (await backend.getAll()).find((m) => m.idempotencyKey === input.idempotencyKey);
  if (existing) return existing;
  const mutation: QueuedMutation = {
    id: newId(),
    idempotencyKey: input.idempotencyKey,
    kind: input.kind,
    url: input.url,
    body: input.body,
    headers: input.headers ?? {},
    createdAt: now,
    status: "pending",
    attempts: 0,
  };
  await backend.put(mutation);
  return mutation;
}

/** Mutations still awaiting the server, oldest first. */
export async function listPending(backend: QueueBackend): Promise<QueuedMutation[]> {
  return (await backend.getAll())
    .filter((m) => m.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Reclaim rows a CRASHED session left flagged `sent` (in-flight) back to `pending`, so an
 * offline mutation is never permanently orphaned. Safe because the server key-dedupes a
 * re-POST: if the crash happened after the write reached the server, the reclaimed replay
 * gets the reconstructed result and removes the row without a second write.
 *
 * MUST run only ONCE at session start, BEFORE the first `replay` — never mid-pass, or it
 * would clobber a genuinely-live in-flight row. Returns how many rows were reclaimed.
 */
export async function reclaimInFlight(backend: QueueBackend): Promise<number> {
  const stuck = (await backend.getAll()).filter((m) => m.status === "sent");
  for (const mutation of stuck) {
    await backend.put({ ...mutation, status: "pending" });
  }
  return stuck.length;
}

export interface ReplayResult {
  id: string;
  idempotencyKey: string;
  acked: boolean;
}

/**
 * Drain the pending queue through `post`, at most once per mutation. Sequential by design
 * (idempotency key + in-flight flag guard duplicates); a `retry` outcome leaves the row
 * queued for the next reconnect. Returns per-mutation results.
 */
export async function replay(backend: QueueBackend, post: Poster): Promise<ReplayResult[]> {
  const pending = await listPending(backend);
  const results: ReplayResult[] = [];
  for (const mutation of pending) {
    // Flip to in-flight BEFORE posting so a racing replay pass skips it (listPending
    // only returns `pending`), then decide based on the server's answer.
    const inFlight: QueuedMutation = { ...mutation, status: "sent", attempts: mutation.attempts + 1 };
    await backend.put(inFlight);
    let outcome: PostOutcome;
    try {
      outcome = await post(inFlight);
    } catch {
      outcome = "retry";
    }
    if (outcome === "ack") {
      await backend.delete(mutation.id);
      results.push({ id: mutation.id, idempotencyKey: mutation.idempotencyKey, acked: true });
    } else {
      await backend.put({ ...inFlight, status: "pending" });
      results.push({ id: mutation.id, idempotencyKey: mutation.idempotencyKey, acked: false });
    }
  }
  return results;
}
