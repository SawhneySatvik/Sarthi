"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/app/lib/utils";

import { NAV_DESTINATIONS, isActive } from "./nav";

/** Desktop primary navigation: compact at md, labelled at lg; mobile keeps BottomNav. */
export function LeftRail() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center gap-2 border-r border-line bg-card py-6 md:flex md:w-[var(--w-rail-compact)] lg:w-[var(--w-rail-expanded)] lg:items-stretch lg:px-3"
    >
      {NAV_DESTINATIONS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-card transition-colors duration-[var(--t-fast)] lg:w-full lg:justify-start lg:gap-3 lg:px-3",
              active ? "bg-raised text-ink-1" : "text-ink-2",
            )}
          >
            <Icon size={22} strokeWidth={1.5} aria-hidden />
            <span className="sr-only lg:not-sr-only lg:font-ui lg:text-body">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
