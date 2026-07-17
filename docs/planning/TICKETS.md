# TICKETS.md — Approved Phase-0/1 Build Register

| | |
|---|---|
| **Status** | Stage 4 locked by Satvik on 2026-07-17 |
| **Authority** | Derived from `docs/architecture/ARCHITECTURE.md`, `docs/product/PHASES.md`, and `docs/experience/DESIGN-PROMPTS.md` |
| **Build rule** | Sol plans and reviews; the named Terra role writes. No ticket starts without its own approved `.codex/plan.md`. |
| **Dependency rule** | Ticket IDs are dependency order. Tickets may run in parallel only when their `Depends` list permits it. |

## 1. Work order and non-negotiable gates

| Gate | Demo-spine lane | Sellable-wrap lane | Acceptance decision |
|---|---|---|---|
| Foundation → F3 | `SAR-001`–`SAR-007`: scaffold through F3 | Provision-only credentials, no billing build | F3 must be green keylessly before fan-out or non-provisioning outer-ring work begins. |
| F3 → fan-out | `SAR-008`–`SAR-014`: typed fan-out, vision, onboarding, voice, coach/game | `SAR-021`: production auth and tenant boundary may begin once its own dependencies pass | Money reduces to its light-ledger fallback only if its full acceptance blocks a required higher-priority gate. |
| Complete journeys | `SAR-015`–`SAR-019`: supporting UI, integration, visual proof | `SAR-022`–`SAR-024`: live deploy, landing/pricing, legal/PWA, judge seed | A public URL must run the authenticated loop before the Phase-1 journey can be reviewed. |
| F11 and sellable proof | `SAR-020`: eval report and F11 dry-run | `SAR-025`: billing rail last | If the billing rail cannot prove signed webhook/replay acceptance, switch its CTA to waitlist; do not delay the demo spine. |
| Final review | F11 evidence complete | stranger-journey evidence complete | Sol phase review passes before the fixed external submission deadline. |

- **Inner-ring rule:** `SAR-001`–`SAR-020` implement Phase 0; none are scope cuts.
- **Outer-ring rule:** `SAR-021`–`SAR-025` implement Phase 1. Only the documented cut lines apply.
- **Ticket acceptance convention:** quoted `Accept when` lines below are transferred verbatim from the named screen/prototype specification. Architecture acceptance is transferred from the signed contract where no screen list exists.

## 2. Foundation and F3 gate

### SAR-001 — Scaffold and import boundary

- **Agent:** `pipeline` (Terra) · **Size:** M · **Depends:** —
- **Docs:** `AGENTS.md` §§2–4 · `docs/architecture/ARCHITECTURE.md` §§1, 9 · `docs/architecture/TECH-STACK.md` §§2–3
- **Acceptance:**
  - Create the App Router/TypeScript/Tailwind/Drizzle/shadcn project skeleton at the signed module layout.
  - Add `pnpm check:core-boundary` and CI wiring; it rejects forbidden imports from `core/` exactly as §1 specifies.
  - Add typed env parsing for the signed provider, auth, database, billing, and judge-mode selectors; defaults select the keyless fake/local track.
  - No app or business code bypasses `core/contracts`; no component hardcodes a design token value.
- **Moves:** architecture gate 1; no flow gate yet.

### SAR-002 — Provider ports and deterministic fake stack

- **Agent:** `pipeline` (Terra) · **Size:** L · **Depends:** `SAR-001`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§2, 2.1, 9 · `docs/architecture/TECH-STACK.md` §§1, 3 · `AGENTS.md` §§1–2
- **Acceptance:**
  - Implement the signed `LlmGateway`, `VoiceProvider`, and `VisionProvider` ports and `(provider, tier) → model` matrix without placing a provider import in `core/`.
  - Implement `FakeLlmGateway`, `FakeVoiceProvider`, and `FakeVisionProvider` with versioned canonical capture, coach, meal, and receipt fixtures; they read no API keys.
  - Pin and expose only the verified Google and OpenAI model IDs; Anthropic remains adapter-wired and disabled pending account verification.
  - Fake voice returns the canonical transcript; fake vision returns deterministic meal/receipt results; the whole adapter set is callable with no network.
