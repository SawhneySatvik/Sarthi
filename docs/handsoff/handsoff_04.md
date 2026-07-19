# Sarthi Handoff 04 — Capture Moat (Routing · Typed Commit · XP · Undo) Accepted

| | |
|---|---|
| **Written** | 2026-07-17 |
| **Session state** | Stage 5 active; `SAR-001`, `SAR-002`, `SAR-003`, and **`SAR-004`** are accepted. `SAR-005` is not planned or started. |
| **Resume point** | Plan **`SAR-005 — Token shell and thin Today spine`** only, then stop for Satvik's ticket-plan sign-off. (Confirm the SAR-004 branch/commit intent first — see Git baseline.) |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, and `docs/planning/TICKETS.md` are signed; D-001–D-038 are constraints. `.codex/plan.md` holds the accepted SAR-004 record. |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `948141b` foundation/provider handoff is the last commit on `main`. Branch **`sar-003-schema-repository`** carries the committed SAR-003 tree (6 commits, tip `1102b64`). The **SAR-004 working tree is uncommitted on that branch** (`core/capture/*`, `core/game/*`, `data/repository/commits.ts`, the capture test suites, plus additive edits to `core/contracts/repositories.ts`, `data/repository/{base,factory}.ts`, `package.json`, `docs/product/DECISIONS.md`, `.codex/plan.md`). Branch/commit/merge is Satvik's call — do not overwrite it. |

## 1. Locked execution state

- **Product and safety:** `AGENTS.md` invariants apply without exception. Estimates never write unconfirmed; money/quantity values stay integer; typed domain writes only; `core/` remains framework/provider/DB-import clean; the free demo is never paywalled.
- **Workflow:** Sol plans and reviews; Terra writes application code; Luna stays read-only. Every ticket requires its own approved `.codex/plan.md`, then Terra implementation, then a final review gate. Do not start a later ticket opportunistically.
- **Work order:** `SAR-001` → `SAR-002` → `SAR-003` → `SAR-004` are accepted. **`SAR-005` (token shell + thin Today spine) is next** (depends on `SAR-001`+`SAR-003`), then `SAR-006` (Health slice + capture sheet) and `SAR-007` (F3 fake-stack eval). Front-loading the pipeline is done; the remaining F3 spine is UI + eval.
- **External deadline:** Tue Jul 21, 5:00 PM PT. D-035 forbids elapsed-day checkpoints; only dependency and acceptance evidence advance work.
- **New this session:** **D-038** locks the capture-moat shapes (draft-permissive / resolved-strict contract split; commit-envelope state machine as the only audit mutation; single-flight commit). Open decision unchanged: **D-006** (demo runtime provider) only.

## 2. Accepted ticket evidence

### SAR-004 — Capture routing, typed commit, XP, and undo core (the moat)

**Accepted outcome**

- `core/capture/contract.ts` — the versioned capture contract, two layers in one file. **Draft-permissive** (`captureDraftSchema`/`proposalSchema`, a discriminated union over the 7 kinds) permits `null` only for `water.millilitres` (so the canonical "drank a bottle" fixture validates, gate 9.2); **resolved-strict** (`resolvedProposalSchema`) forces non-null primary quantities + resolved name→entity ids + `status ∈ {auto, accepted}`, so a null/unresolved value can never reach a repository. Imports zod only.
- `core/capture/route.ts` — the routing policy and the **sole owner** of `AUTO_WRITE_CONFIDENCE_BPS = 9000` (+ `ACCEPT_ALL_MIN_CONFIDENCE_BPS = 8000`). `routeProposal`/`routeDraft` auto-file only `intent==='create'` ∧ `estimated===false` ∧ `≥9000` bps ∧ integer-valid ∧ unblocked; every estimate, correction, backdate, low-confidence, or question-blocked proposal is pending. `applyUserEdit` (rule 5), `isAcceptAllEligible` (rule 6).
- `core/capture/resolve.ts` — case-insensitive name→id resolution against the user's active habits/skills/categories; an unresolved habit/skill/**category** demotes auto→pending with a question (never invents a row). `prepareDraft` partitions a draft into `{autoCommit, pending}`.
- `core/capture/parse.ts` — `parseDump` deep-tier `generateObject` + defensive `safeParse`; a gateway throw or invalid object returns `{ok:false, retryable:true}` with zero rows.
- `core/capture/commit.ts` — `createCommitService({repos, llm, now?})`, framework-clean (deps injected). `commit()` runs the resolved-strict schema at entry (rejects garbage before any write), is idempotent (replays reconstruct from the audit rows), single-flight per scope (promise-chain mutex — N-4 closed), and does one `repos.transaction`: supersede-previous → envelope → **exhaustive typed per-domain dispatch** (7 create branches + correction-updates; no generic payload/table path) → `commit_rows` snapshots → deterministic integer XP/streak (`domain_progress` ensure-then-update singleton + `commit_progress_effects`) → plan effects → satisfied-by writer. The capture coach note is written after the transaction and never rolls it back. `undoLatest()` compensates the latest committed non-expired batch atomically from the row snapshots and marks it `undone` via the narrow `markUndone` (NB-4 closed).
- `core/game/{xp,streak,progress}.ts` — pure, deterministic, integer-only XP/level/streak/progress kernels (a Terra-authored, Sol-reviewed tunable XP table). Backdate batches recompute the streak grace-aware via `computeStreak` over the domain's logs; `lastActiveDate` never regresses.
- `data/repository/commits.ts` (+ additive `core/contracts/repositories.ts`, `data/repository/{base,factory}.ts`) — the two guarded audit-state transitions (`markUndone`/`markSuperseded`), each moving only from `committed` and mutating only status/undoneAt, else `RepositoryError`. No `update` on the append-only port.

