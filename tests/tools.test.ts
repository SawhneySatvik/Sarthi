import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCommitService } from "../core/capture";
import { ToolCommandError, createToolsService, loadToolsView } from "../core/tools";
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
