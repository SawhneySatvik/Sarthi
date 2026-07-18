# Sarthi — Decisions Log

> Append-only record of build decisions. Each is a constraint, not a suggestion (per the operating guide).
> Format: ID · date · decision · why · status. Full stack detail lives in `docs/architecture/TECH-STACK.md`; product scope in `docs/product/PRD.md`.

---

## 2026-07-15 — Stack & doc session

**D-001 · Repo shape → all-TypeScript, single Next.js app on Vercel.**
Why: fastest solo build+deploy in the window — one language, one repo, one deploy, no CORS/two-service ops; Vercel AI SDK supplies the model-agnostic gateway for free. Supersedes the PRD v2 "Python/FastAPI + Next.js split" default. · **Locked**

**D-002 · Timeline → 3-day core, then polish to Jul 21.**
Why: front-load the capture pipeline to a working demo fast; fan-out, voice, game, Journey, eval land in the polish phase. Release valve (Money → light ledger) stays holstered unless Day 2 slips. · **Locked**

**D-003 · Agents → one engine, config-specialized per domain, with a seam to split later.**
Why: the "all four domains in days" thesis depends on building the pipeline once. "Specialized agents" = domain specs in a registry (parse hints + coach spec + tool subset), not 6–7 hand-built orchestrations. Reconciles doc 3's "6–7 agents" with the PRD's "one generic Domain-Coach." · **Locked**

