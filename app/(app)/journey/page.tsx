import { getSession } from "@/app/lib/session";
import { JourneyRail } from "@/components/journey/JourneyRail";
import { AppHeader } from "@/components/shell/AppHeader";
import { buildJourneyView } from "@/core/game";
export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const { repos } = await getSession(); const [evidence, notes, progress, arcs, skills, sessions, planItems, reflections, media] = await Promise.all([repos.evidence.list({}), repos.coach.notes.list({}), repos.plans.progress.list({}), repos.plans.arcs.list({}), repos.skills.skills.list({}), repos.skills.sessions.list({}), repos.plans.items.list({}), repos.journey.reflections.list({}), repos.journey.media.list({})]);
  return <><AppHeader title="Journey" /><JourneyRail view={buildJourneyView({ evidence, notes, progress, arcs, skills, sessions, planItems })} reflections={reflections} media={media} /></>;
}
