import { getSession } from "@/app/lib/session";
import { CoachReadingRoom } from "@/components/coach/CoachReadingRoom";
import { AppHeader } from "@/components/shell/AppHeader";
import { buildCoachReadingView } from "@/core/coach";
import { deriveGameSummary } from "@/core/game";
export const dynamic = "force-dynamic";

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ reentry?: string }> }) {
  const { repos } = await getSession();
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const localTime = { weekday: now.getDay(), hour: now.getHours() };
  const query = await searchParams;
  const [notes, gaps, adaptations, evidence, progress, skills, sessions, items, messages, pinnedMemories] = await Promise.all([repos.coach.notes.list({}), repos.profile.gaps.list({}), repos.coach.adaptations.list({}), repos.evidence.list({}), repos.plans.progress.list({}), repos.skills.skills.list({}), repos.skills.sessions.list({}), repos.plans.items.list({}), repos.coach.messages.list({}), repos.coach.memory.list({ pinned: true, retired: false })]);
  const view = buildCoachReadingView({ localDate, localTime, notes, gaps, adaptations, evidence, messages });
  const game = deriveGameSummary({ localDate, progress, skills, sessions, planItems: items, evidence, adaptations });
  return <><AppHeader title="Coach" /><CoachReadingRoom initial={view} reentryEligible={game.reentryEligible} reentry={query.reentry === "1"} pinnedMemories={pinnedMemories.map(({ id, domain, kind, text }) => ({ id, domain, kind, text }))} /></>;
}
