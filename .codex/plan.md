# SAR-007 — F3 Fake-Stack Integration Evaluation (THE GATE)

| | |
|---|---|
| **Status** | **LANDED 2026-07-18 — F3 GATE MET (automated).** The eval drives all four gate-3 fixtures keyless; `wrongSilentWrites === 0` holds as a hard aggregate. `pnpm check` 106 tests, build, invariants green; D-040 corrected. Sol diff-review dispatched. **Manual remainder: visual F3-state screenshots.** Stacks on `sar-003-schema-repository`. |
| **Owner** | `test-eval` (Terra) · medium effort · **tests + eval code ONLY — no production module edits.** |
| **Depends on** | `SAR-002`–`SAR-006` — all landed. Drives their code; changes none of it. |
| **Authority** | `docs/architecture/ARCHITECTURE.md` §8 (eval harness) + §9 gate 3 · `docs/experience/FLOWS.md` F3 · `docs/product/DECISIONS.md` D-030, D-040 · `docs/planning/TICKETS.md` SAR-007 · `AGENTS.md` §3 |
| **Out of scope (do NOT build)** | The **full §8.2 `EvalReport`** (all 12 fixtures, parse/routing accuracy, adaptation-sanity, state-match, cost/latency **A/B across Gemini vs GPT-5.6**) — that is **SAR-020** (depends on SAR-007+018+019). Any live-provider run. Any production-code change (fixtures + harness + a doc note only). The capture UI (SAR-006). Real vision/photo pipeline (SAR-011) — the photo fixture is fabricated test data, not a vision run. |

---

## Context

SAR-007 is the **F3 GATE**: a deterministic, keyless integration eval that proves the F3 loop over the four Architecture **gate-3 fixtures** and makes **`wrongSilentWrites === 0` a hard aggregate** across every scenario (D-030 · §8.2 — the one remaining piece N-6 of `handsoff_04` says is still owed). It must pass **before fan-out (SAR-008/9/10) or non-provisioning Phase-1 work** (TICKETS SAR-007 "Moves"). It builds only tests + an eval harness that drives the LANDED `core/capture` pipeline (SAR-004) + repositories (SAR-003) on the `fake` stack — it edits no production module.

Invariants proven (not touched): **#1** — nothing estimated writes without an explicit accept; the harness's whole reason for being is `wrongSilentWrites === 0`. **#3** — keyless: provider keys unset + `globalThis.fetch` sentineled + `FakeLlmGateway` + `memory-db` (the exact posture of `tests/commit.test.ts`). **#6** — typed writes only, asserted by counting typed-table rows.

**Deliverable of this planning step:** this plan only. No code before sign-off.

## Current state (verified via the SAR-004/006 code + ARCHITECTURE §8/§9)

