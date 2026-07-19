import { Compass, House, MessageCircle, TrendingUp, Wrench, type LucideIcon } from "lucide-react";

/** The five primary destinations (DESIGN.md §6). Settings is a header sheet, not a tab. */
export interface NavDestination {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { href: "/today", label: "Today", Icon: House },
  { href: "/journey", label: "Journey", Icon: Compass },
  { href: "/coach", label: "Coach", Icon: MessageCircle },
  { href: "/stats", label: "Stats", Icon: TrendingUp },
  { href: "/tools", label: "Tools", Icon: Wrench },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
