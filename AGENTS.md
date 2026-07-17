# AGENTS.md — Sarthi build contract

> Codex reads this first, every session. It is the **constitution** for the build.
> Locked decisions are **constraints, not suggestions**. Do not silently drift.
> Full detail lives in `docs/`. This file is the index + the invariants + the gates.

---

## 0. What we are building (10 seconds)

**Sarthi** — a voice-and-photo life coach. One messy spoken sentence
(*"Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10"*)
is parsed into **typed entries across four domains at once** — Health · Money · Habits · Skills.
Explicit values file silently; **estimates surface as swipe cards** (nothing estimated ever
writes unconfirmed). A three-tier coach reacts, briefs daily, reflects weekly, and adapts the
plan glass-box (before → after → reason, revertible).

**The moat = one capture pipeline · four typed stores · four deliberately-unalike review lenses.**
Build the pipeline once; a new domain is then just a schema + a lens.

**What ships (D-026, two rings):** the **inner ring** is the demo spine (FLOWS F3 → F11) — uncuttable,
the hackathon rubric story. The **outer ring** makes it a *deployed, sellable product*: live Vercel+Supabase,
real multi-user auth, landing + pricing, a billing rail with a Pro flag, judge-safe free access. Outer-ring
cut lines are ordered in `docs/product/PHASES.md`; the inner ring has none. These docs are the base — later phases
(mobile bake-off, full paid features) are planned in `docs/planning/PLANNING-BRIEF.md` and **never start before submission**.

**Deadline:** OpenAI Build Week — submit **Tue Jul 21, 5:00 PM PT**. Track: *Apps for your life.*

---

## 1. Two model layers — NEVER conflate them

| Layer | What | Models |
|---|---|---|
| **Build layer** | The models that *write this code* (you, Codex) | GPT-5.6 via Codex — Sol / Terra / Luna, per `.codex/agents/*`. Capture the `/feedback` session ID. |
| **Runtime layer** | The models the *app calls* at runtime (parse/coach/vision/voice) | Provider-agnostic via Vercel AI SDK. Dev default = **Gemini free tier**. GPT-5.6 + Claude adapters stay wired. Flip by env. |

The hackathon's "central to GPT-5.6" story is the **build layer**. The runtime layer is
provider-blind by design and must run **keyless** against the `fake` stack. When you touch
`providers/llm`, you are wiring the *runtime* matrix — do not hardcode a build-layer model there.

---

## 2. Invariants (the locked decisions — do not violate)

These are enforced by hooks in `.codex/hooks/` and checked by the `reviewer` agent. Breaking one
is a failed turn, not a style nit.

1. **Nothing estimated writes unconfirmed.** Explicit values (`estimated:false`, high conf) auto-write;
   anything estimated becomes a swipe card. A wrong *silent* write is the single worst failure. Every write is undoable. Ask-don't-invent on ambiguity — no phantom entries.
2. **Integer units everywhere** for money/quantity: **paise, ml, minutes, grams**. **No floats for money.** Ever.
3. **Provider-blind core.** LLM / Voice / Vision / DB each sit behind an interface with a
   deterministic **`fake` adapter**. The whole capture loop must run **keyless** (`fake` stack, no API keys).
4. **Tokens-only UI.** Never hardcode a hex/radius/duration in a component. All styling via CSS
   variables (`docs/experience/DESIGN.md` §2). Amber (`#E8913E`) appears **only** on XP/streak/level.
5. **Repository pattern.** Business logic never touches the DB driver. One Drizzle impl runs over
   SQLite (dev) and Postgres (prod), selected by env.
6. **Typed writes only.** Each accepted proposal → `repo.create` into its **own per-domain table**.
   Nothing generic persists.
7. **No new domain concepts mid-build.** Four domains, locked. Investing, Holdings, new trackers =
   deferred (schema comments only). If scope must change, write a new `docs/product/DECISIONS.md` entry first — do not improvise.
8. **One engine, config-specialized.** "Specialized coach agents" = domain specs in a registry
   (parse hints + coach spec + tool subset), **not** hand-built orchestrations. No LangChain/CrewAI.
