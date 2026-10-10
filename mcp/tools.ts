/**
 * mcp/tools.ts — Sarthi's ChatGPT tool handlers (DEVDAY-0 A3). No transport code.
 *
 * ChatGPT fills `ModelEntry` args; SARTHI decides what is safe to write:
 *   ModelEntry → Proposal (server-side integer unit conversion, ask-don't-invent)
 *   → verifyAgainstText (numbers not in the user's words are demoted to estimates)
 *   → routeProposal → resolveProposal → only `auto` rows commit via the commit service.
 * Everything else becomes a card that only the user's tap (`confirm_entry`, app-only)
 * can file. Every write goes through the existing typed, undoable commit service.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  applyUserEdit,
  proposalSchema,
  resolveProposal,
  routeProposal,
  UndoNotAvailableError,
  verifyAgainstText,
  type ClarificationQuestion,
  type CommitService,
  type Proposal,
  type ProposalDomain,
  type ProposalKind,
  type ResolvedProposal,
} from "@/core/capture";
import type { DecisionProvider, UserScopedRepositories } from "@/core/contracts";
import { formatPaise } from "@/core/domains/money";
import { isValidTimeZone, localDateInZone } from "@/core/time";
import { kilogramsToGrams, rupeesToPaise } from "@/core/tools/units";

import { decisionsFor, lunaCheck, type DecisionsSummary } from "./decisions";
import { buildToday, type TodaySummary } from "./today";
import { ensureOverallArc, todayTodos, type Todo } from "./todos";

/* ── Contract types (shared with mcp/panel.html) ─────────────────────────── */

export interface Card {
  cardId: string;
  kind: ProposalKind;
  domain: ProposalDomain;
  title: string;
  valueLabel: string;
  value: number | null;
  unit: string;
  reasons: string[];
  proposal: unknown;
}
export interface Filed {
  cardId: string;
  kind: ProposalKind;
  domain: ProposalDomain;
  title: string;
  valueLabel: string;
}
export interface Question {
  questionId: string;
  prompt: string;
  options: string[] | null;
}
// A type alias (not an interface) so it satisfies the SDK's `{ [k: string]: unknown }` structuredContent.
export type SarthiState = {
  filed: Filed[];
  pending: Card[];
  questions: Question[];
  today: TodaySummary;
  lastCommitId: string | null;
  confirmedCardId?: string;
  message: string;
  /** The user's own Sarthi space — the only names the model may use. */
  space?: SpaceNames;
  /** Today's to-dos (overall-arc milestones). Absent on identity-less/error states — keep the previous list. */
  todos?: Todo[];
  /** Luna (Decisions API) usage for this call, when it was consulted. */
  decisions?: DecisionsSummary;
};
export type SpaceNames = { categories: string[]; habits: string[]; skills: string[] };
export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent: SarthiState;
  isError?: boolean;
  /** Result-level metadata for the panel only — the model never sees `_meta`. */
  _meta?: Record<string, unknown>;
}

export interface ToolContext {
  repos: UserScopedRepositories;
  service: CommitService;
  userId: string;
  log: (line: string) => void;
  /** Server-side only: details never reach the client. */
  logError: (what: string, error: unknown) => void;
  /** HMAC key binding each pending card to its exact proposal (see `cardToken`). */
  cardKey: Buffer;
  /** When true (default), `confirm_entry` refuses a card without a valid token. */
  requireCardToken: boolean;
  /** Who signed cards belong to: the 24-char ChatGPT-user hash, or "local-dev". Defaults to `userId`. */
  ownerKey?: string;
  /** A per-request IANA zone (ChatGPT `openai/userLocation.timezone`), tried before the profile zone. */
  timezoneOverride?: string | null;
  /** Zone when neither the override nor the profile has a valid one. Default "UTC". */
  fallbackTimezone?: string;
  now?: () => string;
  /** Luna decision provider override (tests); defaults to the env-selected process singleton. */
  decisions?: DecisionProvider;
}

/* ── Zod shapes (model-facing input + SarthiState output) ────────────────── */

const kindEnum = z.enum(["transaction", "meal", "water", "workout", "weighIn", "habitLog", "skillSession"]);
const domainEnum = z.enum(["health", "money", "habits", "skills"]);

/* ── Input caps (public tunnel, no auth): bounded strings, arrays and numbers ── */
export const MAX_TEXT_CHARS = 2000;
export const MAX_ENTRIES = 20;
export const MAX_FIELD_CHARS = 200;
export const MAX_NUMBER = 10_000_000;
const shortText = () => z.string().max(MAX_FIELD_CHARS);
/** Finite, non-negative and within sane bounds (zod 4 numbers already reject NaN/Infinity). */
export const bounded = () => z.number().min(0).max(MAX_NUMBER);

