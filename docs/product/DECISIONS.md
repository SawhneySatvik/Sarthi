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
