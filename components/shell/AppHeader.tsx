import { UserRound } from "lucide-react";

/** Screen title left, avatar right → Settings/Profile sheet (a stub in SAR-005). */
export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between px-4 pt-6 pb-2">
      <h1 className="font-display text-title text-ink-1">{title}</h1>
      <button
        type="button"
        aria-label="Settings and profile"
        className="flex h-8 w-8 items-center justify-center rounded-chip border border-line bg-raised text-ink-2 transition-colors duration-[var(--t-fast)]"
      >
        <UserRound size={18} strokeWidth={1.5} aria-hidden />
      </button>
    </header>
  );
}