export const modelEntrySchema = z.object({
  kind: kindEnum.describe(
    "Which Sarthi store this entry goes to: transaction (money spent/received), meal (food eaten), water (drink), workout (exercise), weighIn (body weight), habitLog (a tracked habit done/skipped), skillSession (time practising a tracked skill).",
  ),
  estimated: z
    .boolean()
    .describe("true if you guessed or computed ANY number in this entry (e.g. kcal of a meal, ml in 'a bottle'). false only if every number was said literally by the user."),
  confidence: z.number().min(0).max(100).describe("Your confidence 0-100 that this entry is right."),
  label: shortText().optional().describe("Short human title, e.g. 'Lunch' or '2 rotis, dal'."),
  amountRupees: bounded().optional().describe("transaction only: amount in rupees exactly as the user said it (e.g. 340)."),
  direction: z.enum(["expense", "income"]).optional().describe("transaction only: expense (default) or income."),
  category: shortText().optional().describe("transaction only: one of the user's existing money categories, verbatim."),
  merchant: shortText().optional().describe("transaction only: shop/merchant if the user named one."),
  kcal: bounded().optional().describe("meal only: total calories (integer). Mark estimated:true if you computed it."),
  proteinGrams: bounded().optional().describe("meal only: protein grams, only if stated or reasonably known."),
  items: z
    .array(
      z.object({
        name: shortText().describe("Food item, e.g. 'roti'."),
        quantity: bounded().describe("Integer count of the unit, e.g. 2."),
        unit: shortText().describe("e.g. 'piece', 'bowl', 'cup'."),
      }),
    )
    .max(MAX_ENTRIES)
    .optional()
    .describe("meal only: the foods eaten."),
  millilitres: bounded().optional().describe("water only: volume in ml. Omit if the user did not say a volume (e.g. 'a bottle') rather than guessing."),
  durationMinutes: bounded().optional().describe("workout only: duration in whole minutes."),
  burnKcal: bounded().optional().describe("workout only: calories burned, only if the user said it."),
  exercise: shortText().optional().describe("workout only: the exercise, e.g. 'run', 'squats'."),
  weightKg: bounded().optional().describe("weighIn only: body weight in kg as said (e.g. 72.5)."),
  habitName: shortText().optional().describe("habitLog only: one of the user's existing habits, verbatim."),
  habitStatus: z.enum(["done", "skipped"]).optional().describe("habitLog only: done (default) or skipped."),
  skillName: shortText().optional().describe("skillSession only: one of the user's existing skills, verbatim."),
  minutes: bounded().optional().describe("skillSession only: minutes practised."),
});
export type ModelEntry = z.infer<typeof modelEntrySchema>;

const cardSchema = z.object({
  cardId: z.string(),
  kind: kindEnum,
  domain: domainEnum,
  title: z.string(),
  valueLabel: z.string(),
  value: z.number().nullable(),
  unit: z.string(),
  reasons: z.array(z.string()),
  proposal: z.unknown(),
});
const filedSchema = z.object({
  cardId: z.string(),
  kind: kindEnum,
  domain: domainEnum,
  title: z.string(),
  valueLabel: z.string(),
});
const questionSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
});
const todaySchema = z.object({
  localDate: z.string(),
  health: z.object({ kcalIn: z.number(), waterMl: z.number(), workoutMin: z.number() }),
  money: z.object({ spentPaise: z.number(), spentLabel: z.string() }),
  habits: z.object({ done: z.number(), total: z.number() }),
  skills: z.object({ minutes: z.number() }),
  xp: z.object({ total: z.number(), level: z.number() }),
});
/** Raw zod shape of `SarthiState` — the `outputSchema` of every tool. */
export const sarthiStateShape = {
  filed: z.array(filedSchema),
  pending: z.array(cardSchema),
  questions: z.array(questionSchema),
  today: todaySchema,
  lastCommitId: z.string().nullable(),
  confirmedCardId: z.string().optional(),
  message: z.string(),
  space: z.object({ categories: z.array(z.string()), habits: z.array(z.string()), skills: z.array(z.string()) }).optional(),
  todos: z.array(z.object({ id: z.string(), title: z.string(), status: z.string() })).optional(),
  decisions: z.object({ provider: z.string(), calls: z.number(), cached: z.number(), checked: z.number() }).optional(),
};

/* ── Context helpers ─────────────────────────────────────────────────────── */

export interface DayContext {
  now: string;
  timezone: string;
  localDate: string;
}

export async function dayContext(ctx: ToolContext): Promise<DayContext> {
  const profile = await ctx.repos.profile.profiles.byId(ctx.userId);
  const override = ctx.timezoneOverride ?? "";
  const timezone = override && isValidTimeZone(override)
    ? override
    : isValidTimeZone(profile?.timezone ?? "")
      ? profile!.timezone
      : (ctx.fallbackTimezone ?? "UTC");
  const now = ctx.now ? ctx.now() : new Date().toISOString();
  return { now, timezone, localDate: localDateInZone(now, timezone) };
}

/** The real entity names the model must pick from (exact, case-insensitive resolution). */
export async function entityNames(repos: UserScopedRepositories): Promise<SpaceNames> {
  const [categories, habits, skills] = await Promise.all([
    repos.money.categories.list({}),
    repos.habits.habits.list({}),
    repos.skills.skills.list({}),
  ]);
  return {
    categories: categories.map((c) => c.name),
    habits: habits.filter((h) => !h.isArchived).map((h) => h.name),
    skills: skills.filter((s) => !s.isArchived).map((s) => s.name),
  };
}

function quote(names: readonly string[]): string {
  return names.length ? names.map((n) => `"${n}"`).join(", ") : "(none set up yet)";
}

const SPACE_RULE =
  "Use names from the user's Sarthi space (returned as `space` by get_today/setup_space). If a habit/skill isn't in their space, ask whether to add it with setup_space — never invent.";

/** Generic description (multi-user: names are per-user, so they come back as `space`). */
export const LOG_ENTRIES_GENERIC_DESCRIPTION = [
  "Log what the user said about their day into Sarthi (Health, Money, Habits, Skills) as typed entries.",
  "Pass the user's words VERBATIM in `text` and one entry per thing they did in `entries`.",
  "Sarthi's server files only numbers the user literally said; anything you estimate (meal kcal, ml in 'a bottle') becomes a card the user confirms in the Sarthi panel — set estimated:true for those. You cannot confirm cards yourself.",
  SPACE_RULE,
].join(" ");

export async function logEntriesDescription(repos: UserScopedRepositories): Promise<string> {
  const names = await entityNames(repos);
  return [
    "Log what the user said about their day into Sarthi (Health, Money, Habits, Skills) as typed entries.",
    "Pass the user's words VERBATIM in `text` and one entry per thing they did in `entries`.",
    "Sarthi's server files only numbers the user literally said; anything you estimate (meal kcal, ml in 'a bottle') becomes a card the user confirms in the Sarthi panel — set estimated:true for those. You cannot confirm cards yourself.",
    "Use these EXACT names (no others; if nothing fits, still pass your best name and Sarthi will ask):",
    `money categories: ${quote(names.categories)};`,
    `habits: ${quote(names.habits)};`,
    `skills: ${quote(names.skills)}.`,
    SPACE_RULE,
  ].join(" ");
}

