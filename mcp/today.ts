/**
 * mcp/today.ts — the read-only Today summary for the ChatGPT panel (DEVDAY-0 A4).
 *
 * Reads only, through the user-scoped repositories. Integer units throughout;
 * money is rendered via the integer-divmod `formatPaise`.
 */
import type { UserScopedRepositories } from "@/core/contracts";
import { buildHabitsView, resolveRuleDayTotals } from "@/core/domains/habits";
import { buildHealthView } from "@/core/domains/health";
import { formatPaise } from "@/core/domains/money";
import { buildIdentity } from "@/core/domains/today";

export interface TodaySummary {
  localDate: string;
  health: { kcalIn: number; waterMl: number; workoutMin: number };
  money: { spentPaise: number; spentLabel: string };
  habits: { done: number; total: number };
  skills: { minutes: number };
  xp: { total: number; level: number };
}

const DOMAIN_ROWS = new Set(["health", "money", "habits", "skills"]);

export async function buildToday(repos: UserScopedRepositories, localDate: string): Promise<TodaySummary> {
  const [meals, waterLogs, workouts, transactions, habits, habitLogs, rules, sessions, progress, arcs] =
    await Promise.all([
      repos.health.meals.list({}),
      repos.health.waterLogs.list({}),
      repos.health.workouts.list({}),
      repos.money.transactions.list({}),
      repos.habits.habits.list({}),
      repos.habits.logs.list({}),
      repos.habits.satisfactionRules.list({}),
      repos.skills.sessions.list({}),
      repos.plans.progress.list({}),
      repos.plans.arcs.list({}),
    ]);

  const todays = <T extends { localDate: string }>(rows: readonly T[]) => rows.filter((r) => r.localDate === localDate);
  const todaysWorkouts = todays(workouts);
  const health = buildHealthView({
    meals: todays(meals),
    waterLogs: todays(waterLogs),
    workouts: todaysWorkouts,
    weighIns: [],
  });
  const workoutMin = todaysWorkouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);

  const spentPaise = transactions
    .filter((t) => t.localDate === localDate && t.direction === "debit")
    .reduce((sum, t) => sum + t.amountPaise, 0);

  const ruleTotals = await resolveRuleDayTotals(repos, rules, localDate);
  const habitsView = buildHabitsView({ localDate, habits, logs: habitLogs, rules, ruleTotals });

  const skillMinutes = todays(sessions).reduce((sum, s) => sum + s.minutes, 0);

  const xpTotal = progress.filter((row) => DOMAIN_ROWS.has(row.domain)).reduce((sum, row) => sum + row.xp, 0);
  const level = buildIdentity({ progress, arcs }).level;

  return {
    localDate,
    health: {
      kcalIn: health.rings.find((r) => r.key === "energy")?.value ?? 0,
      waterMl: health.rings.find((r) => r.key === "water")?.value ?? 0,
      workoutMin,
    },
    money: { spentPaise, spentLabel: formatPaise(spentPaise) },
    habits: { done: habitsView.headline.done, total: habitsView.headline.total },
    skills: { minutes: skillMinutes },
    xp: { total: xpTotal, level },
  };
}
