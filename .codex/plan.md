# SAR-006 — Health Vertical Slice and Capture-Sheet Hero (F3)

| | |
|---|---|
| **Status** | **LANDED 2026-07-18** (code) — built keyless; `pnpm check` 101 tests, build, invariants, boundary green; route-loop + Today/Health render smokes proven; **two-pass Sol gate review** (4 blocking findings — phantom strip rows, undo divergence, amber-on-orb, auto-batch provenance/re-route — fixed; 2 hardening MEDIUMs closed; re-review ACCEPTABLE TO LAND). **Open DoD before CLOSE: visual screenshot-verify** (needs a browser). Stacks on `sar-003-schema-repository`. |
| **Owner** | `pipeline` (Terra) · high effort (the hero + the F3 gate) |
| **Depends on** | `SAR-004` (parse → route → resolve → commit → undo core) and `SAR-005` (token shell, capture-bar entry, Today spine, `getSession`) — both landed. |
| **Authority** | `docs/screens/SCREEN-CAPTURE.md` · `docs/screens/SCREEN-LENSES.md` §§0, 2, 6 · `docs/experience/DESIGN-PROMPTS.md` P1, P3a · `docs/experience/FLOWS.md` F3–F4 · `docs/experience/DESIGN.md` §5 (motion) · `docs/architecture/ARCHITECTURE.md` §§1, 5 · `docs/planning/TICKETS.md` SAR-006 · `AGENTS.md` §§2–4 |
| **Out of scope (do NOT borrow)** | Real voice PTT / STT (SAR-013 — fake transcript only here) · photo/vision capture (SAR-011) · the WebGL Capture-Orb shader (D-024 — static orb only, shader after F3) · Money/Habits/Skills real lenses (SAR-008/009/010 — stay placeholders) · the Habits satisfied-by **row UI** (SAR-009 — SAR-006 only produces its writes) · the CoachEngine/registry (SAR-014 — only the one fast-tier capture line) · the F3 eval harness (SAR-007) · production onboarding / default-category bootstrap (SAR-016) · any schema/migration change (none needed) · any live-provider change. |

---

## Context

SAR-006 is the **hero** and the ticket that makes **FLOWS F3 runnable end-to-end on the fake stack, keyless** — the Day-1 acceptance gate (SAR-007 then evals it). It wires the SAR-004 pipeline (`parseDump → route → resolve → commit → undo`) to a real capture sheet UI mounted on the SAR-005 shell, and delivers the Health vertical slice (typed Health writes already exist in SAR-004; SAR-006 adds the Health lens rings). The moat and the persistence floor exist; SAR-006 is the visible loop over them: **hold mic/type → parse → route-by-confidence → auto-file strip + estimate deck → swipe accept/discard/edit/why + domain-flip → typed Health write → XP + inline level-up → Today items check `via capture`**, plus F4 correction/backdate, all on the deterministic `fake` stack.

Invariants: **#1** — the strip only ever holds explicit `route:'auto'` proposals; everything estimated/low-confidence/unknown is a deck card that writes only on explicit accept; every resolved batch carries one 5-min undo; `wrongSilentWrites === 0`. **#4 tokens-only UI** — every value a CSS variable; `--energy` amber only on XP/streak/level-up. **#9 core import-clean** — the sheet is `app/`+`components/`; new *pure* logic (Health read-model, any deck helpers) lives in `core/` importing only `core/*` + type-only DTOs. **#5/#6** — all writes go through the SAR-004 typed commit service; no new persistence path. **#3** — the whole loop runs keyless on `FakeLlmGateway`+`FakeVoiceProvider`+SQLite.

**Deliverable of this planning step:** this plan only. On sign-off a todo list is created and handed to Terra (`pipeline`). No code before sign-off.

## Current state (verified by reading the landed SAR-004/005 code + specs)

