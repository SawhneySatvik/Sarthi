/**
 * core/coach/memory.ts — COACH-1 (COACH-LIFT §2.4). The pure, read-time frecency
 * retrieval helper for Layer 2 durable memory. NO stored tier, NO tier-transition
 * engine, NO graph, NO nightly worker — "cold" is simply "not in top-K", a query
 * outcome and never a stored state.
 *
 * Framework-clean (invariant #9): imports only the drizzle-free repository PORT type
 * and the schema DTO type — no React/Next, no provider, no ORM. The score is a
 * transient in-memory ranking value; nothing float is ever persisted (invariant #2 —
 * `useCount`/`confidenceBps` are integers on disk).
 *
 * The retrieval guarantee (invariant #1, structural): every returned row is either an
 * explicit user statement or a human-confirmed card, so injecting it into a coach turn
 * recalls nothing that was not read or confirmed. The pinned floor makes core goals
 * un-evictable — the LRU-eviction anti-pattern the second_brain study warns against.
 */
import type { UserScopedRepositories } from "@/core/contracts";
import type { CoachMemoryDomain, CoachMemoryRecord } from "@/data/schema/contract";

/* ────────────────────────────────────────────────────────────────────────────
 * Locked constants (Satvik-confirmed, COACH-LIFT §2.4 / §8). Tunable without a
 * schema change — the frecency numbers live here and nowhere else.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Recency weight in the frecency blend. */
export const W_RECENCY = 0.6;
/** Frequency weight in the frecency blend. */
export const W_FREQUENCY = 0.4;
/** Recency decay time-constant, in days (τ). */
export const TAU_DAYS = 60;
/** Default top-K non-pinned rows retrieved per turn. */
export const TOP_K = 8;
/**
 * A pinned row's hard-floor score. Non-pinned scores are strictly < 1.0 (recency ∈
 * (0,1], frequency ∈ [0,1)), so a pinned goal can NEVER be out-ranked or evicted.
 */
export const PINNED_FLOOR = 1.0;

const MS_PER_DAY = 86_400_000;

/**
 * Read-time frecency score for one memory row against a controlled `now`.
 *   score = W_RECENCY·exp(-Δdays/τ) + W_FREQUENCY·(log1p(useCount)/(1+log1p(useCount)))
 * A pinned row is a hard floor → `PINNED_FLOOR` (1.0). Δdays is measured from
 * `lastUsedAt ?? createdAt` and CLAMPED at ≥ 0, so a future-dated row (or a clock
 * that precedes it) can never make `exp(-Δdays/τ)` exceed 1 and slip past the floor.
 * The score is transient — it is never written back to any row.
 */
export function frecencyScore(row: CoachMemoryRecord, now: Date): number {
  if (row.pinned) return PINNED_FLOOR;
  const anchor = row.lastUsedAt ?? row.createdAt;
  const deltaDays = Math.max(0, (now.getTime() - Date.parse(anchor)) / MS_PER_DAY);
  const recency = Math.exp(-deltaDays / TAU_DAYS);
  const logUse = Math.log1p(row.useCount);
  const frequency = logUse / (1 + logUse);
  return W_RECENCY * recency + W_FREQUENCY * frequency;
}

export interface SelectMemoriesInput {
  repos: UserScopedRepositories;
  /** The turn's detected domain(s); `global` is always eligible on top of these. */
  domains: readonly CoachMemoryDomain[];
  /** Controlled clock — the retrieval is a pure function of (rows, now). */
  now: Date;
  /** Top-K non-pinned rows to retrieve; defaults to `TOP_K`. */
  k?: number;
}

export interface SelectedMemories {
  /** ALL active pinned rows, unconditionally (never domain-filtered, never capped). */
  pinned: CoachMemoryRecord[];
  /** Top-K active non-pinned rows by frecency, filtered to the eligible domains. */
  ranked: CoachMemoryRecord[];
}

/**
 * Select the memory rows to inject into one coach turn. Pure READ — no side effects
 * (bookkeeping is the separate `bumpMemoryUsage`, called by C2 after a turn):
 *   (a) ALL pinned rows (active), UNCONDITIONALLY — never domain-filtered so a money
 *       goal survives a health-domain turn (the pinned-floor property);
 *   (b) the top-K non-pinned rows by frecency, filtered to `domains ∪ {global}`.
 * Retired rows are excluded from both (retire, never delete). Ties break
 * deterministically by createdAt then id so a controlled-clock test is stable.
 */
export async function selectMemories({
  repos,
  domains,
  now,
  k = TOP_K,
}: SelectMemoriesInput): Promise<SelectedMemories> {
  const eligible = new Set<CoachMemoryDomain>([...domains, "global"]);

  const all = await repos.coach.memory.list({});
  const active = all.filter((row) => !row.retired);

  // (a) Every active pinned row — no domain filter, no K cap.
  const pinned = active.filter((row) => row.pinned);

  // (b) Top-K active non-pinned rows, domain-eligible, ranked by frecency.
  const ranked = active
    .filter((row) => !row.pinned && eligible.has(row.domain as CoachMemoryDomain))
    .map((row) => ({ row, score: frecencyScore(row, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.createdAt.localeCompare(b.row.createdAt) ||
        a.row.id.localeCompare(b.row.id),
    )
    .slice(0, Math.max(0, k))
    .map((entry) => entry.row);

  return { pinned, ranked };
}

export interface BumpMemoryUsageInput {
  repos: UserScopedRepositories;
  /** The rows actually surfaced this turn (pinned + ranked) — bump each once. */
  memories: readonly CoachMemoryRecord[];
  /** Controlled clock for `lastUsedAt`. */
  now: Date;
}

/**
 * Metadata-only bookkeeping (COACH-LIFT §2.3): bump `useCount`+1 and `lastUsedAt`
 * on the rows a turn actually surfaced. Kept a SEPARATE exported fn so C2 calls it
 * AFTER a turn resolves — never inside `selectMemories`, which must stay a pure read.
 * This touches no content, so it sits outside the estimate gate. Deduped by id, so a
 * row appearing in both `pinned` and (impossibly) `ranked` is only bumped once.
 */
export async function bumpMemoryUsage({ repos, memories, now }: BumpMemoryUsageInput): Promise<void> {
  const seen = new Set<string>();
  const lastUsedAt = now.toISOString();
  for (const row of memories) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    await repos.coach.memory.update(row.id, {
      useCount: row.useCount + 1,
      lastUsedAt,
    });
  }
}