function domainOf(kind: ProposalKind): ProposalDomain {
  switch (kind) {
    case "transaction":
      return "money";
    case "habitLog":
      return "habits";
    case "skillSession":
      return "skills";
    default:
      return "health";
  }
}

/** A finite non-negative number → integer (count units: kcal, ml, minutes, grams). */
function toCount(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) return null;
  const rounded = Math.round(value);
  return Number.isSafeInteger(rounded) ? rounded : null;
}

/** 0-100 → basis points, taken literally (the schema says 0-100). */
function clampBps(confidence: number): number {
  const bps = Math.round(confidence * 100);
  return Math.min(10000, Math.max(0, bps));
}

function question(prompt: string, options: string[] | null = null): Question {
  return { questionId: randomUUID(), prompt, options };
}

function fromClarification(q: ClarificationQuestion): Question {
  return { questionId: q.questionId, prompt: q.prompt, options: q.options };
}

type MapOutcome = { proposal: Proposal } | { question: Question };

/** ModelEntry → Proposal. Picks fields per kind (never spreads); missing required → Question. */
export function toProposal(
  entry: ModelEntry,
  day: DayContext,
  names: { categories: string[]; habits: string[]; skills: string[] },
): MapOutcome {
  const base = {
    proposalId: randomUUID(),
    domain: domainOf(entry.kind),
    intent: "create" as const,
    occurredAt: day.now,
    localDate: day.localDate,
    timezone: day.timezone,
    estimated: entry.estimated,
    confidenceBps: clampBps(entry.confidence),
    why: { basis: "ChatGPT tool call", assumptions: [] as string[] },
    evidenceRefs: [],
  };
  const label = entry.label?.trim() || null;

  switch (entry.kind) {
    case "transaction": {
      const amountPaise = entry.amountRupees === undefined ? null : rupeesToPaise(String(entry.amountRupees));
      if (amountPaise === null) {
        return { question: question(`How much was ${label ?? "that"}? The amount wasn't clear, so nothing was filed.`) };
      }
      const category = entry.category?.trim();
      if (!category) {
        return {
          question: question(`Which category is ${formatPaise(amountPaise)}${label ? ` (${label})` : ""}? Nothing was filed.`, names.categories),
        };
      }
      return {
        proposal: {
          ...base,
          kind: "transaction",
          payload: {
            direction: entry.direction ?? "expense",
            amountPaise,
            categoryName: category,
            merchant: entry.merchant?.trim() || null,
            note: label,
          },
        },
      };
    }
    case "meal": {
      const kcal = toCount(entry.kcal);
      if (kcal === null) {
        return { question: question(`About how many kcal was ${label ?? "that meal"}? Nothing was filed.`) };
      }
      return {
        proposal: {
          ...base,
          kind: "meal",
          payload: {
            kcal,
            proteinGrams: toCount(entry.proteinGrams),
            carbsGrams: null,
            fatGrams: null,
            items: (entry.items ?? []).map((item) => ({
              name: item.name,
              quantity: toCount(item.quantity) ?? 1,
              unit: item.unit,
            })),
            note: label ?? ((entry.items ?? []).map((i) => i.name).join(", ") || null),
          },
        },
      };
    }
    case "water":
      return { proposal: { ...base, kind: "water", payload: { millilitres: toCount(entry.millilitres) } } };
    case "workout": {
      const durationMinutes = toCount(entry.durationMinutes);
      if (durationMinutes === null) {
        return { question: question(`How long was ${label ?? "the workout"}? Nothing was filed.`) };
      }
      return {
        proposal: {
          ...base,
          kind: "workout",
          payload: {
            durationMinutes,
            burnKcal: toCount(entry.burnKcal),
            exercises: entry.exercise ? [{ name: entry.exercise, sets: null, reps: null, loadGrams: null }] : [],
            note: label,
          },
        },
      };
    }
    case "weighIn": {
      const weightGrams = entry.weightKg === undefined ? null : kilogramsToGrams(String(entry.weightKg));
      if (weightGrams === null || weightGrams === 0) {
        return { question: question("What did you weigh? The number wasn't clear, so nothing was filed.") };
      }
      return { proposal: { ...base, kind: "weighIn", payload: { weightGrams } } };
    }
    case "habitLog": {
      const habitName = entry.habitName?.trim();
      if (!habitName) {
        return { question: question("Which habit was that? Nothing was filed.", names.habits) };
      }
      return {
        proposal: { ...base, kind: "habitLog", payload: { habitName, status: entry.habitStatus ?? "done", note: label } },
      };
    }
    case "skillSession": {
      const skillName = entry.skillName?.trim();
      const minutes = toCount(entry.minutes);
      if (!skillName) {
        return { question: question("Which skill did you practise? Nothing was filed.", names.skills) };
      }
      if (minutes === null) {
        return { question: question(`How many minutes of ${skillName}? Nothing was filed.`) };
      }
      return { proposal: { ...base, kind: "skillSession", payload: { skillName, minutes, note: label } } };
    }
  }
}

/* ── Card / Filed presentation ───────────────────────────────────────────── */

function gramsToKgLabel(grams: number): string {
  const frac = grams % 1000;
  const kg = (grams - frac) / 1000;
  if (frac === 0) return String(kg);
  return `${kg}.${String(frac).padStart(3, "0").replace(/0+$/, "")}`;
}

interface Presentation {
  title: string;
  valueLabel: string;
  value: number | null;
  unit: string;
}

