import { getSession } from "@/app/lib/session";
import { getRuntimeConfig } from "@/app/lib/runtime";
import { SettingsSheet } from "@/components/settings/SettingsSheet";

/** Screen title left, with the authenticated Settings/Profile sheet on the right. */
export async function AppHeader({ title }: { title: string }) {
  const [{ user, repos }, config] = await Promise.all([getSession(), Promise.resolve(getRuntimeConfig())]);
  const [profile, gaps] = await Promise.all([repos.profile.profiles.byId(user.userId), repos.profile.gaps.list({})]);

  if (!profile) return null;

  return (
    <header className="flex items-center justify-between px-4 pt-6 pb-2">
      <h1 className="font-display text-title text-ink-1">{title}</h1>
      <SettingsSheet
        profile={profile}
        gaps={gaps}
        isDeveloperControlAllowed={process.env.NODE_ENV !== "production" || config.judgeMode}
        llmProvider={config.llmProvider}
      />
    </header>
  );
}
