/** Pure/read-only Tools desk model. It deliberately exposes no tenant identity. */
import type { UserScopedRepositories } from "@/core/contracts";
import type { PlanItemRecord, SkillRecord, SkillSessionRecord } from "@/data/schema/contract";

export interface ToolSkillOption {
  id: string;
  name: string;
  targetMinutes: number | null;
  masteryMinutes: number;
}

export interface ToolsView {
  focus: { skills: readonly ToolSkillOption[]; defaultSkillId: string | null };
  meditation: { hasMeditateHabit: boolean; completedToday: boolean };
  todayPlanItems: readonly Pick<PlanItemRecord, "id" | "domain" | "title" | "status">[];
}

function bySessionRecency(a: SkillSessionRecord, b: SkillSessionRecord): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function toSkillOption(skill: SkillRecord, sessions: readonly SkillSessionRecord[]): ToolSkillOption {
  let masteryMinutes = 0;
  for (const session of sessions) masteryMinutes += session.minutes;
  return { id: skill.id, name: skill.name, targetMinutes: skill.targetMinutes, masteryMinutes };
}

export async function loadToolsView(repos: UserScopedRepositories, localDate: string): Promise<ToolsView> {
  const [skills, sessions, habits, logs, planItems] = await Promise.all([
    repos.skills.skills.list({ isArchived: false }),
    repos.skills.sessions.list({}),
    repos.habits.habits.list({ isArchived: false }),
    repos.habits.logs.list({ localDate }),
    repos.plans.items.list({ localDate }),
  ]);
  const sessionBySkill = new Map<string, SkillSessionRecord[]>();
  for (const session of sessions) {
    const bucket = sessionBySkill.get(session.skillId);
    if (bucket) bucket.push(session);
    else sessionBySkill.set(session.skillId, [session]);
  }
  const orderedSkills = skills
    .slice()
    .sort((a, b) => (a.name === b.name ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name)));
  const newest = sessions.slice().sort(bySessionRecency)[0] ?? null;
  const defaultSkillId = newest && orderedSkills.some((skill) => skill.id === newest.skillId) ? newest.skillId : orderedSkills[0]?.id ?? null;
  const meditate = habits.find((habit) => habit.name.toLocaleLowerCase() === "meditate") ?? null;

  return {
    focus: {
      skills: orderedSkills.map((skill) => toSkillOption(skill, sessionBySkill.get(skill.id) ?? [])),
      defaultSkillId,
    },
    meditation: {
      hasMeditateHabit: meditate !== null,
      completedToday: meditate !== null && logs.some((log) => log.habitId === meditate.id && log.status === "done"),
    },
    todayPlanItems: planItems.map((item) => ({ id: item.id, domain: item.domain, title: item.title, status: item.status })),
  };
}