function present(p: Proposal | ResolvedProposal): Presentation {
  const approx = p.estimated ? "≈" : "";
  switch (p.kind) {
    case "transaction": {
      const paise = p.payload.amountPaise;
      return {
        title: p.payload.note ?? p.payload.merchant ?? "Expense",
        valueLabel: formatPaise(paise),
        value: (paise - (paise % 100)) / 100,
        unit: "₹",
      };
    }
    case "meal":
      return { title: p.payload.note ?? "Meal", valueLabel: `${approx}${p.payload.kcal} kcal`, value: p.payload.kcal, unit: "kcal" };
    case "water":
      return p.payload.millilitres === null
        ? { title: "Water", valueLabel: "volume?", value: null, unit: "ml" }
        : { title: "Water", valueLabel: `${approx}${p.payload.millilitres} ml`, value: p.payload.millilitres, unit: "ml" };
    case "workout":
      return {
        title: p.payload.note ?? p.payload.exercises[0]?.name ?? "Workout",
        valueLabel: `${approx}${p.payload.durationMinutes} min`,
        value: p.payload.durationMinutes,
        unit: "min",
      };
    case "weighIn": {
      const kg = gramsToKgLabel(p.payload.weightGrams);
      return { title: "Weigh-in", valueLabel: `${approx}${kg} kg`, value: Number(kg), unit: "kg" };
    }
    case "habitLog": {
      const title = "habitName" in p.payload ? p.payload.habitName : "Habit";
      return { title, valueLabel: p.payload.status, value: null, unit: "" };
    }
    case "skillSession": {
      const title = "skillName" in p.payload ? p.payload.skillName : "Skill session";
      return { title, valueLabel: `${approx}${p.payload.minutes} min`, value: p.payload.minutes, unit: "min" };
    }
  }
}

function toFiled(original: Proposal, resolved: ResolvedProposal): Filed {
  const view = present(original);
  const resolvedView = present(resolved);
  return {
    cardId: original.proposalId,
    kind: original.kind,
    domain: original.domain,
    title: view.title,
    valueLabel: resolvedView.valueLabel,
  };
}

const DERIVED_REASON = /^(estimated value must be confirmed|confidence \d+ below auto threshold)/;

function toCard(proposal: Proposal, routedReasons: readonly string[], extra: readonly string[]): Card {
  const reasons = extra.length > 0 ? [...extra, ...routedReasons.filter((r) => !DERIVED_REASON.test(r))] : [...routedReasons];
  return { cardId: proposal.proposalId, kind: proposal.kind, domain: proposal.domain, ...present(proposal), reasons, proposal };
}

/* ── Results ─────────────────────────────────────────────────────────────── */

function result(state: SarthiState, isError = false): ToolResult {
  return { content: [{ type: "text", text: state.message }], structuredContent: state, ...(isError ? { isError } : {}) };
}

function describeList(items: readonly { title: string; valueLabel: string }[]): string {
  return items.map((i) => `${i.title} ${i.valueLabel}`).join("; ");
}

/* ── Card tokens: only the panel (which received the token in `_meta`) can confirm ── */

export const CARD_TOKENS_META_KEY = "sarthi/cardTokens";

/** Derive the card HMAC key. With MCP_SECRET set, tokens survive restarts. */
export function deriveCardKey(secret: string): Buffer {
  return createHash("sha256").update(`sarthi-card-v1:${secret}`).digest();
}

/** Deterministic JSON: object keys sorted recursively. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const OWNER_KEY = /^[A-Za-z0-9_-]{1,64}$/;

function cardMac(key: Buffer, ownerKey: string, proposal: Proposal): string {
  return createHmac("sha256", key)
    .update(`${proposal.proposalId}.${ownerKey}.${canonicalJson(proposal)}`)
    .digest("hex");
}

/** Owner-bound token: `${ownerKey}.${HMAC(key, cardId + "." + ownerKey + "." + canonicalJSON(proposal))}`. */
export function cardToken(key: Buffer, ownerKey: string, proposal: Proposal): string {
  return `${ownerKey}.${cardMac(key, ownerKey, proposal)}`;
}

/** The signed owner of a valid token for exactly this proposal, else null (constant-time mac check). */
export function verifyCardToken(key: Buffer, proposal: Proposal, token: string | undefined | null): string | null {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const ownerKey = token.slice(0, dot);
  if (!OWNER_KEY.test(ownerKey)) return null;
  const expected = Buffer.from(cardMac(key, ownerKey, proposal));
  const given = Buffer.from(token.slice(dot + 1));
  return given.length === expected.length && timingSafeEqual(given, expected) ? ownerKey : null;
}

function ownerOf(ctx: ToolContext): string {
  return ctx.ownerKey ?? ctx.userId;
}

/* ── Habit-log conflicts (MCP-layer guard; the proper partial-unique-index fix lands on main) ──
 * `habit_logs` is unique on (userId, habitId, localDate) and undo SOFT-deletes, so a second
 * log for the same habit + day — active OR undone earlier — would crash the commit. Detect it
 * read-only before committing and answer honestly instead of writing.
 */
type HabitConflict = { kind: "active" | "undone"; habitName: string; status: string; key: string };

async function habitLogConflict(repos: UserScopedRepositories, proposal: Proposal): Promise<HabitConflict | null> {
  if (proposal.kind !== "habitLog") return null;
  const wanted = proposal.payload.habitName.toLowerCase();
  const habit = (await repos.habits.habits.list({})).find((h) => !h.isArchived && h.name.toLowerCase() === wanted);
  if (!habit) return null; // unknown habit → resolve asks (ask-don't-invent)
  const key = `${habit.id}|${proposal.localDate}`;
  const active = await repos.habits.logs.list({ habitId: habit.id, localDate: proposal.localDate });
  if (active.length > 0) return { kind: "active", habitName: habit.name, status: active[0].status, key };
  // Soft-deleted rows are invisible to the repos; the commit ledger (read-only) still records them.
  const ledger = await repos.commits.rows.list({});
  const undone = ledger.some((row) => {
    if (row.entryKind !== "habitLog" || row.operation !== "create") return false;
    const columns = (row.afterJson as { columns?: Record<string, unknown> } | null)?.columns;
    return columns?.habitId === habit.id && columns?.localDate === proposal.localDate;
  });
  return undone ? { kind: "undone", habitName: habit.name, status: "", key } : null;
}

function habitConflictMessage(conflict: HabitConflict): string {
  return conflict.kind === "active"
    ? `${conflict.habitName} is already marked ${conflict.status} today — nothing to change.`
    : `${conflict.habitName} was undone earlier today — Sarthi can't re-log it until tomorrow (known issue).`;
}

