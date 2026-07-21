import { getSession } from "@/app/lib/session";
import { getRuntimeConfig } from "@/app/lib/runtime";
import { TodayBody } from "@/components/today/TodayBody";
import { buildHabitsView, resolveRuleDayTotals } from "@/core/domains/habits";
import { buildHealthView } from "@/core/domains/health";
import { buildMoneyView } from "@/core/domains/money";
import { buildSkillsView } from "@/core/domains/skills";
import { ARC_COMPLETE_WINDOW_DAYS, buildTodayView } from "@/core/domains/today";
import { toDayNumber } from "@/core/game";
import { ensurePlanRolledOver } from "@/core/plan/rollover";
import { isValidTimeZone, localDateInZone } from "@/core/time";

// Reads the per-user SQLite scope at request time — never statically generated.
export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { repos, user } = await getSession();
  const config = getRuntimeConfig();

  // D-053: the local day is the user's true calendar day, resolved from the profile's
  // onboarding zone (with a `'UTC'` fallback for a pre-migration/junk value). Read the
  // profile FIRST because the day-key every downstream read filters on depends on it. A
  // single `now` is threaded into both the day-key and the rollover so a materialized day
  // and the read's day-key can never straddle midnight.
  const profile = await repos.profile.profiles.byId(user.userId);
  const timezone = isValidTimeZone(profile?.timezone ?? "") ? profile!.timezone : "UTC";
  const now = new Date().toISOString();
  const localDate = localDateInZone(now, timezone);

  // On-open staleness materializer (no cron; keyless): advance each active arc to today
  // BEFORE the item reads, so Today is always live rather than emptying once the stamped
  // day passes. Idempotent (a same-day re-render is a pure-read no-op).
  await ensurePlanRolledOver(repos, { timezone, nowIso: now });

  const [items, progress, arcs, notes, meals, waterLogs, workouts, weighIns, transactions, categories, budgets, recurringRules, habits, habitLogs, satisfactionRules, skills, skillMilestones, skillSessions, gaps] =
    await Promise.all([
      repos.plans.items.list({ localDate }),
      repos.plans.progress.list({}),
      repos.plans.arcs.list({}),
      repos.coach.notes.list({ scope: "daily", localDate }),
      repos.health.meals.list({ localDate }),
      repos.health.waterLogs.list({ localDate }),
      repos.health.workouts.list({ localDate }),
      repos.health.weighIns.list({ localDate }),
      // Money reads span the month (buildMoneyView windows in memory — the repos have no range port).
      repos.money.transactions.list({}),
      repos.money.categories.list({}),
      repos.money.budgets.list({}),
      repos.money.recurringRules.list({ isPaused: false }),
      // Habits: full log history so per-habit streaks + the heatmap see all days (no aggregate port).
      repos.habits.habits.list({}),
      repos.habits.logs.list({}),
      repos.habits.satisfactionRules.list({}),
      // Skills: active tracks + full milestone/session history — mastery is the per-skill
      // session-minute SUM computed in buildSkillsView (never domain_progress.cumulativeMinutes).
      repos.skills.skills.list({ isArchived: false }),
      repos.skills.milestones.list({}),
      repos.skills.sessions.list({}),
      repos.profile.gaps.list({}),
    ]);

  // Live per-rule source aggregates for the satisfied-by badges (repos-injected core helper).
  const ruleTotals = await resolveRuleDayTotals(repos, satisfactionRules, localDate);

  // UIE-0e: the arc-complete/settled surfaces need a completed arc's OWN history rows (its
  // per-arc task/day counts). Fetch only for `complete` arcs still inside the 7-day window
  // (which covers the 3-day settled window too) — so the steady state (no recent completion)
  // runs ZERO extra queries. One bounded read per in-window completed arc.
  const inWindowCompletedArcs = arcs.filter(
    (arc) =>
      arc.status === "complete" &&
      arc.endDate !== null &&
      toDayNumber(localDate) - toDayNumber(arc.endDate) >= 0 &&
      toDayNumber(localDate) - toDayNumber(arc.endDate) <= ARC_COMPLETE_WINDOW_DAYS,
  );
  const arcHistoryItems = (
    await Promise.all(inWindowCompletedArcs.map((arc) => repos.plans.items.list({ arcId: arc.id })))
  ).flat();

  const view = buildTodayView({
    localDate,
    items,
    progress,
    arcs,
    coachNote: notes[0] ?? null,
    arcHistoryItems,
  });
  const healthView = buildHealthView({ meals, waterLogs, workouts, weighIns });
  const moneyView = buildMoneyView({ localDate, transactions, categories, budgets, recurringRules });
  const habitsView = buildHabitsView({ localDate, habits, logs: habitLogs, rules: satisfactionRules, ruleTotals });
  const skillsView = buildSkillsView({ localDate, skills, milestones: skillMilestones, sessions: skillSessions });

  return (
    <>
      <TodayBody
        view={view}
        healthView={healthView}
        moneyView={moneyView}
        habitsView={habitsView}
        skillsView={skillsView}
        initialDomain={(await searchParams).domain}
        profile={profile}
        gaps={gaps}
        isDeveloperControlAllowed={process.env.NODE_ENV !== "production" || config.judgeMode}
        llmProvider={config.llmProvider}
        accountMode={user.mode}
        accountEmail={user.email}
      />
    </>
  );
}
