import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";

/**
 * Repository-scoped JSON export. Every read comes from the identity-bound
 * repository port; callers cannot select a tenant or table payload.
 */
export async function GET(): Promise<Response> {
  try {
    const { user, repos } = await getSession();
    const [
      profile,
      profileGaps,
      moneyCategories,
      transactions,
      recurringRules,
      budgets,
      meals,
      mealItems,
      waterLogs,
      workouts,
      workoutExercises,
      weighIns,
      habits,
      habitLogs,
      habitSatisfactionRules,
      skills,
      skillMilestones,
      skillSessions,
      planArcs,
      planItems,
      progress,
      dayOneSnapshots,
      coachNotes,
      adaptations,
      evidence,
      commits,
      commitRows,
      commitProgressEffects,
      commitPlanEffects,
    ] = await Promise.all([
      repos.profile.profiles.byId(user.userId),
      repos.profile.gaps.list({}),
      repos.money.categories.list({}),
      repos.money.transactions.list({}),
      repos.money.recurringRules.list({}),
      repos.money.budgets.list({}),
      repos.health.meals.list({}),
      repos.health.mealItems.list({}),
      repos.health.waterLogs.list({}),
      repos.health.workouts.list({}),
      repos.health.workoutExercises.list({}),
      repos.health.weighIns.list({}),
      repos.habits.habits.list({}),
      repos.habits.logs.list({}),
      repos.habits.satisfactionRules.list({}),
      repos.skills.skills.list({}),
      repos.skills.milestones.list({}),
      repos.skills.sessions.list({}),
      repos.plans.arcs.list({}),
      repos.plans.items.list({}),
      repos.plans.progress.list({}),
      repos.plans.dayOneSnapshots.list({}),
      repos.coach.notes.list({}),
      repos.coach.adaptations.list({}),
      repos.evidence.list({}),
      repos.commits.commits.list({}),
      repos.commits.rows.list({}),
      repos.commits.progressEffects.list({}),
      repos.commits.planEffects.list({}),
    ]);

    const bundle = {
      format: "sarthi-export-v1",
      exportedAt: new Date().toISOString(),
      profile,
      profileGaps,
      money: { categories: moneyCategories, transactions, recurringRules, budgets },
      health: { meals, mealItems, waterLogs, workouts, workoutExercises, weighIns },
      habits: { habits, logs: habitLogs, satisfactionRules: habitSatisfactionRules },
      skills: { skills, milestones: skillMilestones, sessions: skillSessions },
      plans: { arcs: planArcs, items: planItems, progress, dayOneSnapshots },
      coach: { notes: coachNotes, adaptations },
      evidence,
      commits: { commits, rows: commitRows, progressEffects: commitProgressEffects, planEffects: commitPlanEffects },
    };

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="sarthi-data.json"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "data export failed" }, { status: 500 });
  }
}