/** True for a unique-constraint violation anywhere in the error/cause chain (SQLite or Postgres). */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 6; e = (e as { cause?: unknown }).cause, depth++) {
    const code = String((e as { code?: unknown }).code ?? "");
    const message = String((e as { message?: unknown }).message ?? "");
    if (code.startsWith("SQLITE_CONSTRAINT") || code === "23505" || /UNIQUE constraint failed|duplicate key/i.test(message)) {
      return true;
    }
  }
  return false;
}

const ALREADY_EXISTS = "That entry already exists for today — nothing was changed.";

/* ── log_entries ─────────────────────────────────────────────────────────── */

export async function logEntries(ctx: ToolContext, input: { text: string; entries: ModelEntry[] }): Promise<ToolResult> {
  const day = await dayContext(ctx);
  const names = await entityNames(ctx.repos);
  const NO_BLOCKS = new Set<string>();

  const autoCommit: { original: Proposal; resolved: ResolvedProposal }[] = [];
  const pending: Card[] = [];
  const questions: Question[] = [];
  const habitNotes: string[] = [];
  const habitKeysInBatch = new Set<string>();

  // Pass 1 (pure): map + the code double-check.
  const checked: { proposal: Proposal; demotedReasons: string[] }[] = [];
  for (const entry of input.entries) {
    const mapped = toProposal(entry, day, names);
    if ("question" in mapped) {
      questions.push(mapped.question);
      continue;
    }
    checked.push(verifyAgainstText(mapped.proposal, input.text));
  }
  // ONE batched Luna call per message: demote-only value checks + picks among existing names.
  const luna = await lunaCheck(
    decisionsFor(ctx.decisions, ctx.log),
    input.text,
    checked.map((c) => c.proposal),
    names,
    ctx.log,
  );
  if (luna.summary) {
    ctx.log(`luna provider=${luna.summary.provider} calls=${luna.summary.calls} cached=${luna.summary.cached} checked=${luna.summary.checked}`);
  }

  // Pass 2: conflicts/dedupe on the (possibly Luna-matched) name, then route → resolve.
  for (const [index, item] of checked.entries()) {
    const proposal = luna.proposals[index];
    const demotedReasons = [...item.demotedReasons, ...luna.reasons[index]];
    const conflict = await habitLogConflict(ctx.repos, proposal);
    if (conflict) {
      habitNotes.push(habitConflictMessage(conflict));
      continue;
    }
    if (proposal.kind === "habitLog") {
      // Same habit twice in one message → log it once (a second row would hit the unique index).
      const habitKey = `${proposal.payload.habitName.toLowerCase()}|${proposal.localDate}`;
      if (habitKeysInBatch.has(habitKey)) continue;
      habitKeysInBatch.add(habitKey);
    }
    const routed = routeProposal(proposal, NO_BLOCKS);
    if (routed.route === "pending") {
      pending.push(toCard(proposal, routed.reasons, demotedReasons));
      continue;
    }
    const outcome = await resolveProposal(proposal, ctx.repos, "auto");
    if (outcome.ok) {
      autoCommit.push({ original: proposal, resolved: outcome.resolved });
    } else {
      pending.push(toCard(proposal, [], [outcome.reason]));
      questions.push(fromClarification(outcome.question));
    }
  }

  let filed: Filed[] = [];
  let lastCommitId: string | null = null;
  const notes: string[] = [];
  if (autoCommit.length > 0) {
    const idempotencyKey = createHash("sha256").update(input.text + JSON.stringify(input.entries)).digest("hex");
    try {
      const proposals = autoCommit.map((a) => a.resolved);
      // A host retry of a live batch replays (no double write). But if that earlier batch was
      // UNDONE, its rows are gone — saying the same thing again is a new, legitimate log. The
      // follow-up key is derived from the undone commit id (deterministic), so a retry of the
      // re-log replays it instead of writing twice; the chain is followed across repeat undos.
      let key = idempotencyKey;
      let commit = await ctx.service.commit({ idempotencyKey: key, kind: "capture", proposals });
      for (let hop = 0; hop < 20 && commit.status === "replayed"; hop++) {
        const prior = await ctx.repos.commits.commits.byId(commit.commitId);
        if (prior?.status !== "undone") break;
        key = `${idempotencyKey}:after-undo:${prior.id}`;
        commit = await ctx.service.commit({ idempotencyKey: key, kind: "capture", proposals });
      }
      lastCommitId = commit.commitId;
      ctx.log(`write commit=${commit.commitId} status=${commit.status} entries=${commit.entries.length} (log_entries)`);
      if (commit.status === "replayed") {
        notes.push("Sarthi already logged this exact message earlier — nothing new was filed.");
      } else {
        filed = autoCommit.map((a) => toFiled(a.original, a.resolved));
      }
    } catch (error) {
      ctx.logError("log_entries commit failed", error);
      const today = await buildToday(ctx.repos, day.localDate);
      const message = isUniqueViolation(error)
        ? ALREADY_EXISTS
        : "Sarthi couldn't save that right now. Nothing was written — please try again.";
      return result({ filed: [], pending, questions, today, lastCommitId: null, message }, true);
    }
  }

  const parts: string[] = [];
  if (luna.summary && luna.summary.checked > 0 && luna.summary.calls + luna.summary.cached > 0) {
    parts.push(`Luna checked ${luna.summary.checked} values.`);
  }
  if (filed.length) parts.push(`Filed (numbers were in the user's words): ${describeList(filed)}.`);
  parts.push(...notes, ...habitNotes);
  if (pending.length) {
    parts.push(
      `${pending.length} need the user's OK in the Sarthi panel (you cannot confirm these): ${describeList(pending)}.`,
    );
  }
  if (questions.length) parts.push(`Sarthi needs an answer before filing: ${questions.map((q) => q.prompt).join(" ")}`);
  if (!parts.length) parts.push("Nothing to log.");

  const today = await buildToday(ctx.repos, day.localDate);
  const cardTokens: Record<string, string> = {};
  for (const card of pending) cardTokens[card.cardId] = cardToken(ctx.cardKey, ownerOf(ctx), card.proposal as Proposal);
  return {
    ...result({
      filed,
      pending,
      questions,
      today,
      lastCommitId,
      message: parts.join(" "),
      ...(luna.summary ? { decisions: luna.summary } : {}),
    }),
    _meta: { [CARD_TOKENS_META_KEY]: cardTokens },
  };
}