**Evidence**

- `pnpm check` (typecheck + lint + core-boundary + all suites) green — **85 tests**: 13 core-boundary, 5 providers, 30 data (incl. commit-state), 3 migrations, 34 capture (contract · game · route · parse · commit · undo). `pnpm build` green. `.codex/hooks/check-invariants.sh` clean. `pnpm install --frozen-lockfile` consistent, lockfile untouched (no new deps).
- Keyless + network-free: every capture suite runs with provider keys unset and `globalThis.fetch` sentineled to throw; `FakeLlmGateway` + `memory-db` only. No schema/migration change.
- `wrongSilentWrites === 0` asserted across the capture suites; the exhaustive dispatch has no generic path (grep + invariant hook clean); `AUTO_WRITE_CONFIDENCE_BPS` has exactly one owner.
- **Two-pass Sol gate review.** Pass 1: one **blocking** finding — the backdate streak used the incremental form (dead `computeStreak`), which regressed `lastActiveDate` and could inflate a streak across a backdated day, a silent deviation from the signed D-G/D-H. Fixed: `computeStreak` over the domain's source-row localDates for backdate batches + `lastActiveDate` never regresses + a test encoding the exact inflation scenario. Folded in the same pass: the promised single-flight interleaving test (N-1) and the runtime resolved-strict parse at `commit()` entry (N-2). Pass 2: **ACCEPTABLE TO LAND** (BLOCKING 0).

**Deferred non-blocking follow-ups** (from the Sol reviews — none block SAR-004; none is trust-critical on the current paths; fold into the relevant next ticket):

