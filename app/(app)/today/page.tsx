import { getSession } from "@/app/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { TodayBody } from "@/components/today/TodayBody";
import { buildTodayView } from "@/core/domains/today";

// Reads the per-user SQLite scope at request time — never statically generated.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { repos } = await getSession();
  // NOTE: UTC day boundary for now — the timezone-aware localDate (schema carries
  // `timezone`) is owned by the SAR-006 capture edge; seed + page agree meanwhile.
  const localDate = new Date().toISOString().slice(0, 10);

  const [items, progress, arcs, notes] = await Promise.all([
    repos.plans.items.list({ localDate }),
    repos.plans.progress.list({}),
    repos.plans.arcs.list({}),
    repos.coach.notes.list({ scope: "daily", localDate }),
  ]);

  const view = buildTodayView({
    localDate,
    items,
    progress,
    arcs,
    coachNote: notes[0] ?? null,
  });

  return (
    <>
      <AppHeader title="Today" />
      <TodayBody view={view} />
    </>
  );
}