/* ── confirm_entry (app-only) ────────────────────────────────────────────── */

function editPatch(proposal: Proposal, value: number): Record<string, unknown> | string {
  const asCount = () => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  switch (proposal.kind) {
    case "transaction": {
      const amountPaise = rupeesToPaise(String(value));
      return amountPaise === null ? "Enter a positive rupee amount (up to 2 decimals)." : { amountPaise };
    }
    case "weighIn": {
      const weightGrams = kilogramsToGrams(String(value));
      return weightGrams === null || weightGrams === 0 ? "Enter a weight in kg." : { weightGrams };
    }
    case "meal":
      return asCount() === null ? "Enter whole kcal." : { kcal: value };
    case "water":
      return asCount() === null || value === 0 ? "Enter whole ml." : { millilitres: value };
    case "workout":
      return asCount() === null ? "Enter whole minutes." : { durationMinutes: value };
    case "skillSession":
      return asCount() === null ? "Enter whole minutes." : { minutes: value };
    case "habitLog":
      return "This card has no number to edit.";
  }
}

export async function confirmEntry(
  ctx: ToolContext,
  input: { proposal: unknown; value?: number | null; cardToken?: string },
): Promise<ToolResult> {
  const day = await dayContext(ctx);
  const fail = async (message: string, questions: Question[] = []) =>
    result(
      { filed: [], pending: [], questions, today: await buildToday(ctx.repos, day.localDate), lastCommitId: null, message },
      true,
    );

  const parsed = proposalSchema.safeParse(input.proposal);
  if (!parsed.success) return fail("That card is not a valid Sarthi entry — nothing was filed.");
  let proposal: Proposal = parsed.data;

  // Server-enforced "only the user's tap confirms": the token was handed only to the panel
  // (result `_meta`), and it binds this exact proposal — a tampered or invented card fails.
  if (ctx.requireCardToken && verifyCardToken(ctx.cardKey, proposal, input.cardToken) !== ownerOf(ctx)) {
    ctx.log("confirm refused: missing/invalid card token");
    return fail("This card can only be confirmed from the Sarthi panel.");
  }

  if (input.value !== undefined && input.value !== null) {
    const patch = editPatch(proposal, input.value);
    if (typeof patch === "string") return fail(`${patch} Nothing was filed.`);
    proposal = applyUserEdit(proposal, patch);
  } else if (proposal.kind === "water" && proposal.payload.millilitres === null) {
    return fail("Enter a volume first — nothing was filed.");
  }

  const conflict = await habitLogConflict(ctx.repos, proposal);
  if (conflict) {
    // Non-error: the card is settled (nothing to write), so the panel clears it.
    ctx.log(`confirm skipped: habit ${conflict.kind} today card=${proposal.proposalId}`);
    return result({
      filed: [],
      pending: [],
      questions: [],
      today: await buildToday(ctx.repos, day.localDate),
      lastCommitId: null,
      confirmedCardId: proposal.proposalId,
      message: habitConflictMessage(conflict),
    });
  }

  const outcome = await resolveProposal(proposal, ctx.repos, "accepted");
  if (!outcome.ok) {
    return fail(`Can't file yet: ${outcome.reason}. Nothing was written.`, [fromClarification(outcome.question)]);
  }

  try {
    const commit = await ctx.service.commit({ idempotencyKey: proposal.proposalId, kind: "tap", proposals: [outcome.resolved] });
    ctx.log(`confirm commit=${commit.commitId} status=${commit.status} card=${proposal.proposalId}`);
    const filedRow = toFiled(proposal, outcome.resolved);
    const replayed = commit.status === "replayed";
    const message = replayed
      ? `${filedRow.title} was already filed.`
      : `Filed ${filedRow.title} ${filedRow.valueLabel} — confirmed by the user's tap.`;
    return result({
      filed: replayed ? [] : [filedRow],
      pending: [],
      questions: [],
      today: await buildToday(ctx.repos, day.localDate),
      lastCommitId: commit.commitId,
      confirmedCardId: proposal.proposalId,
      message,
      space: await entityNames(ctx.repos),
    });
  } catch (error) {
    ctx.logError("confirm_entry commit failed", error);
    return fail(
      isUniqueViolation(error) ? ALREADY_EXISTS : "Sarthi couldn't save that right now. Nothing was written — please try again.",
    );
  }
}

/* ── undo_last ───────────────────────────────────────────────────────────── */

/** Top-level entry kinds a commit creates → human label (child rows like mealItem are skipped). */
const ENTRY_LABELS: Record<string, string> = {
  transaction: "expense",
  meal: "meal",
  water: "water",
  waterLog: "water",
  workout: "workout",
  weighIn: "weigh-in",
  habitLog: "habit log",
  skillSession: "skill session",
};

export async function undoLast(ctx: ToolContext): Promise<ToolResult> {
  const day = await dayContext(ctx);
  // `lastCommitId` is always null here: after an undo (or a refusal) nothing is left to undo.
  const state = async (message: string): Promise<SarthiState> => ({
    filed: [],
    pending: [],
    questions: [],
    today: await buildToday(ctx.repos, day.localDate),
    lastCommitId: null,
    message,
  });

  const committed = (await ctx.repos.commits.commits.list({})).filter((c) => c.status === "committed");
  const latest = committed.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) {
    ctx.log("undo refused: nothing committed");
    return result(await state("Nothing to undo — there is no recent Sarthi batch still undoable."));
  }
  try {
    const rows = (await ctx.repos.commits.rows.list({})).filter((r) => r.commitId === latest.id && r.operation === "create");
    const undone = await ctx.service.undoLatest({ commitId: latest.id, now: day.now });
    const removed = rows.map((r) => ENTRY_LABELS[r.entryKind]).filter((label): label is string => Boolean(label));
    ctx.log(`undo commit=${latest.id} removed=${undone.removedEntryIds.length} restored=${undone.restoredEntryIds.length}`);
    const what = removed.length ? `removed ${removed.join(", ")}` : latest.summary;
    return result(await state(`Undid the last Sarthi batch: ${what}. XP and Today are back to before it.`));
  } catch (error) {
    if (error instanceof UndoNotAvailableError) {
      ctx.log(`undo refused commit=${latest.id}: ${error.message}`);
      const why = /expired/.test(error.message) ? "the 5-minute undo window has passed" : "a newer entry was filed after it";
      return result(await state(`Can't undo — that batch is no longer undoable (${why}). Nothing was changed.`), true);
    }
    throw error;
  }
}