- **N-3 →** `resolve.ts` has no correction-target validation branch; an accepted correction whose `matchedEntryId` is gone rejects the whole batch (fails closed, never mutates) instead of demoting to a question. Add the D-C validation at the **SAR-006** capture-API boundary (or SAR-014).
- **N-4 →** `habit_logs`' unique `(userId,habitId,localDate)` index counts soft-deleted rows, so an undo→re-accept of the same habit/day (a plausible F3 demo gesture) rejects the new commit. Fails closed (no wrong write). Needs a **schema change** (partial unique index excluding soft-deleted, or hard-delete creates on undo) — out of SAR-004 scope; own it in a follow-up (SAR-009 or a schema ticket).
- **N-5 →** the evidence writer (plan step h) and a progress effect for the satisfied-by log (plan step g) are not built; both are dead paths pre-SAR-011/SAR-009 (`evidenceRefs` are always empty until vision). Flag so SAR-009/SAR-011 don't assume they exist.
- **N-6 →** `wrongSilentWrites === 0` is proven per-scenario, not as the aggregate hard counter over every fixture. **SAR-007** owns the real `EvalReport` counter.
- **R-1/R-2 →** the N-2 runtime parse is proven at the schema level, not yet driven through `commit()` with a malformed payload; and it precedes the idempotency lookup, so a replay with a now-malformed payload throws rather than replaying. Cover both in the **SAR-006** API-boundary tests (the type system won't exist at that edge).

**Gate / eval status:** SAR-004 satisfies Architecture **build-gate 9.2** and the safety half of 9.3, and delivers the middle of FLOWS **F3 steps 2–6** headless. No FLOWS gate passes end-to-end yet — **F3 passes at SAR-007** once SAR-005/006 add the token shell + Today spine + capture sheet. The eval fixtures (`explicit-low-confidence`, `ambiguous-skill`, `correction-existing-entry`, `backdate-habit`, `undo-batch`, `provider-failure`, canonical routing) are authored under `tests/fixtures/capture/`; SAR-007's harness will consume them for the real numbers.

## 3. Current repository map

```text
core/capture/contract.ts          versioned draft-permissive / resolved-strict Zod contract (7 kinds)
core/capture/route.ts             route-by-confidence policy; sole owner of AUTO_WRITE_CONFIDENCE_BPS
core/capture/resolve.ts           name→entity resolution; ask-don't-invent demotions
core/capture/parse.ts             parseDump (deep tier); failure → retryable draft, zero rows
core/capture/commit.ts            CommitService: exhaustive typed commit + XP/plan/satisfied-by effects + single-flight + undo
core/game/{xp,streak,progress}.ts pure integer XP/level/streak/progress + reversal kernels
data/repository/commits.ts        guarded markUndone/markSuperseded audit-state transitions
tests/{capture-contract,game,route,parse,commit,undo,commit-state}.test.ts + fixtures/capture/
data/schema/*, data/repository/*  (SAR-003) drizzle-free contract + dialects + bound scoped repositories — unchanged
providers/*                       (SAR-002) keyless fake LLM/voice/vision stack — unchanged
core/domains/, core/coach/        placeholders — SAR-014 owns the CoachEngine/DomainSpec registry
```

Useful commands: `make doctor` · `pnpm install --frozen-lockfile` · `pnpm check` · `pnpm build` · `.codex/hooks/check-invariants.sh` · `pnpm db:generate` (human-gated).

## 4. SAR-005 boundary

**Ticket:** `SAR-005 — Token shell and thin Today spine` · **Agent:** `screens` (Terra) · **Depends:** `SAR-001`, `SAR-003`.

Read before planning: `docs/experience/DESIGN.md` §§2–7 · `docs/experience/DESIGN-PROMPTS.md` P0, P2 · `docs/screens/SCREEN-TODAY.md` · `docs/experience/FLOWS.md` F2–F3 · `AGENTS.md` §2 (esp. invariant #4 tokens-only UI).

Build the token layer (CSS variables — 3 themes × 2 modes; amber only on XP/streak/level) and the app shell + a thin Today spine that reads the SAR-003 repositories. **Do not** build the capture sheet / swipe deck / inline level-up (SAR-006), wire live providers, or bind the full coach. Keep `core/` framework-clean; UI lives outside `core/`. SAR-005 + SAR-006 together make the SAR-004 pipeline visible so SAR-007 can run F3 end-to-end.

## 5. `.codex` skill policy

- The full policy remains in `docs/handsoff/handsoff_01.md` §5 and still applies. Read a relevant skill before use, but `AGENTS.md`, the architecture, and screen/design docs override every skill default.

## 6. Resume procedure

1. Read this handoff, `AGENTS.md`, `docs/experience/DESIGN.md` §§2–7, `docs/screens/SCREEN-TODAY.md`, and `docs/planning/TICKETS.md` SAR-005.
2. Run `make doctor`; inspect `git status --short`.
3. Confirm Satvik's branch/commit/merge intent for the uncommitted SAR-004 tree on `sar-003-schema-repository` before continuing; do not overwrite it.
4. Write `.codex/plan.md` for **SAR-005 only**, then **STOP** for Satvik's plan sign-off. Only then assign the plan to the Terra `screens` role.
5. After implementation, run a read-only adversarial review against every SAR-005 acceptance item; then drive `SAR-006`/`SAR-007` toward the F3 gate (screenshot-verify at 390px + desktop per the DoD).

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_04.md`. `SAR-001`–`SAR-004` are accepted (the capture moat is built, keyless, two-pass gate-reviewed); `SAR-005` is not planned. Read `AGENTS.md`, `docs/experience/DESIGN.md` §§2–7, `docs/screens/SCREEN-TODAY.md`, FLOWS F2–F3, and the SAR-005 ticket; run `make doctor`; inspect `git status --short` (SAR-004 is uncommitted on `sar-003-schema-repository` — confirm the branch/commit intent first); then write only the `.codex/plan.md` for SAR-005 and stop for sign-off. Preserve the keyless fake stack, tokens-only UI (invariant #4), the D-036/D-037 pins, the repository-bound `userId` scoping, and the no-silent-estimate invariant.