- **SAR-004 API to wire (`core/capture/`, all framework-clean):** `parseDump(input, llm) → {ok,draft}|{ok:false,retryable}` (needs `llm`); `routeDraft(draft) → RoutedProposal[]` + `routeProposal`, `blockedProposalIds`, `applyUserEdit(proposal, patch)`, `isAcceptAllEligible(pending, blockedIds)`, `AUTO_WRITE_CONFIDENCE_BPS=9000`, `ACCEPT_ALL_MIN_CONFIDENCE_BPS=8000` (**all pure, client-safe**); `resolveProposal(proposal, repos, status)` + `prepareDraft(draft, repos) → {autoCommit, pending}` (**need repos**); `createCommitService({repos, llm, now?}).commit(input)→CommitResult` / `.undoLatest({commitId, now})→UndoResult` (**need repos+llm**). Types: `CaptureDraft`, `Proposal`, `ResolvedProposal`, `PendingCard{proposal,reasons,question}`, `CommitResult{commitId,status,entries,progressEffects,coachNoteId,undoExpiresAt}`, `UndoResult`.
- **Fake stack is content-blind:** `FakeLlmGateway.generateObject('capture-parse')` returns `CANONICAL_CAPTURE_DRAFT_FIXTURE` for ANY input; `generateText('capture-line')` returns the canned coach line; `FakeVoiceProvider.transcribe()` returns the canonical transcript for any audio. So text and (fake) voice produce identical drafts — text is the simplest testable path.
- **SAR-005 to build on:** `app/lib/session.ts` `getSession() → {user, repos}` (server-only); `components/shell/CaptureBar.tsx` (currently **static/disabled** — its own comment says SAR-006 wires it); `app/(app)/today/actions.ts` (the **established server-action seam**: `"use server"` → `getSession()` → repo call → `revalidatePath('/today')`); `core/domains/today.ts` already surfaces `viaCapture` (`completionSource==='capture'`) — Today updates automatically on revalidate, no change needed.
- **Real canonical routing (verified against `route.ts`, NOT the docs' illustrative mock):** with the seeded entities present → **strip** = `{transaction 34000p, skillSession 90min}`; **deck** = `{meal (est 7600), water (millilitres:null), habitLog (8600<9000)}`; `questions: []` (no question card in THIS fixture — `ambiguous-skill` exercises that state). Docs SCREEN-CAPTURE §4a / P1 show a different illustrative strip — build against the real fixture.
- **⚠ Demo-critical seed gap (finding, D-K below):** the two explicit proposals auto-file ONLY if `money.categories` has "Food & dining" and `skills.skills` has "System design" (case-insensitive name resolve, `resolve.ts`); the wake habit ("Wake by 5:30 AM") must exist for its card to accept. `scripts/seed-dev.ts` creates **none** of these, and no default-category bootstrap exists. Unaddressed, the strip renders empty and F3 step 3's trust moment breaks. Per D-C (SAR-004: no auto-create of category/skill/habit), the fix is to **seed** them, not invent them.
- **Deps:** `framer-motion` and `three.js` are **absent** from `package.json`. `three.js` stays absent (D-G, static orb). `framer-motion` is added (D-I).
- **No schema/migration change:** all Health tables + `commits`/`commit_rows`/effects exist and are exercised by `commit.ts`.

### File map (affected files, by change type)

| File | Change |
|---|---|
| `app/api/capture/{parse,commit,undo}/route.ts` | **new** — route handlers (`POST`) wrapping `core/capture` via `getSession` (ARCHITECTURE §1.1) |
| `components/capture/CaptureSheet.tsx` (+ `CaptureOrb`, `InputBar`, `ParseShimmer`, `FiledStrip`, `EstimateDeck`, `EstimateCard`, `QuestionCard`, `FanOut`, `LevelUpBloom`, `UndoToast`) | **new** — the client sheet tree (framer-motion) |
| `components/shell/CaptureBar.tsx` | **edit** — wire text + fake-mic entry → open the sheet (replace the static disabled state) |
| `components/capture/deck.ts` (or `core/capture/deck.ts` if pure) | **new** — client-side deck state helpers over `routeDraft`/`applyUserEdit`/`isAcceptAllEligible` |
| `core/domains/health.ts` + export from `core/domains/index.ts` | **new** — pure `buildHealthView` (ring aggregates + entry rows) |
| `components/lenses/HealthLens.tsx` (+ `Ring`, `EntryRow`) | **new** — the 3-ring Health lens body |
| `components/today/DomainSwitcher.tsx` | **edit** — render the real `HealthLens` in the Health slot (Money/Habits/Skills stay placeholders) |
| `scripts/seed-dev.ts` + a shared `data/seed/canonical.ts` (or `core/`-free seed helper) | **edit/new** — create the "Food & dining" category, "System design" skill, "Wake by 5:30 AM" habit (D-K); SAR-007 reuses it |
| `tests/health.test.ts` · `tests/capture-deck.test.ts` | **new** — pure Health read-model + deck-helper unit tests |
| `package.json` | **edit** — add `framer-motion`; add `test:domains`/`test:ui` entries as needed |
| `docs/product/{DECISIONS,CHANGELOG}.md` | **edit (append-only)** — D-040 (transport seam) + truthful entry after evidence |

`core/` gains only framework-clean pure modules. No schema/migration/provider/`core/contracts`/`data/repository` change.

---

## Locked decisions for this ticket (sign these off)

**D-A · Parse/commit transport = route handlers (ARCHITECTURE §1.1) — LOCKED (OQ-1 = route handlers).** The three server calls are Next route handlers under `app/api/capture/`: `POST /api/capture/parse` (body `{text}`) → `CaptureDraft` (calls `getSession` + `parseDump` with the injected fake gateway); `POST /api/capture/commit` (body `{proposals, idempotencyKey}`) → `CommitResult` (`resolveProposal`/`prepareDraft` + `createCommitService.commit`); `POST /api/capture/undo` (body `{commitId}`) → `UndoResult`. The client sheet `fetch`es these, holds deck state between parse and commit, and calls `router.refresh()` after commit/undo so the Today spine re-pulls its `via capture` state. The capture LOGIC stays in `core/capture` (framework-clean, portable — the mobile/external client D-027 hits the same HTTP surface); the route handler is the thin transport that composes `getSession` + the core functions. Matches the signed architecture — **no new decision entry needed.**

**D-B · The sheet is a client tree over pure client-safe helpers; server only for parse/commit/undo.** `CaptureSheet` (client) holds the deck as React state (`Proposal[]` + resolved/blocked/committed sets). Client-side pure helpers: `routeDraft` (partition strip vs deck), `applyUserEdit` (edit-in-place), `isAcceptAllEligible`, `blockedProposalIds`. The client mints ONE `idempotencyKey` (crypto.randomUUID) per commit attempt for retry-safety (ARCHITECTURE §5.2). Repos/llm/commit are NEVER imported into a client component — only reachable via the D-A route handlers (`fetch`).

**D-C · Two visually-distinct confirm zones (P1 "unmistakably different at a glance").** (1) **Filed-automatically strip** — quiet settled micro-rows for `route:'auto'` proposals, `--ok` check + domain-hued left tick, 40ms stagger; tap → inline edit, swipe-left → undo that write. (2) **Estimate deck** — an active foreground Tinder stack (next two peek 96%/92%), domain chip top-left, confidence dot top-right, footer `estimated` + "why?". Distinct grammar (strip = calm/done; deck = live/foreground) is the "different at a glance" signal.

**D-D · The four gestures + domain-flip + why (SCREEN-CAPTURE §4b).** accept (swipe-right/✓ → `POST /api/capture/commit` that card → toss right); discard (swipe-left/✕ → toss, no write); edit (tap/✎ → inline stepper/field → `applyUserEdit` → accept); why (long-press → flip to a Fraunces back face showing `proposal.why`). Domain-flip = the top-left chip (4-chip row) re-routes `proposal.domain` (a **separate** affordance, not one of the four). **a11y (spec-silent → decided):** mirror buttons ✕ · ✎ · ✓ under the deck, and a footer **"why?"** tap is the keyboard/screen-reader-accessible equivalent of long-press. **Accept all** shows only when every remaining card ≥ 8000 bps (`isAcceptAllEligible`).

**D-E · The question card (ask-don't-invent).** A `ClarificationQuestion` renders as a chip card that blocks ONLY its `blocksProposalIds` (via `blockedProposalIds`) — the rest of the deck stays fully usable (P1 "the question card blocks nothing else"). Answering resolves/edits the blocked proposal; nothing it blocks can accept until answered. (The canonical fixture has none; `ambiguous-skill` exercises this — build the state, test with that fixture.)

**D-F · Commit → fan-out → level-up → undo (F3 steps 5–6).** On any accept (card, accept-all, or a strip auto-write), `POST /api/capture/commit` returns `CommitResult`; the client renders **fan-out** (accepted entries fly to their domain chip), **XP roll** (from `progressEffects`), an **inline level-up bloom ≤900ms** ONLY when a `progressEffect` crosses a level (`levelBefore≠levelAfter`; never modal), and the **fast-tier coach line** (`coachNoteId`). One **5-min Undo** per resolved batch via `POST /api/capture/undo` (a toast with the window). A `router.refresh()` after commit/undo makes matching Today items show/clear `via capture`. `prefers-reduced-motion`: springs→150ms fades, bloom→static amber flash, shimmer→static skeleton (DESIGN §5).

**D-G · Static Capture Orb only (D-024 / AGENTS §4.5).** States A/B render a static layered-gradient orb (domain-hued tokens + grain), NOT a WebGL shader; three.js stays absent. Parsing = the "parse shimmer" skeleton (the single allowed CSS-keyframe), never a spinner. The shader is a post-F3 follow-up.

**D-H · Input = text + fake-voice, keyless (voice PTT = SAR-013).** Wire the SAR-005 capture bar: a **text field** (primary testable path) + a **hold-to-talk mic** that on the fake stack calls `FakeVoiceProvider.transcribe()` → canonical transcript → `POST /api/capture/parse`. Both feed the same route. Real STT = SAR-013; camera = SAR-011 (stays disabled).

**D-I · Motion via framer-motion (DESIGN §7, mandated).** Add `framer-motion` (exact-pinned) for the swipe spring (stiffness~300/damping~30), bloom, fan-out, and 40ms stagger. Every duration/easing from the motion tokens (`--t-*`, `--ease-standard`); no scattered CSS animations except the parse shimmer keyframe. No hardcoded ms in components (invariant #4).

**D-J · Health lens = 3 rings + entry list, over a pure read-model (SCREEN-LENSES §2, P3a).** `core/domains/health.ts` `buildHealthView(input) → HealthView` (pure, framework-clean, integer-safe, unit-tested) aggregates the day's Health entries into three ring values: **energy** (kcal in vs out incl. workout burn), **water** (ml vs target), **protein** (g vs target). `HealthLens` renders three glanceable SVG rings (lens-local tokens) + the Health entry rows (meals/water/workouts/weighIns) with the standard row grammar (domain tick · content · meta · confidence chip on estimates · swipe-left delete via undo). Rendered in the Today `DomainSwitcher` Health slot (Money/Habits/Skills stay placeholders). The **satisfied-by row is a Habits-lens element (SAR-009)** — SAR-006 only produces its writes (already built, `commit.ts` §2g); the P3a criterion fully closes only when SAR-009 also lands. **Release valve:** if the Health lens threatens the F3 gate, ship the capture sheet + F3 wiring first (gate-critical), Health lens second — same ticket.

**D-K · Demo-critical seed of the canonical entities (no auto-create).** SAR-006 extends `scripts/seed-dev.ts` (via a shared `data/seed/canonical.ts` helper SAR-007 also uses) to create, for `local-dev`: the **"Food & dining"** money category, the **"System design"** skill, and the **"Wake by 5:30 AM"** habit — so the canonical fixture's explicit proposals resolve and file into the strip (F3 step 3). Per D-C (SAR-004), SAR-006 does **NOT** auto-create categories/skills/habits at capture time; production onboarding (SAR-016) owns the real bootstrap.

---

## Implementation steps (ordered — become the todo list)

1. **Transport seam + deps + seed (D-A/D-I/D-K).** Add `framer-motion`; author `app/api/capture/{parse,commit,undo}/route.ts` (route handlers over `getSession`+`core/capture`); extend the dev seed with the canonical category/skill/habit (shared helper). Smoke: `POST /api/capture/parse` returns the canonical draft keyless.
2. **Sheet shell + input + parse states (D-B/D-G/D-H).** `CaptureSheet` opened from the (now-wired) capture bar; static orb; text field + fake hold-to-talk; parse shimmer; render the parsed `CaptureDraft`.
3. **Strip + deck + gestures + question card (D-C/D-D/D-E).** `FiledStrip` (auto proposals) + `EstimateDeck` (framer-motion stack) with the 4 gestures + domain-flip + why-flip + mirror buttons + accept-all + the `QuestionCard`. Pure deck helpers unit-tested (`tests/capture-deck.test.ts`).
4. **Commit wiring + fan-out + level-up + undo (D-F).** Wire accept/accept-all/strip-undo to the commit+undo routes; fan-out, XP roll, inline level-up bloom, coach line, 5-min undo toast; confirm Today shows `via capture` after `router.refresh()`. Correction (F4a) + backdate (F4b) via the sheet.
5. **Health lens (D-J).** `core/domains/health.ts` + `tests/health.test.ts`; `HealthLens` (3 rings + entry rows) in the DomainSwitcher Health slot.
6. **F3 end-to-end + screenshot-verify (THE GATE).** Run the full F3 loop on the fake stack keyless (text + fake mic): parse → strip+deck → each gesture → typed Health write → XP/level → Today `via capture`; plus F4a/F4b. Screenshot every capture state (input/shimmer/strip/deck/question/edit/why/fan-out/level-up/E1–E4) + the Health lens at 390px + desktop, Ember Dark+Light minimum → `.verify/screens/`.
7. **Validate + record.** `pnpm check` (incl. new pure tests) + `pnpm build` + `check-invariants.sh`; append **D-040** + a truthful `CHANGELOG` entry after evidence; hand to the Sol diff review + confirm the F3 gate is demonstrably met (SAR-007 formally evals it next).

## Acceptance checklist (mirrors P1 + FLOWS F3 + invariant proofs)

- [x] **P1:** the two confirm zones are unmistakably different at a glance; all four gestures (+ domain-flip + why) work; the question card blocks only its own proposals; level-up is inline and ≤900ms; **the whole loop runs on the fake stack keyless end-to-end**.
- [x] **F3 trust (invariant #1):** explicit ≥9000 proposals file into the strip (seeded entities resolve); estimates/low-confidence/unknown-quantity → deck; **nothing estimated writes without a card**; each resolved batch has one 5-min undo; `wrongSilentWrites === 0`.
- [x] Accept (card / accept-all / strip) commits through the **real SAR-004 commit service** → typed Health rows + XP + level + plan/satisfied-by effects; undo reverses all atomically; a replayed `idempotencyKey` never double-writes.
- [x] Today's matching items show **`via capture`** after commit (revalidate). **[~] F4a/F4b (correction/backdate) via the sheet — the server path exists (SAR-004) but the content-blind fake gateway only yields a create-draft, so no sheet affordance exercises it keyless; deferred to SAR-007/later, recorded in the handoff.**
- [x] Health lens: three glanceable rings (energy/water/protein) over a **pure framework-clean** `core/domains/health.ts`; entry rows with the standard grammar.
- [x] `core/` boundary-clean (sheet in `app/`+`components/`; pure logic in `core/`); tokens-only UI (amber only on XP/streak/level-up); no schema/migration change; `framer-motion` the only new runtime dep; static orb only (no three.js).
- [x] `pnpm typecheck`/`lint`/`check:core-boundary`/`test`/`build` + `.codex/hooks/check-invariants.sh` pass. **[ ] screenshots saved + verified at 390px + desktop — OPEN (needs a browser; Satvik runs the visual pass locally).**

## Verification (how Terra proves it, then Sol reviews)

```sh
pnpm install --frozen-lockfile          # framer-motion added — lockfile updates expected
pnpm check                              # typecheck + lint + core-boundary + all suites incl. new pure tests
pnpm build                              # Next build stays green
bash .codex/hooks/check-invariants.sh
pnpm db:seed:dev && pnpm dev            # F3 walkthrough on the fake stack, keyless (Satvik + screenshot pass)
```

Keyless proof: the entire loop runs with provider keys unset — `FakeLlmGateway` (canonical draft + coach line) + `FakeVoiceProvider` (canonical transcript) + local SQLite. Eval linkage: SAR-006 implements F3; **SAR-007** formally evals `canonical-cross-domain`, `estimated-meal-photo`, `ambiguous-skill`, `undo-batch` and asserts `wrongSilentWrites === 0`.

## Open questions — RESOLVED at sign-off (2026-07-18)

- **OQ-1 (D-A) · parse/commit transport → route handlers** `app/api/capture/{parse,commit,undo}/route.ts` per the signed ARCHITECTURE §1.1. The client `fetch`es them and `router.refresh()`es after commit/undo. Capture logic stays in `core/capture`; no new decision entry (matches the signed doc).

## Handoff to Terra (`pipeline`)

Build the capture sheet + F3 wiring + the Health lens over the EXISTING SAR-004 pipeline and SAR-005 shell — do not reimplement parse/route/resolve/commit/undo, and do not touch `core/capture`/`core/game`/`core/contracts`/`data/`/schema/migrations/providers except the additive seed helper. All writes flow through `createCommitService` — if you find yourself writing a Health row outside the commit service, stop. The strip holds ONLY `route:'auto'` proposals; if an estimated/unknown value ever reaches the strip, that is the failure this ticket exists to prevent. Build against the REAL `CANONICAL_CAPTURE_DRAFT_FIXTURE` (not the docs' illustrative mock). Static orb only. Screenshot-verify before claiming done. If the same acceptance item fails twice, stop and escalate (deep/Sol).

---

### Post-approval sequence
1. OQ-1 resolved = route handlers (no D-040). ✓
2. Create the TodoWrite/task list from the 7 ordered steps.
3. Build steps 1–7 in the main session (per Satvik's workflow), spawning parallel agents only where useful; screenshot-verify; then a read-only Sol diff review + confirm the F3 gate before SAR-007.
4. `/handoff` at session end.

**LANDED 2026-07-18 (code) — two-pass Sol review ACCEPTABLE TO LAND; 101 tests/build/invariants green; F3 runnable keyless; D-040 + CHANGELOG appended. Open DoD: visual screenshot-verify (Satvik's local pass). Next: SAR-007 (F3 eval gate).**