/* ── get_today ───────────────────────────────────────────────────────────── */

export async function getToday(ctx: ToolContext): Promise<ToolResult> {
  const day = await dayContext(ctx);
  const today = await buildToday(ctx.repos, day.localDate);
  const message = `Today (${today.localDate}): ${today.health.kcalIn} kcal in, ${today.health.waterMl} ml water, ${today.health.workoutMin} min workout; spent ${today.money.spentLabel}; habits ${today.habits.done}/${today.habits.total}; ${today.skills.minutes} min of skills; XP ${today.xp.total}, level ${today.xp.level}.`;
  return result({ filed: [], pending: [], questions: [], today, lastCommitId: null, message });
}

/* ── Safety net ──────────────────────────────────────────────────────────── */

const EMPTY_TODAY = (localDate: string): TodaySummary => ({
  localDate,
  health: { kcalIn: 0, waterMl: 0, workoutMin: 0 },
  money: { spentPaise: 0, spentLabel: formatPaise(0) },
  habits: { done: 0, total: 0 },
  skills: { minutes: 0 },
  xp: { total: 0, level: 1 },
});

/**
 * Wrap a handler so no exception text or stack ever reaches the client: details are
 * logged server-side; the caller gets a generic, honest SarthiState error.
 */
export async function safely(ctx: ToolContext, name: string, run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    const res = await run();
    if (!res.structuredContent.space) {
      try {
        res.structuredContent.space = await entityNames(ctx.repos);
      } catch (error) {
        ctx.logError(`${name} space read failed`, error);
      }
    }
    return withTodos(ctx, res, name);
  } catch (error) {
    ctx.logError(`${name} failed`, error);
    let today: TodaySummary;
    try {
      const day = await dayContext(ctx);
      today = await buildToday(ctx.repos, day.localDate);
    } catch {
      today = EMPTY_TODAY(new Date().toISOString().slice(0, 10));
    }
    const message = isUniqueViolation(error)
      ? ALREADY_EXISTS
      : "Sarthi hit a problem and nothing was changed. Please try again.";
    return result({ filed: [], pending: [], questions: [], today, lastCommitId: null, message }, true);
  }
}

/** Attach today's to-dos to a result for `ctx`'s own space (best effort; never another space). */
export async function withTodos(ctx: ToolContext, res: ToolResult, name = "tool"): Promise<ToolResult> {
  if (res.structuredContent.todos) return res;
  try {
    res.structuredContent.todos = await todayTodos(ctx.repos, await dayContext(ctx));
  } catch (error) {
    ctx.logError(`${name} todos read failed`, error);
  }
  return res;
}

/**
 * Like `safely`, for calls with NO resolved identity: the error state carries an EMPTY today
 * and no space, so a failure can never surface another user's (or local-dev's) data.
 */
export async function safelyAnonymous(
  logError: (what: string, error: unknown) => void,
  name: string,
  run: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    logError(`${name} failed`, error);
    const message = isUniqueViolation(error) ? ALREADY_EXISTS : "Sarthi hit a problem and nothing was changed. Please try again.";
    return result(
      { filed: [], pending: [], questions: [], today: EMPTY_TODAY(new Date().toISOString().slice(0, 10)), lastCommitId: null, message },
      true,
    );
  }
}

/* ── Multi-user (MULTI_USER=1): identity, provisioning, routing ────────────── */

export const NO_SUBJECT_MESSAGE = "Couldn't identify your ChatGPT account — ask in the chat.";

/** `cg_` + sha256("sarthi-user-v1:" + subject)[0..24] — the ownerKey is the 24-char hash. */
export function userKeyForSubject(subject: string): { ownerKey: string; userId: string } {
  const ownerKey = createHash("sha256").update(`sarthi-user-v1:${subject}`).digest("hex").slice(0, 24);
  return { ownerKey, userId: `cg_${ownerKey}` };
}

/** A non-error, data-free state for a call that carried no ChatGPT identity. Never local-dev. */
export function noSubjectResult(now: string = new Date().toISOString()): ToolResult {
  return result({
    filed: [],
    pending: [],
    questions: [],
    today: EMPTY_TODAY(now.slice(0, 10)),
    lastCommitId: null,
    message: NO_SUBJECT_MESSAGE,
  });
}

/**
 * The onboarding fresh path's default money categories (mirrors `deriveMoneySpine` in
 * core/onboarding/spine.ts — not exported there, and core/ is out of scope for this lane).
 */
export const DEFAULT_CATEGORIES = [
  { name: "Food & dining", kind: "expense" as const },
  { name: "Transport", kind: "expense" as const },
];
const PROGRESS_DOMAINS = ["overall", "health", "money", "habits", "skills"] as const;

/**
 * First-sight provisioning for a new ChatGPT user — idempotent, one transaction:
 * profile (zone from userLocation) + default categories + zeroed progress rows.
 * No habits, no skills, no history ("empty with basics").
 */
