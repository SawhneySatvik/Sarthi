import { CaptureLauncher } from "@/components/capture/CaptureLauncher";
import { ThemeSwitcher } from "@/components/dev/ThemeSwitcher";
import { BottomNav } from "@/components/shell/BottomNav";
import { LeftRail } from "@/components/shell/LeftRail";

/** The app shell: nav (bottom bar mobile / left rail desktop), the global capture
 *  bar, and a 720px content column. Per-screen headers live inside each page. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
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