9. **`core/` stays framework-import-clean** (D-027): no Next.js/React imports inside `core/` business
   logic, so the mobile bake-off winner can extract it into a shared package mechanically. No monorepo
   restructure in the window.
10. **Never paywall the demo path** (D-026): judges and demo users get the full seeded experience free.

---

## 3. Definition of done (the gates)

A task is **not done** until its gate passes. Gates are in `docs/experience/FLOWS.md` (integration tests as prose).

- **First build gate — `docs/experience/FLOWS.md` F3** (the canonical capture loop) runs **end-to-end on the `fake` stack, keyless, with Health**: hold mic → parse → route-by-confidence → strip auto-writes + estimate cards → swipe accept/discard/flip/why → typed write → XP → Today items check `via capture`. Then verify with real Gemini keys.
- **Eval-first done:** a feature isn't done until it **moves a number in the eval harness** (`docs/architecture/TECH-STACK.md` §8). Wrong silent writes are eval-tracked.
- **Screenshot-verify:** after any screen/state, screenshot at mobile (390px) + desktop, verify against Premium Dark intent + the screen doc's checklist, fix, re-shoot. Save to `.verify/screens/`.
- **Phase gates (D-026/D-028):** a phase counts as done only after the **Sol phase-review** passes against `docs/product/PHASES.md`. Phase-1 gate: a stranger can sign up → onboard → capture → coach reacts → checkout (test ok) → Pro flips — without the demo path ever being paywalled.
- **Provenance:** core is built **fresh in Codex** (not forked). Keep the `/feedback` session ID. Log 3–4 concrete "Codex accelerated X" moments to `docs/product/CHANGELOG.md` for the demo narration.

## 4. Build sequence (front-load the pipeline)

The pipeline is the expensive part; once it exists, domains are cheap. Follow `docs/operations/HANDOFF.md` §6.

1. **Scaffold** — Next.js (App Router) + TS + Tailwind + Drizzle + shadcn. Token layer + shell (Ember/Bone/Moss × light/dark).
2. **Provider layer** — LLM tier gateway (`(provider,tier)→model` matrix + env routing) + `VoiceProvider` + vision adapter + **the `fake` stack** (deterministic canned parse for the canonical dump).
3. **Typed schemas** — all per-domain tables + Progress/Plan/Adaptation/CoachNote + repository impl (SQLite).
4. **Capture pipeline** — `parse_dump` (deep tier, `generateObject`+Zod → `CaptureDraft`) → route-by-confidence → commit path with undo → XP award.
5. **Health store + lens; capture sheet UI** (static-orb fallback first; shader after F3 passes).
   → **GATE: FLOWS F3 on `fake`, keyless, with Health.**
6. Then fan out Money/Habits/Skills (`docs/planning/TICKETS.md`). Release valve: if full Money acceptance blocks a higher-priority gate, Money → light ledger; keep Health + Skills deep.
7. **Phase-1 sellable wrap** (`docs/product/PHASES.md`, interleaved by dependency): live deploy →
   Supabase Auth + `userId` scoping → landing + pricing → billing rail + Pro flag → legal stubs →
   judge seed. Cut lines fire in order if slipping; the spine is never traded.

**Verify before wiring** (`docs/architecture/TECH-STACK.md` §1): exact Gemini + GPT-5.6 runtime model IDs and current `@ai-sdk/*` structured-output support. The `docs-verifier` agent owns this.

---

## 5. The doc map (source of truth)

