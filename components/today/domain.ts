import type { PlanItemRecord } from "@/data/schema/contract";

type Domain = PlanItemRecord["domain"];

export const DOMAIN_LABEL: Record<Domain, string> = {
  overall: "Overall",
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

/** Left-edge domain tick colour (token-driven; brand hue per domain). */
export const DOMAIN_DOT: Record<Domain, string> = {
  overall: "bg-ink-3",
  health: "bg-health",
  money: "bg-money",
  habits: "bg-habits",
  skills: "bg-skills",
};
