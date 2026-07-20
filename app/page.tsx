import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { deriveGameSummary } from "@/core/game";

// Reads the per-user SQLite scope at request time — never statically generated.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { repos } = await getSession(); const localDate = new Date().toISOString().slice(0, 10);
  const [progress, skills, sessions, planItems, evidence, adaptations] = await Promise.all([repos.plans.progress.list({}), repos.skills.skills.list({}), repos.skills.sessions.list({}), repos.plans.items.list({}), repos.evidence.list({}), repos.coach.adaptations.list({})]);
  const game = deriveGameSummary({ localDate, progress, skills, sessions, planItems, evidence, adaptations });
  redirect(game.reentryEligible ? "/coach?reentry=1" : "/today");
}
