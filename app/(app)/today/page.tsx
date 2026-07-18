import { getSession } from "@/app/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { TodayBody } from "@/components/today/TodayBody";
import { buildHealthView } from "@/core/domains/health";
import { buildMoneyView } from "@/core/domains/money";
import { buildTodayView } from "@/core/domains/today";

// Reads the per-user SQLite scope at request time — never statically generated.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { repos } = await getSession();
  // NOTE: UTC day boundary for now — the timezone-aware localDate (schema carries
  // `timezone`) is owned by the SAR-006 capture edge; seed + page agree meanwhile.
  const localDate = new Date().toISOString().slice(0, 10);

  const [items, progress, arcs, notes, meals, waterLogs, workouts, weighIns, transactions, categories, budgets, recurringRules] =
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
    ]);

  const view = buildTodayView({
    localDate,
    items,
    progress,
    arcs,
    coachNote: notes[0] ?? null,
  });
  const healthView = buildHealthView({ meals, waterLogs, workouts, weighIns });
  const moneyView = buildMoneyView({ localDate, transactions, categories, budgets, recurringRules });

  return (
    <>
      <AppHeader title="Today" />
      <TodayBody view={view} healthView={healthView} moneyView={moneyView} />
    </>
  );
}
