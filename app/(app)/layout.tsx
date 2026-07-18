import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/session";
import { CaptureLauncher } from "@/components/capture/CaptureLauncher";
import { ThemeSwitcher } from "@/components/dev/ThemeSwitcher";
import { BottomNav } from "@/components/shell/BottomNav";
import { LeftRail } from "@/components/shell/LeftRail";

// SAR-012 (D-A) — the gate reads the per-user profile at request time, so the WHOLE app
// subtree must render per-request. A DB read in an async layout is NOT a dynamic signal to
// Next, so without this the other `(app)` routes prerender static and skip the gate.
export const dynamic = "force-dynamic";

/** The app shell: nav (bottom bar mobile / left rail desktop), the global capture
 *  bar, and a 720px content column. Per-screen headers live inside each page.
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
    <div className="min-h-screen bg-canvas text-ink-1 md:pl-16">
      <LeftRail />
      <div className="mx-auto flex min-h-screen max-w-[45rem] flex-col">
        <main className="flex-1 pb-44 md:pb-32">{children}</main>
      </div>
      <CaptureLauncher />
      <BottomNav />
      <ThemeSwitcher />
    </div>
  );
}
