import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCommitService, proposalSchema, resolveProposal } from "../core/capture";
import {
  ToolCommandError,
  assessAfford,
  buildAffordPrompt,
  createToolsService,
  deriveAffordVerdict,
  kilogramsToGrams,
  loadToolsView,
  readAffordEnvelope,
  rupeesToPaise,
} from "../core/tools";
import { createRepositoryFactory } from "../data/repository";
import { createMemoryDb } from "./helpers/memory-db";
import { createLlmGateway } from "../providers";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const OTHER = { userId: "other-user", email: null, mode: "local" as const };
const NOW = "2026-07-19T05:20:00.000Z";

async function setup() {
  const { db } = await createMemoryDb();
  const factory = createRepositoryFactory(db);
  const repos = factory.forUser(LOCAL);
  const commits = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });
  return { repos, factory, tools: createToolsService({ repos, commits, now: () => NOW }) };
}

test("Focus completes once as an explicit timer session and replays by idempotency key", async () => {
  const { repos, tools } = await setup();
  const skill = await tools.createSkill({ name: "System design" });
  const input = { skillId: skill.id, minutes: 25, idempotencyKey: "71679e87-7dd9-482f-bacb-c767fc9516c0" };

  const first = await tools.completeFocus(input);
  const replay = await tools.completeFocus(input);

  assert.equal(first.status, "committed");
  assert.equal(replay.status, "replayed");
  const sessions = await repos.skills.sessions.list({});
  assert.equal(sessions.length, 1);
  assert.deepEqual(
    { minutes: sessions[0].minutes, source: sessions[0].source, estimated: sessions[0].estimated, confidence: sessions[0].confidenceBps },
    { minutes: 25, source: "timer", estimated: false, confidence: 10000 },
  );
  assert.equal((await repos.commits.commits.list({})).length, 1);
});

test("separate HTTP-shaped tool services serialize one idempotency key into one commit", async () => {
  const { repos, factory } = await setup();
  const skill = await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const firstRepos = factory.forUser(LOCAL);
  const secondRepos = factory.forUser(LOCAL);
  const first = createToolsService({
    repos: firstRepos,
    commits: createCommitService({ repos: firstRepos, llm: createLlmGateway("fake"), now: () => NOW }),
    now: () => NOW,
  });
  const second = createToolsService({
    repos: secondRepos,
    commits: createCommitService({ repos: secondRepos, llm: createLlmGateway("fake"), now: () => NOW }),
    now: () => NOW,
  });
  const input = { skillId: skill.id, minutes: 25, idempotencyKey: "fbaa5154-9f2c-4a22-aed0-247516eb3173" };

  const results = await Promise.all([first.completeFocus(input), second.completeFocus(input)]);

  assert.deepEqual(results.map((result) => result.status).sort(), ["committed", "replayed"]);
  assert.equal((await repos.skills.sessions.list({})).length, 1);
  assert.equal((await repos.commits.commits.list({})).length, 1);
});

test("Focus marks the matching Today plan item with tool provenance and undo restores it", async () => {
  const { repos, tools } = await setup();
  const skill = await tools.createSkill({ name: "System design" });
  const arc = await repos.plans.arcs.create({
    domain: "skills",
    mode: "build",
    title: "Skills arc",
    startDate: "2026-07-19",
    endDate: null,
    dayNumber: 1,
    status: "active",
  });
  const item = await repos.plans.items.create({
    arcId: arc.id,
    domain: "skills",
    kind: "target",
    title: "Focus 25 min",
    dueAt: null,
    localDate: "2026-07-19",
    targetValue: 25,
    targetUnit: "minutes",
    status: "active",
    completionSource: null,
    ruleJson: null,
    linkedHabitId: null,
    linkedSkillId: skill.id,
  });
  const result = await tools.completeFocus({
    skillId: skill.id,
    minutes: 25,
    idempotencyKey: "cf5765ee-81e7-4fa8-8ed5-a3b504e954a9",
  });

  assert.deepEqual(
    { status: (await repos.plans.items.byId(item.id))?.status, source: (await repos.plans.items.byId(item.id))?.completionSource },
    { status: "done", source: "tool" },
  );
  const commits = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });
  await commits.undoLatest({ commitId: result.commitId, now: "2026-07-19T05:22:00.000Z" });
  assert.deepEqual(
    { status: (await repos.plans.items.byId(item.id))?.status, source: (await repos.plans.items.byId(item.id))?.completionSource },
    { status: "active", source: null },
  );
});

