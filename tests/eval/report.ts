/**
 * tests/eval/report.ts — SAR-007 (D-C). The minimal F3-gate EvalReport (a strict
 * subset of ARCHITECTURE §8.2 — the full 12-fixture / A/B / adaptation / cost report
 * is SAR-020) and the `wrongSilentWrites` aggregator.
 *
 * `wrongSilentWrites` reads what is actually PERSISTED — the `estimated` column +
 * the fixture's expected-auto allowlist — NOT a row `status:'auto'|'accepted'`
 * column, which does not exist (the auto/accepted distinction is only durable at the
 * `commits.kind` envelope level; corrected in D-040).
 */
import type { UserScopedRepositories } from "../../core/contracts";

export interface FixtureResult {
  id: string;
  pass: boolean;
  expectedRows: number;
  actualRows: number;
  wrongSilentWrites: number;
}

export interface EvalReport {
  runId: string;
  generatedAt: string;
  fixtures: FixtureResult[];
  metrics: { wrongSilentWrites: number };
}

/** The typed tables that carry an `estimated` flag (habit logs do not). */
function estimatedTables(repos: UserScopedRepositories) {
  return [
    repos.money.transactions,
    repos.health.meals,
    repos.health.waterLogs,
    repos.health.workouts,
    repos.health.weighIns,
    repos.skills.sessions,
  ];
}

/**
 * Rows written with `estimated === true` across the estimated-bearing typed tables.
 * After an auto-phase (before any explicit accept) this MUST be 0: routing never
 * auto-commits an estimate, so any estimated row here is a silent estimate write —
 * the exact `wrongSilentWrites` violation the F3 gate forbids.
 */
export async function countEstimatedWrites(repos: UserScopedRepositories): Promise<number> {
  let count = 0;
  for (const table of estimatedTables(repos)) {
    const rows = (await table.list({})) as unknown as Array<{ estimated?: boolean }>;
    count += rows.filter((row) => row.estimated === true).length;
  }
  return count;
}

/** Total rows across the typed domain tables (a coarse actual-rows metric for the report). */
export async function countTypedRows(repos: UserScopedRepositories): Promise<number> {
  const tables = [
    repos.money.transactions,
    repos.health.meals,
    repos.health.mealItems,
    repos.health.waterLogs,
    repos.health.workouts,
    repos.health.weighIns,
    repos.habits.logs,
    repos.skills.sessions,
  ];
  let count = 0;
  for (const table of tables) {
    count += ((await table.list({})) as unknown[]).length;
  }
  return count;
}
