/**
 * SAR-016 timer-session eval — fake stack, deterministic, network-free.
 * Proves explicit Focus/Meditation commands use typed rows, never estimates, replay
 * exactly once, and preserve the one-batch undo boundary for first-use Meditation.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createToolsService } from "../../core/tools";
import { EVAL_NOW, EVAL_WITHIN, evalSetup } from "./harness";
import { countEstimatedWrites, countTypedRows, type EvalReport } from "./report";
import { timerSessionFixture } from "./timer-session.fixture";

const report: EvalReport = {
  runId: timerSessionFixture.id,
  generatedAt: EVAL_NOW,
  fixtures: [],
  metrics: { wrongSilentWrites: 0 },
};

function record(id: string, wrongSilentWrites: number, expectedRows: number, actualRows: number): void {
  report.fixtures.push({ id, pass: wrongSilentWrites === 0, expectedRows, actualRows, wrongSilentWrites });
  report.metrics.wrongSilentWrites += wrongSilentWrites;
}

let savedFetch: typeof globalThis.fetch;
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("timer-session eval must not hit the network");
  }) as typeof globalThis.fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

test("fixture · timer-session: Focus files one explicit timer session and replays safely", async () => {
  const { repos, service } = await evalSetup();
  const skill = (await repos.skills.skills.list({ isArchived: false })).find((row) => row.name === "System design");
  assert.ok(skill, "canonical fake seed includes a scoped System design skill");
  const tools = createToolsService({ repos, commits: service, now: () => EVAL_NOW });
  const input = { ...timerSessionFixture.focus, skillId: skill.id };

  const committed = await tools.completeFocus(input);
  const replay = await tools.completeFocus(input);

  assert.equal(committed.status, "committed");
  assert.equal(replay.status, "replayed");
  assert.equal(replay.commitId, committed.commitId, "retry returns the original typed commit");
  const sessions = await repos.skills.sessions.list({});
  assert.equal(sessions.length, 1, "one retry-safe typed Skills row");
  assert.deepEqual(
    {
      minutes: sessions[0].minutes,
      source: sessions[0].source,
      estimated: sessions[0].estimated,
      confidenceBps: sessions[0].confidenceBps,
    },
    { minutes: 25, source: "timer", estimated: false, confidenceBps: 10000 },
  );

  const wrongSilentWrites = await countEstimatedWrites(repos);
  record("focus-explicit-replay", wrongSilentWrites, 1, await countTypedRows(repos));
  assert.equal(wrongSilentWrites, 0, "timer files an explicit row, never an estimated silent write");
});

test("fixture · timer-session: declined Meditation writes nothing", async () => {
  const { repos, service } = await evalSetup();
  const tools = createToolsService({ repos, commits: service, now: () => EVAL_NOW });

  const declined = await tools.completeMeditation({ ...timerSessionFixture.declinedMeditation, consented: false });

  assert.deepEqual(declined, { status: "declined" });
  assert.equal(
    (await repos.habits.habits.list({})).filter((habit) => habit.name === "Meditate").length,
    0,
    "declining does not create Meditate alongside the canonical seed habit",
  );
  assert.equal((await repos.habits.logs.list({})).length, 0);
  assert.equal((await repos.commits.commits.list({})).length, 0);
  const wrongSilentWrites = await countEstimatedWrites(repos);
  record("meditation-declined", wrongSilentWrites, 0, await countTypedRows(repos));
  assert.equal(wrongSilentWrites, 0);
});

test("fixture · timer-session: consented first Meditation is atomic and undo removes its full batch", async () => {
  const { repos, service } = await evalSetup();
  const tools = createToolsService({ repos, commits: service, now: () => EVAL_NOW });

  const committed = await tools.completeMeditation({ ...timerSessionFixture.meditation, consented: true });
  assert.notEqual(committed.status, "declined");
  if (committed.status === "declined") throw new Error("unreachable");

  const habits = await repos.habits.habits.list({});
  const logs = await repos.habits.logs.list({});
  const meditate = habits.find((habit) => habit.name === "Meditate");
  assert.ok(meditate, "first use creates Meditate alongside the canonical seed habit");
  assert.equal(logs.length, 1, "first use writes one typed HabitLog");
  assert.deepEqual(
    { name: meditate.name, source: logs[0].source, note: logs[0].note, status: logs[0].status },
    { name: "Meditate", source: "tool", note: "Meditation · 10 min", status: "done" },
  );
  const commitRows = await repos.commits.rows.list({});
  assert.ok(commitRows.some((row) => row.entryKind === "habit"), "new habit is in the undo snapshot");
  assert.ok(commitRows.some((row) => row.entryKind === "habitLog"), "log is in the undo snapshot");

  const wrongSilentWrites = await countEstimatedWrites(repos);
  record("meditation-first-use-undo", wrongSilentWrites, 1, await countTypedRows(repos));
  assert.equal(wrongSilentWrites, 0);

  await service.undoLatest({ commitId: committed.commitId, now: EVAL_WITHIN });
  assert.equal((await repos.habits.logs.list({})).length, 0, "undo removes the tool log first");
  assert.equal(
    (await repos.habits.habits.list({})).filter((habit) => habit.name === "Meditate").length,
    0,
    "undo removes only the newly-created Meditate habit",
  );
  assert.equal((await repos.commits.commits.byId(committed.commitId))?.status, "undone");
});

test("TIMER-SESSION EVAL — fake stack preserves typed explicit safety", () => {
  assert.equal(report.fixtures.length, 3, "Focus, declined Meditation, and first-use Meditation fixtures ran");
  assert.ok(report.fixtures.every((fixture) => fixture.pass), JSON.stringify(report.fixtures));
  assert.equal(report.metrics.wrongSilentWrites, 0, "tool paths preserve the hard silent-write safety metric");
});