- **§8.2 `EvalReport`** (ARCHITECTURE §8.2) is the *full* shape (runId/stack/fixtures[]/metrics{parseAccuracy,routingAccuracy,wrongSilentWrites,estimateMae,stateMatchRate,adaptationSanityRate,latency,cost}). **SAR-007 builds a strict SUBSET** — the gate-relevant fields only; the A/B + adaptation + cost fields are **SAR-020**'s (TICKETS SAR-020, Size L). Building the full harness now is over-scope for an M ticket.
- **Gate 3 (ARCHITECTURE §9)** requires exactly four fixtures keyless: **`canonical-cross-domain`, `estimated-meal-photo`, `ambiguous-skill`, `undo-batch`**. No others.
- **Fixtures:** `tests/fixtures/capture/index.ts` already has 7 `CaptureFixture`s incl. `canonical-cross-domain`, `ambiguous-skill`, `undo-batch`. **`estimated-meal-photo` does NOT exist as a `CaptureFixture`** — but its raw numbers do (`providers/fake/fixtures.ts` `ESTIMATED_MEAL_PHOTO_FIXTURE`: kcal 520 / protein 18 / carbs 82 / fat 14, `source:"photo"`, `estimated:true`, `confidenceBps:7400`), and `captureSourceEnum` already includes `"photo"`. It's synthesizable as a hand-built `CaptureDraft` (the `mkDraft` pattern) with **no vision wiring** (D-B, OQ).
- **Driver API (all landed):** `parseDump(input, createLlmGateway("fake"))`, `prepareDraft(draft, repos)→{autoCommit,pending}`, `resolveProposal(p, repos, status)`, `createCommitService({repos,llm}).commit/undoLatest`, `routeDraft`, `seedCanonicalEntities(repos)` (SAR-006 — "SAR-007 reuses it"), `createMemoryDb()`. `tests/commit.test.ts`/`undo.test.ts` are the exact template (fetch sentinel + unset keys → memoryDb → seed → prepareDraft → commit → assert rows → undoLatest).
- **⚠ D-040 provenance correction (finding):** D-040 states auto rows "persist `status:'auto'`" and accepted rows "`status:'accepted'`" — **there is no such column.** Typed tables carry `source`/`confidenceBps`/`estimated`/`evidenceId`; `commit.ts` writes `source:"capture"` for BOTH paths. The resolved `status` is an in-memory `ResolvedProposal` field, never persisted to a domain row. The only durable auto-vs-accepted signal is **`commits.kind`** (`"capture"` = auto-batch vs `"tap"/"edit"` = accepted) joinable via `commit_rows`. The trust guarantee is unaffected (it rests on the server re-route refusing estimated-as-auto, D-040), but SAR-007's counter reads **`estimated` + the `expected.auto` allowlist (+ optional `commits.kind`)**, and **SAR-007 corrects D-040's wording** (a doc edit — allowed; not production code).
- **Fixture parse-path split:** the fake gateway is content-blind (returns the canonical draft for any input), so only **`canonical-cross-domain`** is driven through the real `parseDump` hop (proving F3 step 2 literally); the other three are hand-built `CaptureDraft`s fed straight into `prepareDraft`/`commit` (parse can't produce them keylessly).

### File map (all under tests/ — no production edit)

| File | Change |
|---|---|
| `tests/fixtures/capture/index.ts` | **edit** — add `estimatedMealPhotoFixture` (D-B) + export in `allCaptureFixtures` |
| `tests/eval/report.ts` | **new** — the minimal `EvalReport` subset type + the pure `wrongSilentWrites` aggregator |
| `tests/eval/f3-gate.eval.test.ts` | **new** — the harness: loops the 4 gate-3 fixtures keyless, drives the F3 loop, accumulates the report, hard-asserts `wrongSilentWrites === 0` + per-fixture expectations |
| `tests/eval/harness.ts` | **new** — shared driver (seed + prepareDraft + commit/undo + row-count helpers) reused by the eval |
| `package.json` | **edit** — add `test:eval` chained into `test` |
| `docs/product/{DECISIONS,CHANGELOG}.md` | **edit** — correct D-040's provenance clause + a truthful entry after evidence |

No `core/`, `data/`, `providers/`, schema, or migration change.

---

## Locked decisions for this ticket (sign these off)

**D-A · Scope = the 4 gate-3 fixtures + a MINIMAL report; the full harness is SAR-020.** SAR-007 proves `canonical-cross-domain`, `estimated-meal-photo`, `ambiguous-skill`, `undo-batch` keyless and produces a `tests/eval/report.ts` `EvalReport` that is a strict subset of ARCHITECTURE §8.2 — `{runId, generatedAt, fixtures: [{id, pass, expectedRows, actualRows, wrongSilentWrites}], metrics: {wrongSilentWrites}}` (the A/B / adaptation / cost / latency fields are omitted or `null`, owned by SAR-020). The report is asserted in-test (and optionally written to `.verify/eval/` as an artifact); no live provider, no A/B.

**D-B · `estimated-meal-photo` = a synthesized keyless fixture [OQ-1].** Add `estimatedMealPhotoFixture` to `tests/fixtures/capture/` as a hand-built `CaptureDraft` (`mkDraft`) with `source:"photo"`, one `meal` proposal (`estimated:true`, `confidenceBps:7400`, kcal 520 / protein 18 / carbs 82 / fat 14 from `providers/fake/fixtures.ts`), `expected:{auto:[], pending:[<id>]}`. **No vision-adapter wiring** — it is fabricated test data, exactly like the other six non-canonical fixtures. This satisfies gate 3's literal fixture-id requirement keyless. *(OQ-1 alt: defer to SAR-011 and mark gate 3 partially met — risks the gate never closing before fan-out.)*

**D-C · `wrongSilentWrites` = a HARD aggregate over every scenario (the gate metric).** Operational definition using only columns that exist: for each fixture, after driving its expected auto-phase (`prepareDraft` → `commit(autoCommit)`), count as a violation (a) **any** typed-domain-table row with `estimated === true` (routing guarantees estimated never enters `autoCommit`, so any such row after the auto-phase is a silent estimate write by construction), and (b) any auto-written row whose originating `proposalId` is outside the fixture's `expected.auto` allowlist (unexpected auto-write). Optional cross-check: any row reachable from a `commit_rows` entry whose owning `commits.kind === 'capture'` yet is `estimated`. **Sum across all four fixtures into `report.metrics.wrongSilentWrites` and hard-assert `=== 0` at the harness level** (not per-`test()`), which is the exact difference from SAR-004's per-scenario emptiness asserts (closes N-6). This reads `estimated` + the allowlist, NOT a row `status` column (which does not exist — see D-040 correction).

**D-D · Harness = `tests/eval/*` + `pnpm test:eval`, keyless, deterministic.** The eval lives in `tests/eval/` (`*.eval.test.ts` — a `*.test.ts` file under an `eval/` dir, honoring both `test-eval.toml`'s "/eval" instruction and the repo's `tests/*.test.ts` + named-script convention). `tests/eval/harness.ts` holds the shared driver (fetch sentinel + unset keys, `createMemoryDb`, `seedCanonicalEntities`, prepareDraft/commit/undo, typed-row counters). `pnpm test:eval` runs it and is chained into `pnpm test` → `pnpm check`. Deterministic + network-free (the `now` clock is injected as in SAR-004).

**D-E · The four gate-3 assertions (F3 DoD, FLOWS F3 steps 2–6).**
- **canonical-cross-domain** — `parseDump(canonical, fakeGateway)` → draft (step 2); with `seedCanonicalEntities`, `prepareDraft` → `autoCommit={transaction,skillSession}` + `pending={meal,water,habitLog}` (step 3); `commit(autoCommit)` → exactly 2 typed rows + envelope + XP; **the 3 pending wrote nothing** (invariant #1); accepting the meal card → meal + mealItems written (step 4); `wrongSilentWrites===0`.
- **estimated-meal-photo** — the estimated meal is pending; **no `meals` row exists until an explicit accept** commit; on accept it writes with `estimated:true` (confirmed ≠ unconfirmed).
- **ambiguous-skill** — the skill name doesn't resolve → `prepareDraft` demotes to pending with a question; **no `skills`/`skill_sessions` row invented**; nothing auto-writes.
- **undo-batch** — `commit` → typed rows + XP + plan effects; `undoLatest` → all reversed atomically (row counts back to 0, progress restored); refuses a second undo.

**D-F · Screenshots = deferred/manual DoD.** The harness proves the F3 *state data* (row counts, XP, undo, wrongSilentWrites). The TICKETS "mobile/desktop F3 state screenshots to `.verify/screens/`" require a browser, and none is wired in the repo (no playwright/puppeteer) — so, like SAR-005/006, the **visual** F3-state screenshots are a manual pass (Satvik / a browser-tooled session) and an open DoD before the gate is *visually* signed; the **automated** gate (the eval) is what SAR-007 delivers.

---

## Implementation steps (ordered — become the todo list)

1. **`estimated-meal-photo` fixture (D-B).** Add `estimatedMealPhotoFixture` + include in `allCaptureFixtures`; a contract test that it parses under `captureDraftSchema` and routes to pending.
2. **Harness + report (D-C/D-D).** `tests/eval/report.ts` (minimal `EvalReport` + the `wrongSilentWrites` aggregator over typed tables) + `tests/eval/harness.ts` (keyless driver: seed, prepareDraft, commit/undo, per-table row counters).
3. **The four gate-3 scenarios (D-E).** `tests/eval/f3-gate.eval.test.ts`: drive each fixture, assert per-fixture expectations, accumulate the report, hard-assert `report.metrics.wrongSilentWrites === 0`.
4. **Wire + run (D-D).** Add `test:eval` to `package.json`, chain into `test`; confirm keyless (`pnpm test:eval` green with keys unset + fetch sentinel).
5. **Validate + record.** `pnpm check` (incl. `test:eval`) + build + invariants; **correct D-040's provenance clause** in DECISIONS + a truthful CHANGELOG entry after evidence; declare the **F3 GATE met** (automated) with the visual screenshot pass flagged as the manual remainder. Sol diff review.

## Acceptance checklist (mirrors TICKETS SAR-007 + gate 3)

- [x] Deterministic keyless tests for the four gate-3 fixtures: canonical explicit rows auto-file; estimates/question-dependent proposals **write nothing until accepted**; accepted Health (meal) card writes correctly; undo reverses rows/XP/plan effects atomically.
- [x] **`wrongSilentWrites === 0` is a HARD aggregate** over every fixture (harness-level assert), reading `estimated` + the `expected.auto` allowlist — not a non-existent row `status`.
- [x] `estimated-meal-photo` covered keyless (per OQ-1); a minimal `EvalReport` (subset of §8.2) is produced.
- [x] Tests + eval code ONLY — `core/`, `data/`, `providers/`, schema, migrations untouched (the only non-test edit is the D-040 wording correction + the CHANGELOG).
- [x] `pnpm typecheck`/`lint`/`check:core-boundary`/`test` (incl. `test:eval`)/`build` + `.codex/hooks/check-invariants.sh` pass, all keyless. Visual F3-state screenshots flagged as the manual DoD remainder.

## Verification

```sh
pnpm install --frozen-lockfile      # no new deps
pnpm check                          # typecheck + lint + core-boundary + all suites incl. test:eval
pnpm test:eval                      # the F3 gate in isolation — keyless, deterministic
pnpm build ; bash .codex/hooks/check-invariants.sh
```

Keyless proof: provider keys unset + `globalThis.fetch` sentineled + `FakeLlmGateway` + `memory-db`. **This is the F3 GATE** — on green, fan-out (SAR-008/9/10) may begin; on red, downstream stops until F3 is fixed (no cut line fires on elapsed time, D-035).

## Open questions — RESOLVED at sign-off (2026-07-18)

- **OQ-1 (D-B) · `estimated-meal-photo` → (a) synthesize** a keyless `CaptureFixture` now (no vision wiring). All four gate-3 fixtures close keyless.

## Handoff to Terra (`test-eval`)

Build ONLY the fixture + harness + eval tests + the D-040 wording fix + the CHANGELOG. Touch NO production module (`core/`, `data/`, `providers/`, schema, migrations). Reuse `seedCanonicalEntities` and the `tests/commit.test.ts` keyless setup pattern — do not hand-roll a divergent seed. The `wrongSilentWrites` counter reads persisted `estimated` + the fixture allowlist; if you reach for a row `status` column, stop — it does not exist (that is the D-040 correction). The full 12-fixture / A/B `EvalReport` is SAR-020 — build the gate-3 subset only. If the same acceptance item fails twice, stop and escalate.

---

### Post-approval sequence (after sign-off)
1. Fold the OQ-1 answer into D-B.
2. Create the TodoWrite/task list from the 5 ordered steps.
3. Build steps 1–5 in the main session; then a read-only Sol diff review; on green, declare the F3 GATE met (automated) and record the visual-screenshot remainder.
4. `/handoff` at session end.

**LANDED 2026-07-18 — F3 GATE MET (automated). 106 tests/build/invariants green; wrongSilentWrites===0 hard aggregate; D-040 corrected + CHANGELOG. Manual remainder: visual F3-state screenshots. Next: fan-out (SAR-008 Money).**