**D-004 · Model layers → split build from runtime.**
- Build/coding layer = **Codex + GPT-5.6** (the hackathon's GPT-5.6 requirement; capture `/feedback` session ID).
- Runtime layer = **provider-agnostic via Vercel AI SDK**; tiers are provider-neutral (`deep`/`balanced`/`fast`, was Sol/Terra/Luna).
Why: keeps the rubric story clean while decoupling which model the app calls at runtime. Supersedes PRD v2's treatment of GPT-5.6 as the app's runtime brain. · **Locked**

**D-005 · Runtime dev default → Gemini free tier; GPT-5.6 + Claude adapters stay wired.**
Why: generous free tier → cheap iteration through the build. `(provider, tier) → model` matrix; flip providers by env var. · **Locked**

**D-006 · Demo/submission runtime model → both GPT-5.6 and Gemini wired; decide at record time.**
Why: env-flip makes it a zero-cost late decision. Note: running the demo on GPT-5.6 keeps "GPT-5.6 central to the app" airtight for judges. · **Open (single remaining call, low-cost)**

**D-007 · Data → SQLite (dev) → Supabase Postgres (prod), via Drizzle behind a repository interface.**
Dev: local SQLite + simple password auth + local storage (keyless, offline-dogfoodable). Prod: Supabase (Postgres + Auth + storage). Why: repository pattern makes the prod swap an env change; Supabase carries the multi-user/income seam for the post-hackathon pivot. Supersedes the PRD's open "Vercel+Neon vs local+Loom" hosting question. · **Locked**

**D-008 · Voice → PTT only; dev default = Gemini multimodal transcription.**
Adapters kept: Sarvam (Saaras v3 — best code-mixed Hinglish/Kannada for dogfooding), OpenAI/Whisper, browser Web Speech, and `fake`. Streaming/realtime is a later adapter, not a rewrite. · **Locked**

**D-009 · Vision → the selected runtime tier's multimodal (Gemini dev / GPT-5.6 demo).**
Why: no separate vision provider; meal macros + receipt read ride the same gateway. · **Locked**

**D-010 · Provider abstraction → LLM, Voice, Vision, and DB each behind an interface with a deterministic `fake` adapter.**
Why: same plug-and-play pattern top to bottom; the whole loop runs keyless for tests and offline dev. · **Locked**

**D-011 · Credits → not a blocker.**
1,250 Codex credits in hand + a $100 grant request raised. Supersedes the earlier "credit request declined / live blocker" status. · **Resolved**

**D-012 · UI system → Tailwind + shadcn/ui (Radix) + Framer Motion + lucide-react, Premium Dark.**
Why: fastest path to the PRD's Premium Dark look; Framer drives the swipe deck + inline level-up. Design tokens per PRD §17. · **Locked**

**Still open:** D-006 (demo model, decide at record time). Everything else above is locked; reopen only via an explicit new decision entry.

---

## 2026-07-15 — Design phase kickoff

**D-013 · Themes → full Slack-style: token architecture + 3 prebaked themes (Ember, Slate, Moss), each with light + dark modes.**
Why: broad-audience accessibility (light-mode users, older users) without a custom theme engine; shadcn/Tailwind makes a theme = one token file. Amends the v1 scope: prebaked themes are IN; the user-*custom* theme editor stays deferred. Details in `docs/experience/DESIGN.md` §2. · **Locked**

**D-014 · Today → plan-forward (Life Reset pattern). Re-locks the prior "hybrid plan + logged strip" decision.**
Pending challenges are the spine, Done/Skip on the next one, completed items settle in place. The raw entry feed lives inside each domain lens, not on Today. Supersedes PROJECT-SUMMARY §8/§12 "All = hybrid." Domain switcher behavior (chip swaps Today's body to the lens) unchanged. · **Locked**

**D-015 · Onboarding → deep but skippable: required core + optional detail sections.**
Core (must complete): identity + one goal per domain → spine generation. Optional sections (skippable, resumable later): body metrics, day shape, food pattern, screen time, focus, time budget, career/skills detail. MCQ-chip-first with voice option; the coach can backfill skipped sections via daily briefs. · **Locked**

**D-016 · Money v1 stays spend/expenses/budget/recurring; investing → roadmap. Settings/Profile lives behind the header avatar, not a sixth tab.**
Why: investing is a new domain concept mid-build (risk register forbids); a `Holding` seam is noted in schema comments only. Nav stays locked at five tabs. · **Locked**

**Design deliverable order (accepted):** `docs/experience/DESIGN.md` → Capture → Today → Onboarding → Coach → Stats → Journey → Tools → Lenses → Settings → `docs/experience/FLOWS.md`.

---

## 2026-07-16 — Tools re-lock

**D-017 · Tools → bento grid of AI-specialized tools. Re-locks the "one timer, lean shelf" decision (and PRD's "drop the tools clutter").**
Rationale: the reference's tools are static utilities; ours are AI surfaces that generate/measure and file — a differentiator, not a copy. Guarded by the **earning rule: every tool must write into a domain store.**
Roster: **Focus/Pomodoro** (→ Skills) · **Meditation/Breathing** (→ Habits) · **Afford-it check** (→ Money, deep tier over the ledger) · **Workout Counter** (→ Health). **2+ live at v1 on a rolling basis** (priority: Focus → Meditation → Afford-it → Counter); the rest render as coming-soon cards + a suggest-a-tool card.
Dropped/blocked: Screen Blocker (infeasible in a web app — OS hooks; native roadmap only) · Book Summary (feeds no domain) · standalone Expense Tracker (capture + Money lens IS the tracker) · Meal Planner (not selected; roadmap candidate). Imagery stays the painterly house style. Spec: `docs/screens/SCREEN-TOOLS.md` v2. · **Locked**

**D-018 · Health rings → per-metric lens-local tints (energy sage · water aqua · protein tan). Resolves the last open UI question from PROJECT-SUMMARY §10.**
Why: three same-hue rings are unreadable at a glance. Tints are lens-local tokens (`--health-water`, `--health-protein`) that never leak outside the Health lens — the global color law (domain hues + amber only) holds everywhere else. Vetoable default set in `docs/screens/SCREEN-LENSES.md` §6. · **Locked (default)**


---

## 2026-07-16 — Flows & platform

**D-019 · Delivery → installable PWA; briefs generate on-open (staleness check). Push notifications = post-hackathon.**
Why: home-screen presence for daily dogfooding without the half-day service-worker/push cost; on-open generation already matched the Coach data contract. · **Locked**

**D-020 · Mobile-first; desktop = responsive stretch. Demo records in a mobile frame.**
Why: life-app energy; the window is tight. Screen specs' desktop notes remain as guidance, not gates — screenshot-verify gates are mobile (390px) with desktop best-effort. Native/desktop apps = post-launch roadmap. Amends PRD "mobile + desktop, screenshot-verified." · **Locked**

**D-021 · Asset system → docs/experience/ASSETS.md. Life Reset's asset *philosophy* adopted (moments not icons, people over objects, one visual universe); executed in our own painterly house style — solitary figures, faces never visible.**
Why faces are excluded: batch-generation consistency (faces drift first across a 40-image library) + IP cleanliness (never described as any studio/franchise style). Single-model generation after a bake-off; one master style block; ~40 assets across 6 sets; WebP; light mode = scrim recipe, not a second library; AI tags `art_key` on generated plan items so dynamic content gets art automatically; gradient placeholders are the permanent fallback layer. Generation time-boxed to Day 4. · **Locked**

**D-022 · Asset generation inputs → global-neutral world · one recurring protagonist (fixed silhouette: short dark tousled hair, slim-athletic, 3-item wardrobe, never facing camera) · both prompt formats shipped, manual paste-blocks canonical.**
Full brief + all 40 prompts + JSON manifest live in `docs/experience/ASSETS.md` Part 2 (§8–§16). · **Locked**

---

## 2026-07-16 — Prototype review pass

**D-023 · Bone replaces Slate (themes stay at 3: Ember · Bone · Moss).**
Bone = the aa-bot editorial-minimalist system translated into Sarthi's token contract (warm-bone light / soft off-black dark, hairline borders). Adds one token to the contract: `--elev-card` (Bone sets `none`; others keep the soft shadow). Global laws (type trio, painterly art, amber discipline) apply unchanged — Bone is a skin, not a port. · **Locked**

**D-024 · Capture hero → the Capture Orb: an audio-reactive point-cloud sphere (simplex-noise shader displacement, Web Audio-driven amplitude), replacing the plain mic circle.**
Idle = near-still breathing (calm at rest); hold = voice-reactive ripple; release = thinking-settle → collapses into the pinned quote. Three.js Points, DPR≤2, paused when closed; static-orb fallback for reduced-motion/no-WebGL; capture bar keeps a static orb glyph. Spec in `docs/screens/SCREEN-CAPTURE.md` §2. · **Locked**

**D-025 · De-slop laws adopted app-wide:** card-of-cards banned (hairline-divided rows instead — aa-bot law) · gradient placeholders always carry the grain overlay · no dev-ish UI labels (mono `meal photo` tags → camera glyph) · Today's redundant tab-title merges into the scene header (title over scrim, reclaims a full row). Punch list + per-screen taste notes in `docs/experience/REFINEMENTS.md`. · **Locked**

---

## 2026-07-17 — "All out" scope session (Satvik + build session)

**D-026 · v1 scope expands → a DEPLOYED, SELLABLE product ships by Jul 21, wrapped around the uncuttable demo spine.**
Two rings: **inner ring = the demo spine** (F3 capture loop → F11 demo script) — never cut, still the hackathon rubric story. **Outer ring = the sellable wrap**: live Vercel+Supabase deploy, real multi-user auth (Supabase, per-user row scoping — supersedes "v1 ships single-user" in D-007's note), landing + pricing page, Pro flag + checkout, privacy/ToS stubs, installable PWA. The outer ring has an ordered cut-line list (docs/product/PHASES.md §3); the inner ring has none. Judges must be able to use the product without paying (seeded demo access / generous free tier). · **Locked**

**D-027 · Mobile path → decided by a research bake-off (Capacitor wrap vs React Native/Expo vs native), NOT in the hackathon window.**
v1 ships as PWA (D-019 unchanged). Cheap discipline adopted now so the bake-off winner is cheap later: `core/` stays framework-import-clean (no Next.js/React imports inside core/ business logic) — extraction into a shared package becomes mechanical. **No monorepo restructure in the window** (D-001 holds). Bake-off spec + decision matrix = an output of the Claude planning session (docs/planning/PLANNING-BRIEF.md). · **Locked**

**D-028 · Build-layer model workflow → Sol plans + reviews; Terra writes ALL code; Luna stays read-only (scout / docs-verifier / CI eval).**
Sol produces the plan for every ticket AND a formal review gate at the end of every phase before it counts as done. Terra (high effort for the moat, medium for routine) is the single writing tier — simpler burn model, one writer to review. Escalation valve: if Terra fails the same ticket twice, escalate that ticket to the `deep` (Sol) profile. Supersedes D-mix from earlier today (Sol-moat/Luna-default). · **Locked**

**D-029 · Monetization shape for v1 → freemium + a single Pro flag + one checkout price; provider (Razorpay vs Stripe vs merchant-of-record) decided in the planning session; activation paperwork starts immediately.**
Which features actually gate behind Pro = Phase-2 research (candidates: multi-profile, deeper coach tiers, unlimited captures, priority voice). v1 needs the RAIL (auth'd user → plan column → checkout → flag flips), not the full paid catalogue. Test-mode checkout is an acceptable Jul-21 fallback if provider activation lags. · **Locked (default, vetoable)**

**Still open:** D-006 (demo runtime provider, record time) · mobile bake-off winner (Phase-2, D-027) · Pro feature set (Phase-2, D-029).

---

## 2026-07-17 — Session 1 document lock resolutions

**D-030 · Capture trust boundary → auto-write only explicit proposals at confidence ≥0.90; otherwise show a confirmation card.**
Every commit is reversible only at the **single latest commit-batch** level for five minutes. An append-only `commits` record carries created/updated typed-row ids, prior snapshots, XP delta, and plan/satisfied-by side effects; undo applies one atomic compensating transaction. There is no undo-history UI in v1. Offline persistence is deferred: a failed capture stays as a retryable draft in the open sheet, never an outbox that later writes estimates unattended. Canonical integer boundaries are `amountPaise`, `millilitres`, `minutes`, and `weightGrams`; UI converts only at its edge. · **Locked**

**D-031 · Identity → AuthProvider resolves the repository-bound user identity in both tracks.**
Dev remains keyless: a local password gate resolves fixed `userId: "local-dev"` over SQLite. Prod uses Supabase Auth email/password plus reset over Postgres. The repository receives authenticated scope from the provider and applies it to every operation; callers can never submit tenant filters. Every persistent row carries `userId`, including derived and support rows. · **Locked**

**D-032 · v1 billing rail → Razorpay test mode, annual Pro at ₹499/year (`49900` paise), with no v1 feature gate.**
The pricing page ships before billing. A Razorpay checkout is the last Phase-1 ticket; the predeclared Jul 20 evening checkpoint switches CTA to waitlist capture if it does not fit. The full `plan` column + idempotent webhook contract is specified now so the payment-link fallback is a drop-in swap later. Free users retain the full v1 experience. · **Locked**

**D-033 · Judge/demo access → authenticated, opt-in 12-day demo seed.**
After signup, “Try the 12-day demo” clones typed seed rows only into that authenticated user, once and idempotently. Seeded users remain free and nothing on the F3/F11 demo path is paywalled. Hidden gestures are recording convenience only, never the judge-access mechanism. · **Locked**

**D-034 · Screenshot verification → mobile is the visual-fidelity gate; desktop is a required responsive smoke screenshot.**
This amends D-020’s ambiguous “desktop stretch” wording without making desktop art-polish equal to the 390px acceptance bar. Every changed screen/state still captures both sizes; mobile fixes block the ticket, desktop failures block only correctness/regression issues. · **Locked**

**D-035 · Execution cadence → dependency and acceptance gates, never elapsed-day checkpoints.**
Work starts as soon as its predecessors satisfy their ticket acceptance, and a completed slice never waits for a scheduled day. F3, fan-out, Phase-1 slices, cut lines, and phase review are triggered by the required evidence in `docs/planning/TICKETS.md` and `docs/product/PHASES.md`, not by a morning/evening/day-number checkpoint. The external Jul 21 submission deadline remains fixed. A cut line fires only when its full acceptance cannot be proven without blocking a higher-priority required gate; the documented fallback then becomes the accepted slice. This supersedes the date-driven execution triggers in D-002 and D-032, without changing their scope or the final deadline. · **Locked**

**D-036 · AI SDK package line → align all runtime adapters on AI SDK 7.**
Pin `ai@7.0.28`, `@ai-sdk/google@4.0.16`, `@ai-sdk/openai@4.0.15`, and `@ai-sdk/anthropic@4.0.15`; the current `zod@4.1.13` and Node 22 satisfy their shared contracts. This replaces the incompatible `@ai-sdk/openai@2.0.24` pin, which belongs to the AI SDK 5 provider contract and cannot share a typed gateway with the Google/Anthropic pins. Runtime model IDs and the provider-blind port remain unchanged. `generateObject` remains available in AI SDK 7 for the locked capture pipeline, though the later migration path is `generateText` with `Output.object`. Verified against [OpenAI provider metadata](https://registry.npmjs.org/%40ai-sdk/openai/4.0.15) and [AI core metadata](https://registry.npmjs.org/ai/7.0.28). · **Locked**

---

## 2026-07-17 — SAR-003 build decisions

**D-037 · Database driver line → SQLite dev/CI via `@libsql/client`; Postgres prod via `postgres-js`; one async repository over both.**
Pin `@libsql/client@0.17.4` and `postgres@3.4.9` against `drizzle-orm@0.44.7` on Node 22. `@libsql/client` provides async transactions matching `postgres-js`, so a single async `RepositoryFactory` runs over both dialects (no divergent per-dialect implementation). SQLite is the migration source (`drizzle.config` points at `data/schema/sqlite.ts` only, so drizzle-kit does not read the `pgTable` file); the Postgres dialect declares composition-ready and is verified by a dual-dialect parity test, with the live Postgres migration/connection deferred to `SAR-021`. §4.1's enum unions and Zod support shapes stay in the drizzle-free `data/schema/contract.ts` (kept literal, per Satvik's call — no deviation); `core/` imports only its type-only DTOs. Referential integrity is application-level via the typed repositories — no database foreign-key constraints in v1 (revisit at `SAR-021`). · **Locked**

---

## 2026-07-17 — SAR-004 build decisions

**D-038 · Capture contract split + commit-envelope state machine + single-flight commit.**
Three locked shapes for the capture moat: (1) **Draft-permissive / resolved-strict** — the deep-tier `CaptureDraft` permits `null` only where a quantity is explicitly mentioned but unknown (specifically `water.millilitres`, so the canonical "drank a bottle" fixture validates); the commit-input `ResolvedProposal` is strict (non-null primary quantities, name→entity ids present), so a null quantity can never reach a repository and invariant #1 holds by construction. This reconciles a literal reading of ARCHITECTURE §5 (`payload:{millilitres:number}`) with the shipped fixture. (2) **Commit-envelope state machine** — `commits.status` moves `committed → undone | superseded` via exactly two guarded transitions (`markUndone`/`markSuperseded`); this is the ONLY mutation the append-only audit group permits (payload columns and the true ledgers `commit_rows`/effect tables stay immutable). `domain_progress` is a persistent singleton restored on undo via its `commit_rows` snapshot, never soft-deleted (which would collide with its unique `(userId,domain)`). (3) **Single-flight commit** — `CommitService` serializes `commit`/`undoLatest` per `forUser` scope (promise-chain mutex), so `repos.transaction`'s executor swap is never re-entered; the DB unique `(userId,idempotencyKey)` is the cross-process backstop. `AUTO_WRITE_CONFIDENCE_BPS = 9000` lives in exactly one file (`core/capture/route.ts`). · **Locked**

---

## 2026-07-18 — SAR-005 build decisions

**D-039 · Framework-clean Today read-model + server-only composition accessor (the UI↔repository wire).**
Two locked patterns for the presentation layer. (1) **Pure read-models in `core/domains/`** — the Today spine's grouping / stat-cluster / provenance logic is a pure, deterministic, framework-and-DB-import-free function (`buildTodayView`), unit-tested and boundary-clean (invariant #9), so the mobile bake-off winner (D-027) inherits it mechanically; the Server Component only reads repositories and calls it — no logic in the view. (2) **The composition accessor** (`app/lib/session.ts`, `server-only`) is the single wire from the SAR-003 auth + repository layers to any UI read: `requireUser() → factory.forUser(user) → repos`, the factory memoised per-url at module level (one shared connection per server instance), never exposing or accepting a client `userId` (SAR-003 scoping holds; a foreign id fails closed). **Tokens-only UI (invariant #4)** is enforced via a Tailwind `@theme` layer over six `[data-theme][data-mode]` blocks with a CI parity guard (`tests/tokens.test.ts`); `--energy` amber renders only on the XP/streak/level stat cluster; fonts are self-hosted via `next/font` (Sora stands in for Clash Display, self-host deferred). **Recorded cuts (thin spine, not drift):** the Today header ships plain (time-of-day scene + collapse-on-scroll deferred), and satisfied-by rows plus the `rest` / arc-complete day-states are deferred until the data signals exist (SAR-006/009). **Carried to SAR-006:** the day boundary is UTC for now (the timezone-aware `localDate` belongs at the capture edge). · **Locked**

---

## 2026-07-18 — SAR-006 build decisions

**D-040 · Capture-sheet transport + the "server re-routes the auto batch" trust seam.**
The capture sheet reaches the SAR-004 pipeline through Next route handlers (`app/api/capture/{parse,commit,undo}` per ARCHITECTURE §1.1 — no deviation, OQ-1). The client holds the deck as React state and runs ONLY the pure routing helpers (`routeDraft`/`applyUserEdit`/`isAcceptAllEligible`) client-side; parse/commit/undo are the only server round-trips, and the capture logic stays in `core/capture` (framework-clean, portable — the mobile/external client D-027 hits the same HTTP surface). **The trust-critical rule:** `/api/capture/commit` takes `mode: 'auto' | 'accept'`, and in `auto` mode the server **re-routes every proposal** (`routeProposal`) and refuses any that is not intrinsically auto — the client's "this is auto" claim is re-verified server-side, never trusted, so no estimated / low-confidence / unknown-quantity value can be silently written even by a buggy or hostile client (defense in depth for invariant #1). The commit resolves auto-batch rows with the in-memory `status:'auto'` and accepted-card rows with `status:'accepted'` (`ResolvedProposal.status`) — but **that field is a validation-layer signal and is NOT persisted to a domain row** (corrected 2026-07-18, SAR-007): the typed tables carry `estimated`/`source`/`confidenceBps`, and the only durable auto-vs-accepted marker is the commit **envelope** (`commits.kind` — `'capture'` = auto-batch vs `'tap'/'edit'` = accepted, joinable via `commit_rows`). SAR-007's `wrongSilentWrites` eval therefore reads the persisted `estimated` column + each fixture's expected-auto allowlist, not a row `status`. The "filed automatically" strip renders ONLY rows that actually committed; anything the server refuses re-decks as a question card — ask-don't-invent holds in the UI, not just the store. · **Locked**

---

## 2026-07-18 — SAR visual-verification gate

**D-041 · Visual screenshot-verify is a real SAR completion gate (Playwright + Sol design review).**
A ticket with a screen/state is not "complete" until its built surfaces are screenshot-verified against the design law — not just functionally green. The loop: `pnpm screenshots` (Playwright + headless Chromium, `scripts/screenshot.mjs`) captures each built state at **390px (the fidelity gate) + desktop** × the required theme-modes (Ember Dark + Light per state; Bone/Moss for tint-sensitive lens elements) into `.verify/screens/<screen>-<state>-<width>-<theme>.png` (git-tracked evidence) → **Sol (the `reviewer` agent) design-reviews the RENDERED shots** against `DESIGN.md` §§1/4/9 + the de-slop §11 and proposes ranked fixes → the fixes land → re-shoot until the checklist passes. Per D-034: mobile 390px deviations block; desktop deviations block only correctness/regression. Applies to SAR-008+ going forward; it retroactively closed SAR-005/006/007's deferred visual DoD (38 built-surface shots + a Sol review, 5 mobile-blocking + several polish fixes landed). **Design-law refinements folded back this pass:** amber (`--energy`) is reserved even more strictly — the arc **day-counter** and any **zero/base stat** (streak 0, level 1) render neutral (`--ink-2`/`--ink-3`), amber only when EARNED; the two capture confirm zones are made *categorically* different (flat hairline "filed automatically" rows vs. the single raised estimate card); the done state shows a "Confirmed by you" ledger so accepted estimates never vanish; Health-lens ring tints are slate-teal water (`--health-water` #6f9fae dark / #3f7e93 light) + clay protein (`--health-protein` #a8815c / #8a6238), moved per-mode for AA and pulled clear of `--energy`/`--dom-money` gold. · **Locked**

---

## 2026-07-18 — Money ledger lens (SAR-008)

**D-042 · The Money lens is a read-only derived view; safe-to-spend is a pinned glass-box model.**
SAR-008 renders the Money domain (`transactions` + `money_categories` + `budgets` + recurring rules — all already typed and capture-written) as a pure in-memory read-model (`core/domains/money.ts` `buildMoneyView`), **integer paise end-to-end, no float** (only a display `formatPaise` divmod). **Safe-to-spend** is defined — since no account/balance table exists — as **balance (this month's net: credits − debits to date) − remaining-budgeted (Σ `max(0, limit − spent)` over budgets covering today) − upcoming-recurring (unpaused debit rules with `nextPostDate` in `(today, monthEnd]`, deduped against categories that already carry a budget so nothing is double-counted)**; the three terms surface glass-box in a tap-to-open math sheet and negatives render honestly in plain ink. Budget-bar spent is computed once per budget period and reused for both the bar and the safe-to-spend term so they cannot diverge; a nullable `categoryId` buckets into an explicit "Uncategorized" group. **Scope (read-only lens + drills):** grouped ledger, safe-to-spend, token-status budget bars (fill turns `--warn` above 90%, `--danger` when over), recurring shelf, category drill (push/return). **Deferred to their own tickets (NOT built here):** the leak-strip daily AI insight, a per-lens coach-read line (the Health lens lacks one too — a later consistency pass), and any interactive est-chip / edit affordance — the glass-box `~` tilde on estimates stays, matching the Health lens + D-041. **Token retune (folded into DESIGN.md §4):** dark-mode `--dom-money` deepened `#d8a24a → #c0883a` (bronze, pulled clear of `--energy` amber per the D-041 discipline) and dark-mode `--warn` set `#d8a24a → #e6972e` (a distinct caution amber, so a 95% bar reads differently from a 78% bar); light blocks unchanged. The lens's long content clears the fixed capture bar via an opaque backdrop behind the launcher (no more ghost-through). · **Locked**

---

## 2026-07-18 — Habits satisfied-by grid (SAR-009)

**D-043 · The Habits lens is a read-model + a single guarded manual-tick; satisfied-by is refusal, not a toggle.**
SAR-009 renders Habits (`habits` + `habit_logs` + `habit_satisfaction_rules`, all typed + capture-written) as a pure read-model (`core/domains/habits.ts` `buildHabitsView`) + lens, with grace-aware streaks that REUSE the `core/game/streak.ts` kernel — the private `GRACE_DAYS` was lifted from `core/capture/commit.ts` into `core/game/streak.ts` as a shared export (behaviour-identical; the F3 eval stays green). **The boundary invariant (enforced in the UI AND server-side):** a habit with an active `habit_satisfaction_rules` row is **satisfied-by** — it renders NO tick, refuses manual completion (tap → one wiggle + the rule hint; long-press → sticky hint; `aria-describedby`), and its "done" can come ONLY from the capture pipeline's materialized `source:"satisfied-by"` log; a rule-free habit renders a real tick that writes a `source:"manual"` log **in place** via a thin `setHabitCompletion` server action (mirroring the Today Done/Skip precedent — no XP/progress/undo envelope, the commit service stays the sole game-effect writer; the action refuses rule-bearing habits and no-ops unknown ids). Row grammar is identical to the Health lens (shared P3a); the satisfied-by badge is a token-coloured lucide `Zap` (never a gold emoji). **Recorded deviations (accepted this pass):** the satisfied-by demo habit ("Water", target set to its `≥ 2000 ml` rule for glass-box coherence) lives in `scripts/seed-dev.ts` only, NOT `data/seed/canonical.ts` — the F3 eval is green without it, so the canonical edit is deferred (the demo/judge seed carries it; the eval doesn't need it); the interaction timers (long-press 500 ms, hint-dismiss 900 ms) stay JS constants (behavioural, not style tokens). Follow-ups noted: align the Health water ring target to the 2000 ml goalpost; an a11y assertion for the 44px tick + heatmap-dot day labels. · **Locked**

---

## 2026-07-18 — Skills mastery lens (SAR-010)

**D-044 · The Skills lens is a read-only mastery/curriculum view; mastery is summed session minutes.**
SAR-010 renders Skills (`skills` + `skill_sessions` + `skill_milestones`, typed + capture-written) as a pure read-model (`core/domains/skills.ts` `buildSkillsView`) + lens. **Mastery per skill = the in-memory SUM of that skill's `skill_sessions.minutes`** (integer minutes, hours only via a display divmod; NOT `domain_progress.cumulativeMinutes`, which is per-domain — proven cross-isolated by test). The **mastery counter is the unmistakable hero** in the track drill (large violet `--dom-skills`, e.g. `128:30`), with 10/100/500h tier treatments display-only; a lens-local milestone drill pushes/returns (the Money category-drill pattern) over the curriculum (token-coloured lucide ✓/▸/○ glyphs — never emoji) + a realistic session log. Read-only: no milestone toggle, session edit, new-skill create, or timer. **DEFERRED to their own tickets (recorded):** the deep-tier `generate_roadmap` AI (new-skill / regenerate), the mastery counter live-ticking against the Tools Focus timer (the `HH:MM:SS` form waits for it — the hero shows `HH:MM` now, not a frozen `:00`), a per-lens coach-read line (all four lenses lack one — a later consistency pass), the `+ new skill` affordance + a confidence chip on estimates (the `~` tilde stays), and the empty-invite state (unshootable — `seedCanonicalEntities` always creates one skill, load-bearing for the `ambiguous-skill` eval fixture; the invite path is unit-tested). Retires the last Today placeholder — **all four domain lenses are now real**. · **Locked**