| Read when… | Doc |
|---|---|
| Finding the canonical doc order / category | `docs/README.md` |
| Orienting / README seed | `docs/product/PROJECT.md` |
| Product spec (deep reference) | `docs/product/PRD.md` |
| **Stack, repo layout, provider interfaces, capture types, coach registry** | `docs/architecture/TECH-STACK.md` |
| **Signed build blueprint and schema contracts** | `docs/architecture/ARCHITECTURE.md` |
| Locked constraints (append-only) | `docs/product/DECISIONS.md` (D-001–D-036) |
| Design law: tokens, 3 themes × 2 modes, type, motion | `docs/experience/DESIGN.md` |
| Per-screen states + data contracts + verify checklists | `docs/screens/SCREEN-*.md` |
| Production signup/login/reset | `docs/screens/SCREEN-AUTH.md` |
| Pricing + Razorpay checkout rail | `docs/screens/SCREEN-PRICING.md` |
| **Cross-screen journeys; F3 = DoD; F11 = demo script** | `docs/experience/FLOWS.md` |
| Frontend build tickets (P0–P11) — mirror for backend | `docs/experience/DESIGN-PROMPTS.md` |
| Art system + 40-prompt generation brief | `docs/experience/ASSETS.md` |
| Prototype punch list | `docs/experience/REFINEMENTS.md` |
| Where we are / next-session plan | `docs/operations/HANDOFF.md` |
| **Phase rings, gates, cut lines, work order** | `docs/product/PHASES.md` |
| Tomorrow's Claude Max planning session contract | `docs/planning/PLANNING-BRIEF.md` |
| Approved implementation tickets and build order | `docs/planning/TICKETS.md` |
| Phase-2+ specs (land after the planning session) | `docs/roadmap/` |

Codex only auto-loads `AGENTS.md`. **`@`-mention the specific doc** you need for a ticket
(e.g. `@docs/screens/SCREEN-CAPTURE.md`) — do not guess a screen's spec from memory.

---

## 6. The agent roster (who does what)

Specialized agents live in `.codex/agents/*.toml`. **The mesh (D-028): Sol plans + reviews · Terra
writes ALL code · Luna stays read-only.** Every ticket flows **plan (Sol) → sign-off (human) → build
(Terra) → diff review (Sol)**, and every phase ends with a **formal Sol phase-review** against
`docs/product/PHASES.md` before it counts as done. Escalation valve: Terra fails the same ticket twice →
`make deep` (Sol writes that one ticket).

| Agent | Model · effort | Sandbox | Job |
|---|---|---|---|
| `architect` | **Sol** · high | read-only | Plans every ticket down to the last decision *before* Terra writes a line. Enforces gates. **Plans, not code.** |
| `reviewer` | **Sol** · high | **read-only** | Two modes: diff review per ticket; **formal phase review** per `docs/product/PHASES.md`. A phase isn't done until it passes. |
| `product-researcher` | **Sol** · medium | read-only + web | Decision-grade research (mobile bake-off, billing provider, pricing). Feeds/verifies the Claude planning session; used sparingly. |
| `pipeline` | **Terra** · high | write | The capture pipeline + typed stores + coach engine + capture sheet — the moat. |
| `ship` | **Terra** · high | write | Phase-1 sellable wrap: deploy, auth + `userId` scoping, landing/pricing, billing rail, judge seed. |
| `screens` | **Terra** · medium | write | Routine, well-specified screens from `SCREEN-*.md`. |
| `test-eval` | **Terra** · medium | write (tests only) | Tests + eval harness. Never edits production code. |
| `scout` | **Luna** · medium | read-only | Fast code-path tracing and evidence-gathering. |
| `docs-verifier` | **Luna** · medium | read-only + web | Verifies runtime model IDs / `@ai-sdk/*` versions. No guessing. |

See `docs/operations/README-CODEX-SETUP.md` for how per-agent models are guaranteed (profiles) and the credit-budget posture.

## 7. Working conventions (with Satvik / the human)

- **Architect-first.** Lock the approach (`/plan`) before building. **No mid-build iteration.**
- **Ruthless v1 scope.** Cut before you add. When unsure, the smaller thing that still lands F11.
- **HITL gates are real.** Stop at genuine decision points; get sign-off. The hooks enforce the hard ones.
- **Small-batch questions.** Prefer 2–4 tappable options over open prose. Concise, direct, no fluff.
- **Update `docs/product/DECISIONS.md` + `docs/product/CHANGELOG.md` from the first commit.** Session-end: write a short handoff (what changed, what's next, open questions).
- **Dogfood bar:** Satvik using it on his real Health/Money/Habits/Skills daily.