export async function ensureProvisioned(repos: UserScopedRepositories, userId: string, timezone: string): Promise<boolean> {
  return repos.transaction(async () => {
    let created = false;
    if (!(await repos.profile.profiles.byId(userId))) {
      await repos.profile.profiles.create({
        displayName: null,
        birthDate: null,
        heightCm: null,
        weightGrams: null,
        unitSystem: "metric",
        theme: "bone",
        themeMode: "system",
        wakeTimeMinutes: null,
        sleepTimeMinutes: null,
        timeBudgetMinutes: null,
        timezone,
        foodPattern: null,
        screenTimeMinutes: null,
        focusPreference: null,
        careerGoal: null,
        moneyGoal: null,
        plan: "free",
        onboardingStatus: "complete",
        onboardingStep: 6,
        seedVersion: null,
      });
      created = true;
    }
    const categories = await repos.money.categories.list({});
    for (const category of DEFAULT_CATEGORIES) {
      if (!categories.some((c) => c.name.toLowerCase() === category.name.toLowerCase())) {
        await repos.money.categories.create({ name: category.name, kind: category.kind, colorKey: null, isSystem: false });
        created = true;
      }
    }
    const progress = await repos.plans.progress.list({});
    for (const domain of PROGRESS_DOMAINS) {
      if (!progress.some((p) => p.domain === domain)) {
        await repos.plans.progress.create({
          domain,
          xp: 0,
          level: 1,
          streak: 0,
          bestStreak: 0,
          cumulativeMinutes: 0,
          lastActiveDate: null,
        });
        created = true;
      }
    }
    // To-dos live on an active OVERALL arc; a fresh space gets a minimal open-ended one.
    if (await ensureOverallArc(repos, localDateInZone(new Date().toISOString(), isValidTimeZone(timezone) ? timezone : "UTC"))) {
      created = true;
    }
    return created;
  });
}

/**
 * Route a confirm to the card's SIGNED owner. A request with an identity may only confirm its
 * own cards; a request without one acts as the signed owner (panel calls may lack a subject).
 * `requestCtx` is null when the request carried no identity (multi-user mode).
 */
export async function confirmEntryRouted(
  requestCtx: ToolContext | null,
  scopeFor: (ownerKey: string) => Promise<ToolContext | null>,
  input: { proposal: unknown; value?: number | null; cardToken?: string },
  base: Pick<ToolContext, "cardKey" | "requireCardToken" | "log">,
): Promise<ToolResult> {
  const parsed = proposalSchema.safeParse(input.proposal);
  const owner = parsed.success ? verifyCardToken(base.cardKey, parsed.data, input.cardToken) : null;
  const refuse = (message: string) => ({ ...noSubjectResult(), isError: true, content: [{ type: "text" as const, text: message }] });
  const refusal = (message: string): ToolResult => {
    const r = refuse(message);
    return { ...r, structuredContent: { ...r.structuredContent, message } };
  };
  if (owner === null) {
    if (requestCtx) return confirmEntry(requestCtx, input); // confirmEntry enforces the token itself
    if (base.requireCardToken) {
      base.log("confirm refused: missing/invalid card token");
      return refusal("This card can only be confirmed from the Sarthi panel.");
    }
    base.log("no subject on confirm_entry");
    return noSubjectResult();
  }
  if (requestCtx && ownerOf(requestCtx) !== owner) {
    base.log("confirm refused: card owner mismatch");
    return refusal("This card belongs to another Sarthi space.");
  }
  const target = requestCtx ?? (await scopeFor(owner));
  if (!target) {
    base.log("confirm refused: unknown card owner");
    return refusal("This card belongs to another Sarthi space.");
  }
  return withTodos(target, await confirmEntry(target, input), "confirm_entry");
}

/* ── setup_space ─────────────────────────────────────────────────────────── */

function cleanNames(names: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names ?? []) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Create the missing habits/skills/categories the user asked for. Idempotent; never deletes. */
export async function setupSpace(
  ctx: ToolContext,
  input: { habits?: string[]; skills?: string[]; categories?: string[] },
): Promise<ToolResult> {
  const day = await dayContext(ctx);
  const added = { habits: [] as string[], skills: [] as string[], categories: [] as string[] };
  await ctx.repos.transaction(async () => {
    const habits = await ctx.repos.habits.habits.list({});
    for (const name of cleanNames(input.habits)) {
      const existing = habits.find((h) => h.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (existing.isArchived) await ctx.repos.habits.habits.update(existing.id, { isArchived: false });
        continue;
      }
      await ctx.repos.habits.habits.create({
        name,
        cadence: "daily",
        difficulty: "easy",
        targetValue: null,
        targetUnit: null,
        isArchived: false,
      });
      added.habits.push(name);
    }
    const skills = await ctx.repos.skills.skills.list({});
    for (const name of cleanNames(input.skills)) {
      const existing = skills.find((sk) => sk.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (existing.isArchived) await ctx.repos.skills.skills.update(existing.id, { isArchived: false });
        continue;
      }
      await ctx.repos.skills.skills.create({ name, targetMinutes: null, isArchived: false });
      added.skills.push(name);
    }
    const categories = await ctx.repos.money.categories.list({});
    for (const name of cleanNames(input.categories)) {
      if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
      await ctx.repos.money.categories.create({ name, kind: "expense", colorKey: null, isSystem: false });
      added.categories.push(name);
    }
  });
  const space = await entityNames(ctx.repos);
  const addedAll = [...added.habits.map((n) => `habit "${n}"`), ...added.skills.map((n) => `skill "${n}"`), ...added.categories.map((n) => `category "${n}"`)];
  ctx.log(`setup_space added habits=${added.habits.length} skills=${added.skills.length} categories=${added.categories.length}`);
  const message = addedAll.length
    ? `Added to the user's Sarthi space: ${addedAll.join(", ")}. Their space now has habits: ${quote(space.habits)}; skills: ${quote(space.skills)}; categories: ${quote(space.categories)}.`
    : `Nothing new to add — it was already in the user's Sarthi space. Habits: ${quote(space.habits)}; skills: ${quote(space.skills)}; categories: ${quote(space.categories)}.`;
  return result({
    filed: [],
    pending: [],
    questions: [],
    today: await buildToday(ctx.repos, day.localDate),
    lastCommitId: null,
    message,
    space,
  });
}