- **Moves:** prerequisites for F3 and fake-stack eval fixtures `canonical-cross-domain`, `estimated-meal-photo`, and `receipt-batch`.

### SAR-003 — Dialect schema and bound repository factory

- **Agent:** `pipeline` (Terra) · **Size:** XL · **Depends:** `SAR-001`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§3–4, 9 · `docs/product/DECISIONS.md` D-030–D-033 · `AGENTS.md` §2
- **Acceptance:**
  - Implement all signed SQLite and Postgres Drizzle declarations, constraints, indexes, migrations, and Zod support shapes; every persistent user row has non-null `userId`.
  - Implement `RepositoryFactory.forUser()` and concrete typed repositories; no repository method accepts caller-supplied `userId`, arbitrary SQL, or a tenant filter.
  - Implement `LocalPasswordAuthProvider` returning `local-dev` and SQLite wiring so dev/CI never requires Supabase.
  - Provide transactional commit/rollback capability and migration smoke coverage for SQLite; keep the equivalent Postgres path composition-ready.
- **Moves:** architecture gate 1; eval fixture `tenant-isolation` becomes testable once production auth lands.

### SAR-004 — Capture routing, typed commit, XP, and undo core

- **Agent:** `pipeline` (Terra) · **Size:** XL · **Depends:** `SAR-002`, `SAR-003`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§5–6, 9 · `docs/product/DECISIONS.md` D-030 · `docs/experience/FLOWS.md` F3–F4 · `AGENTS.md` §2
- **Acceptance:**
  - Implement the versioned discriminated `CaptureDraft`/`Proposal` Zod contract and route policy owned only by `core/capture/route.ts`.
  - Auto-file only `intent === 'create'`, `estimated === false`, `confidenceBps >= 9000`, fully valid integer payloads, and no unanswered clarification; every other proposal is pending.
  - Dispatch accepted proposals through an exhaustive typed per-domain switch; never persist a generic proposal payload or table name.
  - Write one append-only commit batch with typed rows, snapshots, XP, plan/satisfied-by effects, idempotency, and a five-minute latest-batch undo that reverses all recorded side effects atomically.
- **Moves:** F3 safety invariant; eval fixtures `explicit-low-confidence`, `ambiguous-skill`, `correction-existing-entry`, `backdate-habit`, `undo-batch`, and `provider-failure`.

### SAR-005 — Token shell and thin Today spine

- **Agent:** `screens` (Terra) · **Size:** L · **Depends:** `SAR-001`, `SAR-003`
- **Docs:** `docs/experience/DESIGN.md` §§2–7 · `docs/experience/DESIGN-PROMPTS.md` P0, P2 · `docs/screens/SCREEN-TODAY.md` · `docs/experience/FLOWS.md` F2–F3
- **Acceptance (verbatim P0):** “switching the pill restyles the entire shell live in all 6 theme-modes with AA-readable text; nav+capture bar match docs/experience/DESIGN.md §6; nothing hardcodes a color.”
- **Acceptance (verbatim P2):** “only one card ever shows buttons; Done/Skip choreography matches; completed cluster reads calm; switcher swaps bodies; header collapses on scroll.”
- **Additional F3 scope:** bind the global bar and Today `via capture`/satisfied-by display to typed read DTOs; unused lens bodies may remain labeled placeholders until their domain ticket.
- **Moves:** F2 visual prerequisite and F3 final state.

### SAR-006 — Health vertical slice and capture-sheet hero

