"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/app/lib/utils";

import { NAV_DESTINATIONS, isActive } from "./nav";

/** Mobile bottom tab bar (hidden on desktop, where the LeftRail takes over). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_DESTINATIONS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 font-ui text-caption transition-colors duration-[var(--t-fast)]",
              active ? "text-ink-1" : "text-ink-2",
            )}
          >
            <Icon size={22} strokeWidth={1.5} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
