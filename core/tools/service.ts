/**
 * Explicit Tools use cases. These commands accept only deliberate timer results,
 * resolve every scoped row server-side, and call the shared typed commit seam.
 */
import type { CommitResult, CommitService } from "@/core/capture";
import type { UserScopedRepositories } from "@/core/contracts";
import type { SkillRecord } from "@/data/schema/contract";

import {
  completeFocusInputSchema,
  completeMeditationInputSchema,
  createToolSkillInputSchema,
  type CompleteFocusInput,
  type CompleteMeditationInput,
  type CreateToolSkillInput,
} from "./contract";

export class ToolCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolCommandError";
  }
}

export interface ToolsService {
  createSkill(input: CreateToolSkillInput): Promise<SkillRecord>;
  completeFocus(input: CompleteFocusInput): Promise<CommitResult>;
  completeMeditation(input: CompleteMeditationInput): Promise<{ status: "declined" } | CommitResult>;
}

function localDateAt(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = read("year");
  const month = read("month");
  const day = read("day");
  if (!year || !month || !day) throw new ToolCommandError("could not derive the local tool date");
  return `${year}-${month}-${day}`;
}

function ensureTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    throw new ToolCommandError("tool timezone must be a valid IANA zone");
  }
}

/**
 * The UI sends no date/user/payload. The authenticated route picks the server's
 * configured zone (UTC on the keyless local stack), and this service derives the
 * final timestamp/date and resolves records through the bound repository scope.
 */
export function createToolsService(options: {
  repos: UserScopedRepositories;
  commits: CommitService;
  now?: () => string;
  timeZone?: string;
}): ToolsService {
  const { repos, commits } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const timeZone = options.timeZone ?? "UTC";
  ensureTimeZone(timeZone);

  return {
    async createSkill(rawInput) {
      const input = createToolSkillInputSchema.parse(rawInput);
      const normalized = input.name.toLocaleLowerCase();
      const existing = (await repos.skills.skills.list({ isArchived: false })).find(
        (skill) => skill.name.toLocaleLowerCase() === normalized,
      );
      if (existing) return existing;
      return repos.skills.skills.create({ name: input.name, targetMinutes: null, isArchived: false });
    },

    async completeFocus(rawInput) {
      const input = completeFocusInputSchema.parse(rawInput);
      const skill = await repos.skills.skills.byId(input.skillId);
      if (!skill || skill.isArchived) throw new ToolCommandError("selected skill is unavailable");
      const occurredAt = now();
      return commits.commit({
        kind: "tool",
        tool: "focus",
        idempotencyKey: input.idempotencyKey,
        skillId: skill.id,
        minutes: input.minutes,
        occurredAt,
        localDate: localDateAt(occurredAt, timeZone),
        timezone: timeZone,
      });
    },

    async completeMeditation(rawInput) {
      const input = completeMeditationInputSchema.parse(rawInput);
      // A declined consent sheet has no command and therefore no write, XP, or commit.
      if (!input.consented) return { status: "declined" };
      const activeHabits = await repos.habits.habits.list({ isArchived: false });
      const meditate = activeHabits.find((habit) => habit.name.toLocaleLowerCase() === "meditate");
      const occurredAt = now();
      const localDate = localDateAt(occurredAt, timeZone);
      if (meditate) {
        const alreadyLogged = (await repos.habits.logs.list({ localDate })).some((log) => log.habitId === meditate.id);
        if (alreadyLogged) throw new ToolCommandError("Meditation is already logged for this day");
      }
      return commits.commit({
        kind: "tool",
        tool: "meditation",
        idempotencyKey: input.idempotencyKey,
        habit: meditate ? { mode: "existing", habitId: meditate.id } : { mode: "create" },
        minutes: input.minutes,
        occurredAt,
        localDate,
        timezone: timeZone,
      });
    },
  };
}