- **Agent:** `pipeline` (Terra) · **Size:** XL · **Depends:** `SAR-004`, `SAR-005`
- **Docs:** `docs/screens/SCREEN-CAPTURE.md` · `docs/screens/SCREEN-LENSES.md` §§2, 7 · `docs/experience/DESIGN-PROMPTS.md` P1, P3a · `docs/experience/FLOWS.md` F3–F4 · `docs/architecture/ARCHITECTURE.md` §5
- **Acceptance (verbatim P1):** “the two confirm zones are unmistakably different at a glance; all four gestures work; the question card blocks nothing else; level-up is inline and brief; the whole loop runs on mock data end-to-end.”
- **Shared P3a completion criterion:** once `SAR-006` and `SAR-009` both land, “rings are glanceable as three distinct metrics; the satisfied-by row visibly refuses manual ticks; row grammar is identical across both lenses.”
- **Additional F3 scope:** wire actual fake parse results, auto-file strip, pending deck, edit/discard/domain flip/why, Health typed writes, XP, five-minute undo, fan-out, and Today’s matching item check through the real commit service.
- **Moves:** F3 implementation; fake fixtures `canonical-cross-domain`, `estimated-meal-photo`, and `undo-batch`.

### SAR-007 — F3 fake-stack integration evaluation

- **Agent:** `test-eval` (Terra) · **Size:** M · **Depends:** `SAR-002`–`SAR-006`
- **Docs:** `docs/experience/FLOWS.md` F3 · `docs/architecture/ARCHITECTURE.md` §§8–9 · `AGENTS.md` §3
- **Acceptance:**
  - Add deterministic, keyless tests for F3’s canonical dump: high-confidence explicit typed rows auto-file; estimates/question-dependent proposals do not write until accepted; accepted Health card writes correctly; undo reverses rows/XP/plan effects.
  - Cover `canonical-cross-domain`, `estimated-meal-photo`, `ambiguous-skill`, and `undo-batch` exactly as architecture gate 3 requires.
  - Make `wrongSilentWrites === 0` a hard assertion and save mobile/desktop F3 state screenshots to `.verify/screens/`.
  - Tests and eval code only; do not edit production modules.
- **Moves:** **F3 GATE — must pass before fan-out or non-provisioning Phase-1 work begins.** If it fails, stop that downstream work and finish F3; no cut line fires merely because time elapsed.

## 3. Demo-spine fan-out and experience

### SAR-008 — Money typed store and ledger lens

- **Agent:** `pipeline` (Terra) · **Size:** L · **Depends:** `SAR-007`
- **Docs:** `docs/screens/SCREEN-LENSES.md` §§1, 7 · `docs/experience/DESIGN-PROMPTS.md` P3b · `docs/architecture/ARCHITECTURE.md` §§4–5 · `docs/experience/FLOWS.md` F3, F5, F8
- **Money scope:** implement the P3b ledger, budgets, recurring shelf, safe-to-spend math, and category drill with typed transaction/budget/recurring-rule repositories and no money float.
- **Shared P3b completion criterion:** once `SAR-008` and `SAR-010` both land, “safe-to-spend math sheet works; drills push and return cleanly; the mastery counter is the unmistakable hero of the Skills drill.”
- **Moves:** Money portion of F3/F5/F8; `receipt-batch` fixture.
- **Cut line:** **#3.** If this ticket threatens F11, retain typed transactions, grouped list, and safe-to-spend summary; defer category-drill polish only.

### SAR-009 — Habits typed store and satisfied-by grid

- **Agent:** `pipeline` (Terra) · **Size:** M · **Depends:** `SAR-007`
- **Docs:** `docs/screens/SCREEN-LENSES.md` §§3, 7 · `docs/experience/DESIGN-PROMPTS.md` P3a · `docs/architecture/ARCHITECTURE.md` §§4–6 · `docs/experience/FLOWS.md` F2, F4, F8
- **Habits scope:** apply the Habits half of P3a: typed habit logs, grace-aware streak calculation, heatmap, and deterministic satisfied-by rules driven only by committed source rows.
- **Shared P3a completion criterion:** once `SAR-006` and `SAR-009` both land, “rings are glanceable as three distinct metrics; the satisfied-by row visibly refuses manual ticks; row grammar is identical across both lenses.”
- **Moves:** F2 auto-completion, F4 backdate, and Meditation’s eventual typed habit write.

### SAR-010 — Skills typed store and curriculum lens

