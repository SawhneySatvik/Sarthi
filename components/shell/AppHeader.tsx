import { getSession } from "@/app/lib/session";
import { getRuntimeConfig } from "@/app/lib/runtime";
import { SettingsSheet } from "@/components/settings/SettingsSheet";
import { buildIdentity } from "@/core/domains/today";

/** Screen title left, with the authenticated Settings/Profile sheet on the right. */
export async function AppHeader({ title }: { title: string }) {
  const [{ user, repos }, config] = await Promise.all([getSession(), Promise.resolve(getRuntimeConfig())]);
  // Progress + arcs feed the sheet's identity header (Day N · Level L) through the shared
  // `buildIdentity` — the SAME projection `view.stat` and the Stats wall use, so the number
  // can never contradict them. Two bounded scoped reads on tabs that lack a full Today view.
  const [profile, gaps, progress, arcs] = await Promise.all([
    repos.profile.profiles.byId(user.userId),
    repos.profile.gaps.list({}),
    repos.plans.progress.list({}),
    repos.plans.arcs.list({}),
  ]);

  if (!profile) return null;

  return (
    <header className="flex items-center justify-between px-4 pt-6 pb-2">
      <h1 className="font-display text-title text-ink-1">{title}</h1>
      <SettingsSheet
        profile={profile}
        gaps={gaps}
        identity={buildIdentity({ progress, arcs })}
        isDeveloperControlAllowed={process.env.NODE_ENV !== "production" || config.judgeMode}
        llmProvider={config.llmProvider}
      />
    </header>
  );
}