test("Focus rejects foreign skills and non-integer/zero minutes before a commit", async () => {
  const { repos, factory, tools } = await setup();
  const foreign = await factory.forUser(OTHER).skills.skills.create({ name: "Private skill", targetMinutes: null, isArchived: false });

  await assert.rejects(
    () => tools.completeFocus({ skillId: foreign.id, minutes: 25, idempotencyKey: "dba7d7d4-5634-4624-8a2a-bf8e6f8d0ea0" }),
    ToolCommandError,
  );
  await assert.rejects(
    () => tools.completeFocus({ skillId: foreign.id, minutes: 25.5, idempotencyKey: "dba7d7d4-5634-4624-8a2a-bf8e6f8d0ea0" }),
  );
  await assert.rejects(
    () => tools.completeFocus({ skillId: foreign.id, minutes: 0, idempotencyKey: "dba7d7d4-5634-4624-8a2a-bf8e6f8d0ea0" }),
  );
  assert.equal((await repos.commits.commits.list({})).length, 0);
  assert.equal((await repos.skills.sessions.list({})).length, 0);
});

test("declining Meditation creates no row, commit, or XP", async () => {
  const { repos, tools } = await setup();
  const result = await tools.completeMeditation({
    minutes: 5,
    patternId: "calm",
    consented: false,
    idempotencyKey: "b9fc45ea-a241-4c43-a6a3-2dd48105b9fd",
  });

  assert.deepEqual(result, { status: "declined" });
  assert.equal((await repos.habits.habits.list({})).length, 0);
  assert.equal((await repos.habits.logs.list({})).length, 0);
  assert.equal((await repos.commits.commits.list({})).length, 0);
  assert.equal((await repos.plans.progress.list({})).length, 0);
});

test("first consented Meditation creates habit + tool log in one undoable batch", async () => {
  const { repos, tools } = await setup();
  const committed = await tools.completeMeditation({
    minutes: 10,
    patternId: "ten",
    consented: true,
    idempotencyKey: "277831aa-88e3-41e1-b21d-8d10f5269d28",
  });
  assert.notEqual(committed.status, "declined");
  if (committed.status === "declined") throw new Error("unreachable");

  const habits = await repos.habits.habits.list({});
  const logs = await repos.habits.logs.list({});
  assert.equal(habits.length, 1);
  assert.equal(habits[0].name, "Meditate");
  assert.equal(logs.length, 1);
  assert.deepEqual(
    { habitId: logs[0].habitId, source: logs[0].source, status: logs[0].status, note: logs[0].note },
    { habitId: habits[0].id, source: "tool", status: "done", note: "Meditation · 10 min" },
  );
  const rows = await repos.commits.rows.list({});
  assert.ok(rows.some((row) => row.entryKind === "habit"));
  assert.ok(rows.some((row) => row.entryKind === "habitLog"));

  const commits = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });
  await commits.undoLatest({ commitId: committed.commitId, now: "2026-07-19T05:22:00.000Z" });
  assert.equal((await repos.habits.logs.list({})).length, 0);
  assert.equal((await repos.habits.habits.list({})).length, 0);
});

test("existing Meditate habit is retained when its tool log is undone", async () => {
  const { repos, tools } = await setup();
  const habit = await repos.habits.habits.create({
    name: "Meditate",
    cadence: "daily",
    difficulty: "easy",
    targetValue: null,
    targetUnit: "minutes",
    isArchived: false,
  });
  const result = await tools.completeMeditation({
    minutes: 5,
    patternId: "box",
    consented: true,
    idempotencyKey: "2eb0b8d8-21a6-4dcd-a1e5-3c369d03f0b4",
  });
  assert.notEqual(result.status, "declined");
  if (result.status === "declined") throw new Error("unreachable");

  const commits = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });
  await commits.undoLatest({ commitId: result.commitId, now: "2026-07-19T05:22:00.000Z" });
  assert.equal((await repos.habits.logs.list({})).length, 0);
  assert.equal((await repos.habits.habits.byId(habit.id))?.id, habit.id);
});

test("Tools view chooses the most recently used active skill and keeps scope-bound rows", async () => {
  const { repos, tools } = await setup();
  const older = await tools.createSkill({ name: "Algorithms" });
  const recent = await tools.createSkill({ name: "System design" });
  await tools.completeFocus({ skillId: older.id, minutes: 25, idempotencyKey: "a2b6b221-88c7-47ab-a2ef-3c0cc8601a64" });
  // A later test-clock command cannot coexist as latest undo, but the read model still uses occurrence order.
  await repos.skills.sessions.create({
    skillId: recent.id,
    minutes: 50,
    source: "timer",
    note: null,
    confidenceBps: 10000,
    estimated: false,
    occurredAt: "2026-07-19T06:20:00.000Z",
    localDate: "2026-07-19",
    timezone: "UTC",
  });
  const view = await loadToolsView(repos, "2026-07-19");
  assert.equal(view.focus.defaultSkillId, recent.id);
  assert.deepEqual(view.focus.skills.map((skill) => skill.name), ["Algorithms", "System design"]);
});

