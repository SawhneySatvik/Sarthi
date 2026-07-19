/**
 * Coach-facing game read models. These functions are deliberately pure: callers
 * supply typed records plus a local date, so refreshing a Coach page never writes
 * progress, creates a re-entry proposal, or consults a hidden clock.
 */
import { daysBetween } from "./streak";
import type {
  AdaptationRecord,
  DomainProgressRecord,
  EvidenceRecord,
  PlanItemRecord,
  SkillRecord,
  SkillSessionRecord,
} from "@/data/schema/contract";

export interface SkillMastery {
  skillId: string;
  name: string;
  minutes: number;
}

export interface PlanEffectCounts {
  capture: number;
  tool: number;
  rule: number;
  manual: number;
  auto: number;
  totalCompleted: number;
}

export interface GameSummary {
  progress: readonly DomainProgressRecord[];
  mastery: readonly SkillMastery[];
  planEffects: PlanEffectCounts;
  evidenceCounts: Readonly<Record<"health" | "money" | "habits" | "skills", number>>;
  inactiveDays: number;
  reentryEligible: boolean;
  /** Eval seam: integer numerator/denominator, never a stored score. */
  adaptationSanity: AdaptationSanity;
}

export interface AdaptationSanity {
  numerator: number;
  denominator: number;
  /** Integer basis points; no generated adaptation means no bad adaptation (10000). */
  rateBps: number;
}

export interface ReentryCandidate {
  planItemId: string;
  before: { entryKind: "planItem"; entryId: string; columns: Record<string, string | number | boolean | null> };
  after: { entryKind: "planItem"; entryId: string; columns: Record<string, string | number | boolean | null> };
  reason: string;
}

type Scalar = string | number | boolean | null;

function scalarColumns(row: Record<string, unknown>): Record<string, Scalar> {
  const result: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

/** D-044: mastery is the integer sum of each skill's typed session minutes. */
export function deriveSkillMastery(
  skills: readonly SkillRecord[],
  sessions: readonly SkillSessionRecord[],
): SkillMastery[] {
  const minutesBySkill = new Map<string, number>();
  for (const session of sessions) {
    minutesBySkill.set(session.skillId, (minutesBySkill.get(session.skillId) ?? 0) + session.minutes);
  }
  return skills
    .filter((skill) => !skill.isArchived)
    .map((skill) => ({ skillId: skill.id, name: skill.name, minutes: minutesBySkill.get(skill.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.skillId.localeCompare(b.skillId));
}

export function derivePlanEffectCounts(items: readonly PlanItemRecord[]): PlanEffectCounts {
  const counts: PlanEffectCounts = { capture: 0, tool: 0, rule: 0, manual: 0, auto: 0, totalCompleted: 0 };
  for (const item of items) {
    if (item.status !== "done") continue;
    counts.totalCompleted += 1;
    if (item.completionSource === "capture") counts.capture += 1;
    else if (item.completionSource === "tool") counts.tool += 1;
    else if (item.completionSource === "rule") counts.rule += 1;
    else if (item.completionSource === "manual") counts.manual += 1;
    else if (item.completionSource === "auto") counts.auto += 1;
  }
  return counts;
}

export function deriveEvidenceCounts(
  rows: readonly EvidenceRecord[],
): Record<"health" | "money" | "habits" | "skills", number> {
  const counts = { health: 0, money: 0, habits: 0, skills: 0 };
  for (const row of rows) {
    if (row.domain !== "overall") counts[row.domain] += 1;
  }
  return counts;
}

/**
 * Elapsed local calendar days since the latest activity. Unlike streak display,
 * re-entry is deliberately not grace-adjusted: F9 starts at three full days away.
 */
export function deriveInactiveDays(
  progress: readonly DomainProgressRecord[],
  localDate: string,
): number {
  const latest = progress
    .map((row) => row.lastActiveDate)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1);
  if (!latest) return 0;
  return Math.max(0, daysBetween(latest, localDate));
}

/** A sane adaptation is one visible, typed numeric lightening of its own plan item. */
export function deriveAdaptationSanity(rows: readonly AdaptationRecord[]): AdaptationSanity {
  let numerator = 0;
  for (const row of rows) {
    const before = row.beforeJson;
    const after = row.afterJson;
    const beforeTarget = before.columns.targetValue;
    const afterTarget = after.columns.targetValue;
    const safe =
      before.entryKind === "planItem" && after.entryKind === "planItem" &&
      before.entryId === row.planItemId && after.entryId === row.planItemId &&
      before.columns.title === after.columns.title && before.columns.status === after.columns.status &&
      typeof beforeTarget === "number" && Number.isInteger(beforeTarget) &&
      typeof afterTarget === "number" && Number.isInteger(afterTarget) && afterTarget >= 1 && afterTarget < beforeTarget;
    if (safe) numerator += 1;
  }
  const denominator = rows.length;
  return { numerator, denominator, rateBps: denominator === 0 ? 10_000 : Math.floor((numerator * 10_000) / denominator) };
}

export function deriveGameSummary(input: {
  localDate: string;
  progress: readonly DomainProgressRecord[];
  skills: readonly SkillRecord[];
  sessions: readonly SkillSessionRecord[];
  planItems: readonly PlanItemRecord[];
  evidence: readonly EvidenceRecord[];
  adaptations?: readonly AdaptationRecord[];
}): GameSummary {
  const inactiveDays = deriveInactiveDays(input.progress, input.localDate);
  return {
    progress: input.progress.slice().sort((a, b) => a.domain.localeCompare(b.domain)),
    mastery: deriveSkillMastery(input.skills, input.sessions),
    planEffects: derivePlanEffectCounts(input.planItems),
    evidenceCounts: deriveEvidenceCounts(input.evidence),
    inactiveDays,
    reentryEligible: inactiveDays >= 3,
    adaptationSanity: deriveAdaptationSanity(input.adaptations ?? []),
  };
}

/**
 * A safe re-entry lightening changes only an integer numeric target. It never
 * changes a plan title, status, or rule. No suitable target means no proposal.
 */
export function deriveReentryCandidate(input: {
  localDate: string;
  progress: readonly DomainProgressRecord[];
  planItems: readonly PlanItemRecord[];
}): ReentryCandidate | null {
  if (deriveInactiveDays(input.progress, input.localDate) < 3) return null;
  const item = input.planItems
    .filter((candidate) =>
      (candidate.status === "active" || candidate.status === "pending") &&
      candidate.targetValue !== null &&
      candidate.targetValue > 1,
    )
    .slice()
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.id.localeCompare(b.id))[0];
  if (!item || item.targetValue === null) return null;
  const reduction = Math.max(1, Math.floor(item.targetValue / 5));
  const before = scalarColumns(item as unknown as Record<string, unknown>);
  const after = { ...before, targetValue: Math.max(1, item.targetValue - reduction) };
  return {
    planItemId: item.id,
    before: { entryKind: "planItem", entryId: item.id, columns: before },
    after: { entryKind: "planItem", entryId: item.id, columns: after },
    reason: "You have been away for a few days; this reduces one numeric target so restarting stays light.",
  };
}
