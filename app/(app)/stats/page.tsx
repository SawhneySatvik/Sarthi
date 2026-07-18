import { getSession } from "@/app/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { StatsWall } from "@/components/stats/StatsWall";
import { buildMoneyView } from "@/core/domains/money";
import { buildSkillsView } from "@/core/domains/skills";
import { buildStatsView } from "@/core/game";
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { repos } = await getSession(); const localDate = new Date().toISOString().slice(0, 10);
  const [progress, snapshots, arcs, transactions, categories, budgets, recurringRules, skills, milestones, sessions, items] = await Promise.all([repos.plans.progress.list({}), repos.plans.dayOneSnapshots.list({}), repos.plans.arcs.list({}), repos.money.transactions.list({}), repos.money.categories.list({}), repos.money.budgets.list({}), repos.money.recurringRules.list({ isPaused: false }), repos.skills.skills.list({ isArchived: false }), repos.skills.milestones.list({}), repos.skills.sessions.list({}), repos.plans.items.list({})]);
  const money = buildMoneyView({ localDate, transactions, categories, budgets, recurringRules }); const skillView = buildSkillsView({ localDate, skills, milestones, sessions });
  const healthItems = items.filter((item) => item.domain === "health"); const done = healthItems.filter((item) => item.status === "done").length;
  const view = buildStatsView({ progress, snapshots, arc: arcs.find((arc) => arc.status === "active") ?? null, money, skills: skillView, healthAdherenceBps: healthItems.length ? Math.floor((done * 10000) / healthItems.length) : 0, habitsBestStreak: progress.find((row) => row.domain === "habits")?.bestStreak ?? 0 });
  return <><AppHeader title="Stats" /><StatsWall view={view} /></>;
}