- **Agent:** `pipeline` (Terra) · **Size:** M · **Depends:** `SAR-007`
- **Docs:** `docs/screens/SCREEN-LENSES.md` §§4, 7 · `docs/experience/DESIGN-PROMPTS.md` P3b · `docs/architecture/ARCHITECTURE.md` §§4–6 · `docs/experience/FLOWS.md` F3, F8
- **Skills scope:** apply the Skills half of P3b: typed sessions, integer minutes, curriculum milestones, drill navigation, and no invented skill when the capture proposal requires clarification.
- **Shared P3b completion criterion:** once `SAR-008` and `SAR-010` both land, “safe-to-spend math sheet works; drills push and return cleanly; the mastery counter is the unmistakable hero of the Skills drill.”
- **Moves:** Skills portion of F3 and F8; `timer-session` fixture.

### SAR-011 — Meal/receipt vision path

- **Agent:** `pipeline` (Terra) · **Size:** M · **Depends:** `SAR-006`, `SAR-008`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§2, 5, 8 · `docs/screens/SCREEN-CAPTURE.md` §§2, 7 · `docs/experience/FLOWS.md` F5
- **Acceptance:**
  - Camera image input reaches only the signed VisionProvider adapter and returns the capture union through the same route-by-confidence service.
  - Photo-derived food values are always pending estimate cards; receipt transactions are pending until explicit `Accept all` eligibility/action.
  - F5’s receipt batch writes typed Money rows once, never duplicates on retry, and saves no generic parsed blob.
- **Moves:** F5; `estimated-meal-photo` and `receipt-batch` fixtures.

### SAR-012 — Onboarding and real plan creation

- **Agent:** `screens` (Terra) · **Size:** L · **Depends:** `SAR-003`, `SAR-010`
- **Docs:** `docs/screens/SCREEN-ONBOARDING.md` · `docs/experience/DESIGN-PROMPTS.md` P4 · `docs/experience/FLOWS.md` F1 · `docs/architecture/ARCHITECTURE.md` §§3–4
- **Acceptance (verbatim P4):** “core feels ~2 min; skipping detail feels safe (hairline already full); the confirm cards clearly derive from the answers; theme step actually switches tokens.”
- **Additional data scope:** no persistence before the Phase-D confirmation; one accepted transaction creates the profile, profile gaps, plan arcs/items, and Day-1 snapshots through scoped typed repositories.
- **Moves:** F1 and production new-account path.

### SAR-013 — Voice PTT and transcript safety

- **Agent:** `pipeline` (Terra) · **Size:** M · **Depends:** `SAR-002`, `SAR-006`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§2, 5 · `docs/screens/SCREEN-CAPTURE.md` §§2, 7, 10 · `docs/experience/FLOWS.md` F3 · `docs/architecture/TECH-STACK.md` §3
- **Acceptance:**
  - Press-and-hold/tap-to-talk records bounded audio and sends it only through `VoiceProvider`; fake remains deterministic and keyless.
  - Enforce the signed 30-second Sarvam REST limit before upload; provider/network failure leaves a retryable open draft and writes no outbox or typed row.
  - The transcript remains visibly pinned before parse, and text capture follows the exact same routing/commit path.
- **Moves:** live F3 voice input; `provider-failure` fixture.

### SAR-014 — Coach engine, adaptations, and game mechanics

- **Agent:** `pipeline` (Terra) · **Size:** XL · **Depends:** `SAR-008`–`SAR-010`, `SAR-012`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§4, 6, 8–9 · `docs/screens/SCREEN-COACH.md` · `docs/experience/FLOWS.md` F2, F6, F7, F9
- **Acceptance:**
  - Implement exactly four `DomainSpec` registry entries and one CoachEngine; no domain-specific orchestrators.
  - Generate fast capture lines and deep daily/weekly notes via the signed staleness/evidence contract; fake fixtures remain deterministic.
  - Coach proposals create visible `adaptations` in `proposed`; only `Keep` mutates a plan via CommitService, and `Revert` preserves the plan.
  - Deterministically calculate XP, levels, streaks, mastery, plan effects, re-entry lightening, and evidence counts from typed rows.
- **Moves:** F2/F6/F7/F9 and `adaptationSanityRate`.

