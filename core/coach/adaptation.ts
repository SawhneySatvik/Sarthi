/**
 * core/coach/adaptation.ts — COACH-3. The single, framework-clean proposal-creation path
 * shared by the re-entry engine (`engine.proposeAdaptation`) and the conversational agent
 * loop (`agent.ts` propose-adaptation dispatch). Both build a SERVER-SIDE before→after
 * plan-item snapshot from the actual row and route it through ONE dedupe + create, so:
 *   - the LLM never authors a snapshot (invariant #1 — it only supplies planItemId /
 *     targetValue / reason; the beforeJson/afterJson are derived here from the typed row);
 *   - there is exactly one `AdaptationRecord` shape and one dedupe rule (invariant #7);
 *   - a proposal is only ever `status:"proposed"` — the plan row is untouched until an
 *     explicit human Keep (the Keep/Revert commit path is REUSED, never rebuilt here).
 *
 * This module was extracted (rather than calling `engine.proposeAdaptation` from the loop)
 * because `engine.ts` already imports `runCoachAgent` from `agent.ts`; a back-import would
 * be an agent↔engine cycle. `adaptation.ts` is a leaf both sides import — no cycle.
 *
 * Framework-clean (invariant #9): imports only `core/*` and `data/schema` TYPES.
 */
import type { UserScopedRepositories } from "@/core/contracts";
import type { AdaptationRecord, PlanItemRecord } from "@/data/schema/contract";

type Scalar = string | number | boolean | null;

/** The bounded `CommitRowSnapshot` shape (entryKind / entryId / scalar columns). */
type PlanItemSnapshot = AdaptationRecord["beforeJson"];

/**
 * The scalar columns of a persisted row (mirrors the `scalarColumns` used by
 * `deriveReentryCandidate` and the commit path). Identity columns are intentionally
 * kept — the Keep path strips them via `businessColumns`, and their presence is the
 * proof that the snapshot came from the server-side row, not the model.
 */
function scalarColumns(record: Record<string, unknown>): Record<string, Scalar> {
  const columns: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      columns[key] = value;
    }
  }
  return columns;
}

/**
 * Build the glass-box before→after snapshot SERVER-SIDE from the actual plan-item row —
 * the exact `scalarColumns` path as `deriveReentryCandidate` (`core/game/coach.ts`). Only
 * the integer numeric target changes; title / status / rule stay byte-identical across
 * before and after, so `deriveAdaptationSanity` and the Keep patch see one clean lightening.
 */
export function buildPlanItemAdaptationSnapshot(
  item: PlanItemRecord,
  targetValue: number,
): { before: PlanItemSnapshot; after: PlanItemSnapshot } {
  const before = scalarColumns(item as unknown as Record<string, unknown>);
  const after = { ...before, targetValue };
  return {
    before: { entryKind: "planItem", entryId: item.id, columns: before },
    after: { entryKind: "planItem", entryId: item.id, columns: after },
  };
}

/**
 * Dedupe + create ONE `status:"proposed"` `AdaptationRecord`. An identical OPEN proposal
 * (same plan item + before/after) is returned rather than duplicated — the single dedupe
 * both callers share. Never applies the change (invariant #1); the row waits for an
 * explicit Keep/Revert.
 */
export async function proposeAdaptationRow(input: {
  repos: UserScopedRepositories;
  planItemId: string;
  before: PlanItemSnapshot;
  after: PlanItemSnapshot;
  reason: string;
}): Promise<AdaptationRecord> {
  const { repos, planItemId, before, after, reason } = input;
  if (
    before.entryKind !== "planItem" || after.entryKind !== "planItem" ||
    before.entryId !== planItemId || after.entryId !== planItemId
  ) {
    throw new Error("adaptation must contain one matching typed plan-item patch");
  }
  const equivalent = (await repos.coach.adaptations.list({})).find((adaptation) =>
    adaptation.status === "proposed" && adaptation.planItemId === planItemId &&
    JSON.stringify(adaptation.beforeJson) === JSON.stringify(before) &&
    JSON.stringify(adaptation.afterJson) === JSON.stringify(after),
  );
  if (equivalent) return equivalent;
  return repos.coach.adaptations.create({
    planItemId,
    beforeJson: before,
    afterJson: after,
    reason,
    status: "proposed",
    keptAt: null,
    revertedAt: null,
    appliedCommitId: null,
  });
}
