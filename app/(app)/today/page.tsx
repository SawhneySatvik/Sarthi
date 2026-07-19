import { getSession } from "@/app/lib/session";
import { getRuntimeConfig } from "@/app/lib/runtime";
import { TodayBody } from "@/components/today/TodayBody";
import { buildHabitsView, resolveRuleDayTotals } from "@/core/domains/habits";
import { buildHealthView } from "@/core/domains/health";
import { buildMoneyView } from "@/core/domains/money";
import { buildSkillsView } from "@/core/domains/skills";
import { buildTodayView } from "@/core/domains/today";

// Reads the per-user SQLite scope at request time — never statically generated.
export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { repos, user } = await getSession();
  const config = getRuntimeConfig();
  // NOTE: UTC day boundary for now — the timezone-aware localDate (schema carries
  // `timezone`) is owned by the SAR-006 capture edge; seed + page agree meanwhile.
  const localDate = new Date().toISOString().slice(0, 10);

  const [items, progress, arcs, notes, meals, waterLogs, workouts, weighIns, transactions, categories, budgets, recurringRules, habits, habitLogs, satisfactionRules, skills, skillMilestones, skillSessions, profile, gaps] =
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
      repos.profile.profiles.byId(user.userId),
      repos.profile.gaps.list({}),
    ]);

  // Live per-rule source aggregates for the satisfied-by badges (repos-injected core helper).
  const ruleTotals = await resolveRuleDayTotals(repos, satisfactionRules, localDate);

  const view = buildTodayView({
    localDate,
    items,
    progress,
    arcs,
    coachNote: notes[0] ?? null,
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
      />
    </>
  );
}