### SAR-015 — Coach reading room and Stats/Journey views

- **Agent:** `screens` (Terra) · **Size:** L · **Depends:** `SAR-014`
- **Docs:** `docs/screens/SCREEN-COACH.md` · `docs/screens/SCREEN-STATS.md` · `docs/screens/SCREEN-JOURNEY.md` · `docs/experience/DESIGN-PROMPTS.md` P5–P7 · `docs/experience/FLOWS.md` F6–F7, F9–F11
- **Acceptance (verbatim P5):** “it reads like a page (measure ~620px feel, generous leading); the adaptation sheet shows its work; the weekly card is clearly the richest object.”
- **Acceptance (verbatim P6):** “collectible-but-calm (sheen subtle); projections can't be mistaken for real numbers; the flip feels like turning a card.”
- **Acceptance (verbatim P7):** “it scrolls like a memory, not a log; milestones punctuate; the rail stays continuous.”
- **Moves:** F6/F7/F9 and F11 shots 6–8, 10.

### SAR-016 — Tools: Focus and Meditation loops

- **Agent:** `screens` (Terra) · **Size:** L · **Depends:** `SAR-009`, `SAR-010`, `SAR-014`
- **Docs:** `docs/screens/SCREEN-TOOLS.md` · `docs/experience/DESIGN-PROMPTS.md` P8 · `docs/experience/FLOWS.md` F8 · `docs/architecture/ARCHITECTURE.md` §§5, 8
- **Acceptance (verbatim P8):** “the grid looks full but calm; both live tools run their loop; domain ticks make the earning rule visible.”
- **Additional data scope:** timer completion is an explicit, idempotent typed commit with undo; Meditation asks consent before its habit write; no “soon” tool creates a row.
- **Moves:** F8 and `timer-session` fixture.

### SAR-017 — Settings and authorised provider override

- **Agent:** `screens` (Terra) · **Size:** M · **Depends:** `SAR-002`, `SAR-012`, `SAR-014`
- **Docs:** `docs/screens/SCREEN-SETTINGS.md` · `docs/experience/DESIGN-PROMPTS.md` P9 · `docs/experience/FLOWS.md` F10–F11 · `docs/architecture/ARCHITECTURE.md` §§2, 7
- **Acceptance (verbatim P9):** “theme preview cards are real token renders; the provider row exists (the live-demo moment); danger zone can't be hit accidentally.”
- **Additional safety scope:** provider flip is available only in dev or a separately configured judge environment; production has no gesture or client-settable environment selector.
- **Moves:** F10 and F11 shot 9.

### SAR-018 — Flow stitch and domain-complete integration

- **Agent:** `pipeline` (Terra) · **Size:** L · **Depends:** `SAR-008`–`SAR-017`
- **Docs:** `docs/experience/FLOWS.md` F2–F11 · `docs/experience/DESIGN-PROMPTS.md` P10 · `docs/architecture/ARCHITECTURE.md` §§5–6
- **Acceptance (verbatim P10):** “the F11 shot list can be performed in the prototype without a dead end.”
- **Additional production scope:** run each journey against real scoped repositories/fake providers, repair only integration seams, and preserve the one rich capture write path.
- **Moves:** F2/F4–F11 integration gate.

### SAR-019 — Token sweep and screenshot verification

