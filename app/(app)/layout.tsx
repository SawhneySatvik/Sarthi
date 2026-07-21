import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/session";
import { CaptureLauncher } from "@/components/capture/CaptureLauncher";
import { LocalReminders } from "@/components/pwa/LocalReminders";
import { BottomNav } from "@/components/shell/BottomNav";
import { LeftRail } from "@/components/shell/LeftRail";
import { ToolsProvider, ToolsResumeRibbon } from "@/components/tools/ToolsProvider";

// SAR-012 (D-A) — the gate reads the per-user profile at request time, so the WHOLE app
// subtree must render per-request. A DB read in an async layout is NOT a dynamic signal to
// Next, so without this the other `(app)` routes prerender static and skip the gate.
export const dynamic = "force-dynamic";

/** The app shell: nav (bottom bar mobile / left rail desktop), the global capture
 *  bar, and a reading-width shell that expands to the desktop canvas at lg. Per-screen
 *  headers live inside each page.
 *
 *  SAR-012 (D-A) — this shell is the single onboarding gate for every app screen.
 *  A missing profile row (fresh DB) or any `onboardingStatus !== 'complete'` redirects
 *  to `/onboarding` (which sits OUTSIDE this group, so there is no redirect loop). The
 *  session is memoised per request, so this adds one query, not one per page. API routes
 *  are ungated (capture stays callable). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, repos } = await getSession();
  const profile = await repos.profile.profiles.byId(user.userId);
  if (!profile || profile.onboardingStatus !== "complete") {
    redirect("/onboarding");
  }

  return (
    <ToolsProvider>
      <div className="min-h-screen bg-canvas text-ink-1 md:pl-[var(--w-rail-compact)] lg:pl-[var(--w-rail-expanded)]">
        <LeftRail />
        <div className="mx-auto flex min-h-screen max-w-[45rem] flex-col md:max-w-[var(--w-reading)] lg:max-w-[var(--w-canvas)]">
          <main className="flex-1 pb-44 md:pb-32">{children}</main>
        </div>
        <ToolsResumeRibbon />
        <CaptureLauncher />
        <BottomNav />
        {/* Renders nothing — arms the opt-in local reminder scheduler for the session (reads
            only, never prompts). */}
        <LocalReminders />
      </div>
    </ToolsProvider>
  );
}