test("Workout Counter files one explicit typed Health workout with null burn, replays, and undoes", async () => {
  const { repos, tools } = await setup();
  const input = {
    durationMinutes: 45,
    burnKcal: null,
    exercises: [
      { name: "Squat", sets: 5, reps: 5, loadGrams: 60000 },
      { name: "Plank", sets: 3, reps: 1, loadGrams: null },
    ],
    idempotencyKey: "5f0c2a10-0000-4000-8000-000000000001",
  };

  const first = await tools.completeWorkout(input);
  const replay = await tools.completeWorkout(input);
  assert.equal(first.status, "committed");
  assert.equal(replay.status, "replayed");

  const workouts = await repos.health.workouts.list({});
  assert.equal(workouts.length, 1);
  assert.deepEqual(
    { duration: workouts[0].durationMinutes, burn: workouts[0].burnKcal, source: workouts[0].source, estimated: workouts[0].estimated },
    { duration: 45, burn: null, source: "tool", estimated: false },
  );

  const exercises = (await repos.health.workoutExercises.list({}))
    .map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, loadGrams: e.loadGrams }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  assert.deepEqual(exercises, [
    { name: "Plank", sets: 3, reps: 1, loadGrams: null },
    { name: "Squat", sets: 5, reps: 5, loadGrams: 60000 },
  ]);

  const commits = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });
  await commits.undoLatest({ commitId: first.commitId, now: "2026-07-19T05:22:00.000Z" });
  assert.equal((await repos.health.workouts.list({})).length, 0);
  assert.equal((await repos.health.workoutExercises.list({})).length, 0);
});

test("Workout Counter rejects a zero/non-integer duration before any write", async () => {
  const { repos, tools } = await setup();
  await assert.rejects(
    () => tools.completeWorkout({ durationMinutes: 0, burnKcal: null, exercises: [], idempotencyKey: "5f0c2a10-0000-4000-8000-000000000002" }),
  );
  await assert.rejects(
    () => tools.completeWorkout({ durationMinutes: 45.5, burnKcal: null, exercises: [], idempotencyKey: "5f0c2a10-0000-4000-8000-000000000002" }),
  );
  assert.equal((await repos.health.workouts.list({})).length, 0);
  assert.equal((await repos.commits.commits.list({})).length, 0);
});

test("rupeesToPaise parses rupee strings to integer paise without float drift", () => {
  assert.equal(rupeesToPaise("340"), 34000);
  assert.equal(rupeesToPaise("1.50"), 150);
  assert.equal(rupeesToPaise("1,000"), 100000);
  assert.equal(rupeesToPaise("₹99"), 9900);
  assert.equal(rupeesToPaise("0.10"), 10); // parseFloat*100 would give 10.0000000002
  assert.equal(rupeesToPaise("19.99"), 1999); // parseFloat*100 would give 1998.9999…
  assert.equal(rupeesToPaise(""), null);
  assert.equal(rupeesToPaise("0"), null); // non-positive never becomes a write
  assert.equal(rupeesToPaise("-5"), null);
  assert.equal(rupeesToPaise("abc"), null);
  assert.equal(rupeesToPaise("1.234"), null); // more than two decimals
});

test("kilogramsToGrams parses kg to integer grams; blank/unparseable → null (never an invented load)", () => {
  assert.equal(kilogramsToGrams("20"), 20000);
  assert.equal(kilogramsToGrams("12.5"), 12500);
  assert.equal(kilogramsToGrams("0.25"), 250);
  assert.equal(kilogramsToGrams(""), null);
  assert.equal(kilogramsToGrams("abc"), null);
  assert.equal(kilogramsToGrams("2.5555"), null);
});

test("afford envelope round-trips through the prompt and derives a ledger-grounded verdict keyless", () => {
  const context = { item: "Shoes", pricePaise: 300000, safeToSpendPaise: 5000000, balancePaise: 5000000, remainingBudgetedPaise: 0, upcomingRecurringPaise: 0, dataDays: 12 };
  const { prompt } = buildAffordPrompt(context);
  assert.deepEqual(readAffordEnvelope(prompt), context);
  assert.equal(deriveAffordVerdict(context).rating, "comfortable");
  assert.equal(deriveAffordVerdict({ ...context, upcomingRecurringPaise: 200000 }).rating, "tight");
  assert.equal(deriveAffordVerdict({ ...context, pricePaise: 6000000 }).rating, "not_now");
  assert.equal(readAffordEnvelope("not json"), null);
});