- **Agent:** `screens` (Terra) · **Size:** M · **Depends:** `SAR-018`
- **Docs:** `docs/experience/DESIGN.md` · all `docs/screens/SCREEN-*.md` screenshot checklists · `docs/experience/DESIGN-PROMPTS.md` P11 · `AGENTS.md` §3
- **Acceptance (verbatim P11):** “Sweep every screen in all SIX theme-modes (Ember/Bone/Moss × light/dark): fix contrast to AA (use the -strong domain variants on light), tune the Bone/Moss surface values where they feel off, verify amber discipline (nothing amber that isn't XP/streak/level), verify shimmer-not-spinner everywhere, verify the coach never speaks outside Fraunces.”
- **Additional proof:** screenshot every state at 390px and its responsive desktop smoke state; save evidence to `.verify/screens/`.
- **Moves:** screenshot-verify gate and F11 visual readiness. Generated art stays gradients + grain if cut line #4 fires.

### SAR-020 — Eval report and F11 dry-run evidence

- **Agent:** `test-eval` (Terra) · **Size:** L · **Depends:** `SAR-007`, `SAR-018`, `SAR-019`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §§8–9 · `docs/experience/FLOWS.md` F11 · `docs/product/PHASES.md` Phase 0 · `AGENTS.md` §3
- **Acceptance:**
  - Implement all signed fixtures and `EvalReport` metrics; fake baseline is mandatory and network-free, while live A/B fields remain nullable without keys.
  - Assert hard-zero wrong silent writes and report parse/routing accuracy, estimate MAE, state match, adaptation sanity, latency, and cost shape exactly as §8 defines.
  - Run a keyless F11 rehearsal on fake, record pass/fail evidence for every shot, and do not alter production modules.
- **Moves:** Phase-0 F11 dry-run and eval-first definition of done.

## 4. Phase-1 sellable wrap

### SAR-021 — Production auth, Postgres, and tenant isolation

- **Agent:** `ship` (Terra) · **Size:** XL · **Depends:** `SAR-003`, `SAR-012`, `SAR-007`
- **Docs:** `docs/screens/SCREEN-AUTH.md` · `docs/architecture/ARCHITECTURE.md` §§3–4, 7, 9 · `docs/product/DECISIONS.md` D-031 · `docs/product/PHASES.md` §1.2
- **Acceptance (transferred from the auth screen):** `/signup` creates an account then opens Onboarding A; `/login` opens Today for a returning user; `/reset-password` shows a quiet sent confirmation; reset callback saves the new password then opens login.
- **Safety acceptance (transferred from the auth screen):** “Account-enumeration-safe reset confirmation always says that a reset link was sent if the address is eligible.” “Inputs and primary actions meet the 44px target; full keyboard path and password-manager support are required.”
- **Verification:** Signup · login · inline invalid-credential state · reset request · reset-sent confirmation · password-save state · completed-onboarding redirect · incomplete-onboarding resume — at 390px and desktop smoke, Ember Dark and Ember Light.
- **Additional tenancy scope:** wire Supabase Auth + Postgres through the identical scoped repository factory; prove user A cannot read, mutate, export, seed, or undo user B data. Preserve `local-dev` SQLite/password-gate fake stack untouched.
- **Moves:** Phase-1 auth gate, `tenant-isolation`, and F1 production start.

### SAR-022 — Live Vercel/Supabase deployment

- **Agent:** `ship` (Terra) · **Size:** M · **Depends:** `SAR-021`
- **Docs:** `docs/product/PHASES.md` §1.1, work order · `docs/architecture/ARCHITECTURE.md` §§2–3, 9 · `docs/operations/README-CODEX-SETUP.md`
- **Acceptance:**
  - Deploy one public Vercel URL connected to Supabase production with migration, secrets, and environment selection documented.
  - Prove `fake → Gemini → GPT-5.6` environment flip works in production without code changes; record a safe fallback configuration.
  - Keep the fake/local track entirely usable without deployed services or production credentials.
- **Moves:** Phase-1 live-deploy gate. **Never cut.**

### SAR-023 — Landing and pricing surface

- **Agent:** `ship` (Terra) · **Size:** M · **Depends:** `SAR-021`, `SAR-022`
- **Docs:** `docs/screens/SCREEN-PRICING.md` · `docs/product/PHASES.md` §1.3 · `docs/experience/DESIGN.md` · `docs/architecture/ARCHITECTURE.md` §7
- **Acceptance (transferred from the pricing screen):** `/pricing` shows “One house-style hero, the 60-second loop, Free and Pro comparison, ₹499/year”; its primary action is `Go Pro`; signed-out CTA preserves context at `/signup?next=/pricing`.
- **Safety acceptance (transferred from the pricing screen):** “Free is explicitly described as the full v1 experience; Pro gates nothing in v1.” “The only visible Pro affordance is a plan badge/status row in Settings and the post-checkout confirmation. It must not hide or block F3/F11 paths.”
- **Verification:** Pricing hero · signed-out CTA · signed-in free state · checkout handoff · cancelled state · success/Pro state · waitlist fallback · Settings plan affordance — at 390px and desktop smoke, Ember Dark and Ember Light.
- **Moves:** Phase-1 landing/pricing gate.
- **Cut line:** **#2.** If slipping, retain one hero section and the CTA; remove landing polish only.

### SAR-024 — Legal stubs, installable PWA, and judge seed

- **Agent:** `ship` (Terra) · **Size:** M · **Depends:** `SAR-021`, `SAR-022`, `SAR-023`
- **Docs:** `docs/product/PHASES.md` §§1.5–1.6 · `docs/architecture/ARCHITECTURE.md` §7.3 · `docs/screens/SCREEN-AUTH.md` · `docs/screens/SCREEN-PRICING.md` · `docs/architecture/TECH-STACK.md` §7
- **Acceptance:**
  - Add accurate `/privacy` and `/terms` routes and link both from auth and pricing; retain the Settings export row.
  - Ship the signed install-only manifest: name/scope/start URL, standalone display, Ember colors, and 192/512 maskable icons; do not add push, background sync, or an offline outbox.
  - Add authenticated “Try the 12-day demo”: one idempotent, user-scoped clone of fixed typed fixture rows, free forever, never overwriting real data.
- **Moves:** Phase-1 legal/judge/PWA readiness; `seed-idempotency` and tenant-isolation coverage.

### SAR-025 — Razorpay annual checkout and waitlist fallback **[CUT LINE #1 — LAST]**

- **Agent:** `ship` (Terra) · **Size:** L · **Depends:** `SAR-021`–`SAR-024`, `SAR-020`
- **Docs:** `docs/architecture/ARCHITECTURE.md` §7.2, §9 · `docs/screens/SCREEN-PRICING.md` §§2–3 · `docs/product/DECISIONS.md` D-032 · `docs/product/PHASES.md` §1.4
- **Acceptance:**
  - Create Razorpay test-mode annual checkout only for an authenticated user and exactly `49900` paise/INR; client success/cancel never changes the plan.
  - Verify raw-body webhook signatures before parsing; deduplicate provider event IDs; atomically mark the checkout paid and flip `profiles.plan` `free → pro` once.
  - Show one visible Pro affordance while gating no v1 feature; demo seed and all F3/F11 paths remain free.
  - Prove webhook replay has one transition and record test evidence.
- **Moves:** full Phase-1 stranger journey and `billing-webhook-replay` fixture.
- **Cut line:** if signed webhook/replay acceptance cannot be proven without blocking a required higher-priority gate, set `BILLING_MODE=waitlist`; CTA writes one scoped waitlist request. Preserve the signed plan/webhook schema and do not renegotiate the demo spine.

## 5. Review gates

| Gate | Required evidence | Owner |
|---|---|---|
| **F3** | `SAR-007` green on fake + SQLite + local password, wrong silent writes zero, 390px/desktop capture-state screenshots | Sol review after Terra delivers |
| **Money release valve** | full Money acceptance blocks a higher-priority required gate; explicit decision required before the light-ledger fallback | Satvik scope call, Sol records decision |
| **Billing fallback** | signed webhook/replay evidence or `BILLING_MODE=waitlist` enabled | Satvik confirms; Sol records cut |
| **Phase review** | `SAR-020` report, F11 dry-run, public URL, auth/seed/billing evidence, screenshots | Sol formal review against `docs/product/PHASES.md` |

## 6. Per-ticket execution loop

1. Sol writes `.codex/plan.md` for exactly one approved ticket and links its docs/acceptance evidence.
2. Satvik approves the ticket plan; Terra implements only that ticket.
3. Terra runs the narrow validation prescribed above and reports changed files plus evidence.
4. Sol diff-reviews against this register and the ticket’s docs before the next ticket starts.

No ticket silently expands scope. Any change to a locked contract is a new append-only decision in `docs/product/DECISIONS.md`.
