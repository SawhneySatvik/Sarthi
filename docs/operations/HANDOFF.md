# docs/operations/HANDOFF.md — Sarthi · Session Handoff (Planning → Codex Build)

| | |
|---|---|
| **Written** | 2026-07-17 — Session 1 document reconciliation |
| **For** | The next action: plan `SAR-004` (capture routing/commit/undo — the moat) only, then continue the F3-first build |
| **Read order** | AGENTS.md → docs/product/PROJECT.md → docs/architecture/TECH-STACK.md → docs/experience/FLOWS.md → rest as needed |
| **State of play** | Phase-0/1 contract reconciled. 37 decisions, signed architecture, and locked tickets; `SAR-001`, `SAR-002`, and `SAR-003` are accepted. The typed persistence floor + user-scoped repository factory + local auth gate are built, validated (`pnpm check` 46 tests, build, invariants clean), and gate-reviewed. Working tree is uncommitted on `main` pending Satvik's branch+commit call. |

## 1. What Sarthi is
A voice-and-photo life coach. One messy spoken sentence is parsed into typed entries across four
domains at once (Health · Money · Habits · Skills). Explicit values file silently; estimates surface as
swipe cards (nothing estimated writes unconfirmed). A three-tier coach reacts per capture, briefs daily,
reflects weekly, and adapts the plan glass-box (before → after → reason, revertible). Health/Money/Habits
run day-based arcs; Skills run mastery hours. Moat = one capture pipeline, four typed stores, four
deliberately-unalike review lenses.

## 2. Hackathon frame
OpenAI Build Week · Track: Apps for your life. Submit Tue Jul 21, 5:00 PM PT. Deliverables: working
project, <3-min public YouTube demo (audio covers Codex AND GPT-5.6 usage), public repo, README with
setup + sample data, the Codex /feedback session ID from where core was built.
Two model layers — never conflate: (a) Build = Codex + GPT-5.6 (the rubric story; capture the session ID).
(b) Runtime = provider-agnostic via Vercel AI SDK — dev default Gemini free tier, GPT-5.6 + Claude wired;
demo provider flips by env at record time (D-006, the only open decision).
Credits: 1,250 Codex credits + $100 grant requested. Not a blocker.

## 3. The document set (the build contract) — see AGENTS.md §5 for the full map.

## 4. Decisions digest — full log in docs/product/DECISIONS.md (D-001–D-037). D-006 (demo runtime provider) remains the only pre-recording runtime call; mobile bake-off and paid feature catalogue remain Phase 2. D-037 locks the database driver line (SQLite `@libsql/client` / Postgres `postgres-js`, one async repository over both).

## 5. Parallel tracks
- Prototype (Claude Design): shell + most screens built; capture sheet screenshots pending review.
  Prototype = visual target only; Codex builds fresh (provenance).
- Assets: generation follows the approved ticket dependencies; gradients + grain remain the permanent fallback.
- Repo: fresh Codex workspace with project controls and docs; the `SAR-001` application scaffold, `SAR-002` keyless provider/fake stack, and `SAR-003` dialect schema + bound repository factory are accepted.

## 6. NEXT SESSION — Codex environment, step by step
1. Replace the stale PRD in project context with the current doc set. (Done — docs/ holds v2.1.)
2. Repo init in Codex (fresh, not forked). Confirm the /feedback session ID mechanism; note the ID.
3. AGENTS.md at repo root points Codex at docs/, states the invariants, names FLOWS gates as DoD. (Done.)
4. Before each build: architecture and `docs/planning/TICKETS.md` are signed; create and approve `.codex/plan.md` for the next ticket only. `SAR-001`–`SAR-003` are accepted; `SAR-004` (capture routing/commit/undo) is next — both `SAR-004` and `SAR-005` are now dependency-eligible, but front-load the pipeline (SAR-004) per AGENTS.md §4.
5. First build sequence:
   a. Scaffold: Next.js + TS + Tailwind + Drizzle + shadcn; token layer + shell (Ember/Bone/Moss). **Accepted as `SAR-001`.**
   b. Provider layer: LLM gateway (matrix + env routing) + VoiceProvider + vision + the fake stack (keyless). **Accepted as `SAR-002`.**
   c. Typed schemas: per-domain tables + Progress/Plan/Adaptation/CoachNote + repository impl (SQLite). **Accepted as `SAR-003`.**
   d. Capture pipeline: parse_dump (deep tier, generateObject+Zod → CaptureDraft) → route-by-confidence →
      commit path with undo → XP award. **← NEXT: `SAR-004`.**
   e. Health store + lens; capture sheet UI (static-orb fallback first; shader after F3 passes).
   GATE: FLOWS F3 end-to-end on the fake stack, keyless, with Health. Then verify with real Gemini keys.
6. Verify model IDs before wiring: exact Gemini + GPT-5.6 API strings + current AI SDK structured-output support.
7. Start screenshot-verify (`.verify/screens/`) from the first commit; mobile is fidelity gate and desktop is smoke (D-034). Log 3–4 "Codex accelerated X" moments.

## 7. Remaining work order

`docs/product/PHASES.md` and `docs/planning/TICKETS.md` are the sole current execution order. F3 unlocks fan-out; the billing rail falls back to waitlist only when its signed webhook/replay acceptance cannot be proven without blocking a higher-priority gate. No slice waits for a calendar checkpoint.

## 8. Risks
Wrong SILENT writes are the worst failure (eval-tracked; swipe gate = trust) · hold scope, no new domain
concepts mid-build · orb is polish behind a fallback, never a blocker · art can ship as gradients+grain ·
Vercel+Supabase deploy has a local+Loom fallback · keep the Codex session ID or the rubric story breaks.

One line: `SAR-001`–`SAR-003` are accepted (persistence floor is built + validated) — read the contract, plan and approve `SAR-004` (the capture pipeline), then drive to F3.