test("afford-it verdict runs keyless on the fake deep tier and varies with the real ledger", async () => {
  const { repos } = await setup();
  const llm = createLlmGateway("fake");
  // An income category exists too — it must never be offered as an expense's log target.
  await repos.money.categories.create({ name: "Salary", kind: "income", colorKey: null, isSystem: false });
  await repos.money.categories.create({ name: "Shopping", kind: "expense", colorKey: null, isSystem: false });
  await repos.money.transactions.create({
    occurredAt: NOW, localDate: "2026-07-19", timezone: "UTC",
    direction: "credit", amountPaise: 5000000, categoryId: null, merchant: "Salary", note: null,
    source: "capture", confidenceBps: 10000, estimated: false, evidenceId: null, recurringRuleId: null,
  });

  const comfortable = await assessAfford({ repos, llm, localDate: "2026-07-19", input: { item: "Shoes", pricePaise: 300000 } });
  assert.equal(comfortable.verdict.rating, "comfortable");
  assert.equal(comfortable.context.safeToSpendPaise, 5000000);
  assert.equal(comfortable.context.dataDays, 1);
  assert.equal(comfortable.modelProvider, "fake");
  assert.ok(comfortable.categories.some((category) => category.name === "Shopping"));
  // "Bought it → log" defaults to categories[0] — it must be an expense, never income.
  assert.ok(comfortable.categories.every((category) => category.name !== "Salary"));

  const tight = await assessAfford({ repos, llm, localDate: "2026-07-19", input: { item: "Phone", pricePaise: 3000000 } });
  assert.equal(tight.verdict.rating, "tight");

  const notNow = await assessAfford({ repos, llm, localDate: "2026-07-19", input: { item: "Watch", pricePaise: 9000000 } });
  assert.equal(notNow.verdict.rating, "not_now");

  // The verdict is advice only — assessing an afford check writes nothing.
  assert.equal((await repos.money.transactions.list({})).length, 1);
  assert.equal((await repos.commits.commits.list({})).length, 0);
});

test("afford 'Bought it → log' commits one explicit expense transaction via the standard capture path, undoable", async () => {
  const { repos } = await setup();
  const category = await repos.money.categories.create({ name: "Shopping", kind: "expense", colorKey: null, isSystem: false });
  const commits = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });

  // Mirror the client: a draft transaction proposal (explicit price → integer paise) resolved
  // and committed through the SAME seam capture uses (kind:"capture", mode accept).
  const draft = proposalSchema.parse({
    proposalId: "afford-1", domain: "money", intent: "create",
    occurredAt: NOW, localDate: "2026-07-19", timezone: "UTC",
    estimated: false, confidenceBps: 10000, why: { basis: "afford-it check purchase", assumptions: [] }, evidenceRefs: [],
    kind: "transaction", payload: { direction: "expense", amountPaise: 300000, categoryName: "Shopping", merchant: "Shoes", note: null },
  });
  const outcome = await resolveProposal(draft, repos, "accepted");
  assert.ok(outcome.ok);
  if (!outcome.ok) throw new Error("unreachable");

  const result = await commits.commit({ idempotencyKey: "afford-commit-1", kind: "capture", proposals: [outcome.resolved] });
  const txns = await repos.money.transactions.list({});
  assert.equal(txns.length, 1);
  assert.deepEqual(
    { amount: txns[0].amountPaise, direction: txns[0].direction, estimated: txns[0].estimated, categoryId: txns[0].categoryId, merchant: txns[0].merchant },
    { amount: 300000, direction: "debit", estimated: false, categoryId: category.id, merchant: "Shoes" },
  );

  await commits.undoLatest({ commitId: result.commitId, now: "2026-07-19T05:22:00.000Z" });
  assert.equal((await repos.money.transactions.list({})).length, 0);
});

test("Tools clock exposes a cached external-store snapshot instead of reading the clock during render", () => {
  const source = readFileSync("components/tools/ToolsProvider.tsx", "utf8");
  const snapshot = source.match(/function getClockSnapshot\(\): number \{([^}]*)\}/);
  const hook = source.match(/export function useClockNow\(\): number \{([^}]*)\}/);

  assert.ok(snapshot, "the clock store needs a client snapshot getter");
  assert.match(snapshot[1], /^\s*return clockSnapshot;\s*$/);
  assert.doesNotMatch(snapshot[1], /Date\.now\(/);
  assert.ok(hook, "the Tools clock needs to be consumed through useSyncExternalStore");
  assert.match(hook[1], /useSyncExternalStore\(subscribeClock, getClockSnapshot, getServerClockSnapshot\)/);

  assert.match(source, /let clockSnapshot = 0;/);
  assert.match(source, /clockSnapshot = Date\.now\(\);\s*clockTimer = window\.setInterval/);
  assert.match(source, /clockSnapshot = Date\.now\(\);\s*for \(const notify of clockListeners\) notify\(\);/);
});
