import { getSession } from "@/app/lib/session";
import { getRuntimeConfig } from "@/app/lib/runtime";
import { AppHeader } from "@/components/shell/AppHeader";
import { ToolsDesk } from "@/components/tools/ToolsDesk";
import { loadToolsView } from "@/core/tools";

export const dynamic = "force-dynamic";

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ resume?: string; shot?: string }> }) {
  const { repos } = await getSession();
  const query = await searchParams;
  const localDate = new Date().toISOString().slice(0, 10);
  const view = await loadToolsView(repos, localDate);
  const config = getRuntimeConfig();
  const screenshotMeditationConsent = query.shot === "meditation-consent" && (process.env.NODE_ENV !== "production" || config.judgeMode);
  return <><AppHeader title="Tools" /><ToolsDesk view={view} resumeRun={query.resume === "1"} screenshotMeditationConsent={screenshotMeditationConsent} /></>;
}
