# docs/planning/PLANNING-BRIEF.md — The Claude Max Mega-Planning Session (Phase 2+)

> **When:** Sat Jul 18 (Max plan, unlimited window) — runs PARALLEL to the Codex build; it must not
> pull hands off the Phase-0/1 keyboard for long. **Where:** Claude (web), this project, all docs uploaded.
> **Output home:** `docs/roadmap/` — same doc style as the existing set (states, data contracts, verify
> checklists, decision entries). These docs are the *base*; the session extends, never silently rewrites.

## Ground rules for the session
- Nothing decided here changes Phase 0/1 scope (D-026 rings are locked). Outputs are Phase-2+ contracts.
- Every decision lands as a D-0XX entry appended to docs/product/DECISIONS.md — constraints, not suggestions.
- Prefer decision matrices + explicit criteria over vibes. Cite sources for market/pricing claims.

## Agenda (in order)

### 1. Mobile bake-off (resolves D-027)
Produce `docs/roadmap/MOBILE-BAKEOFF.md`:
- Contenders: **Capacitor wrap** (reuse Next.js) · **Expo/React Native** (shared TS `core/`, new UI) ·
  **native Swift/Kotlin** (later, per-platform).
- Criteria matrix: time-to-store · code reuse of `core/` + provider layer · PTT/mic + camera quality ·
  offline story · push notifications · perf of the swipe deck/orb · maintenance cost solo · App Store risk.
- Include the migration cost given the D-027 discipline (core/ is framework-import-clean).
- Output: a scored matrix + ONE recommendation + a D-030 draft.

### 2. Monetization deep-dive (resolves D-029 open half)
Produce `docs/roadmap/MONETIZATION.md`:
- Provider decision: Razorpay (India-first) vs Stripe vs merchant-of-record (Paddle/LemonSqueezy — tax
  handling for global sales). Include activation lead times + fee tables.
- Pricing research: comparable life/habit/coach apps (₹ and $ points), free-tier line, annual vs monthly.
- The Pro feature set: which of {multi-profile, deeper coach tiers, unlimited captures, priority/streaming
  voice, estimate-memory, extra themes/art} gate behind Pro — with the "judges/demo never paywalled" rule.
- AI cost model per active user/day across tiers (feeds the free-tier line).

### 3. Phase-2 decomposition
Rewrite docs/product/PHASES.md §Phase-2 as ticket-ready specs in `docs/roadmap/` (one doc per feature, the SCREEN-*.md
pattern): estimate-memory, streaming voice, push, offline sync, remaining Tools, theme editor.
Sequence them; name the gates; mark dependencies on the bake-off winner.

### 4. Competitive + positioning scan
One tight doc: who else does voice-first multi-domain capture; the wedge sentence; what the landing page
should claim (and must not claim).

### 5. Session close
- Append all D-0XX entries · write a HANDOFF-ROADMAP.md (state of play for the Codex Phase-2 kickoff) ·
  list the top 5 risks for Phase 2.

## Handoff back to Codex
Drop `docs/roadmap/` into the repo. The `architect` (Sol) turns each roadmap doc into `.codex/plan.md`
tickets; `pipeline`/`screens` (Terra) build; `reviewer` (Sol) gates each phase. Same harness, new phases.
