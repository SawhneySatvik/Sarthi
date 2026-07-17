# Sarthi — PRD v2.1

> Working title. `sarthi` (सारथी) = the charioteer who steers the rider — the coach/guide archetype.
> **v2.1 (de-staled 2026-07-15):** corrects the build-vs-runtime model split, the stack (now all-TypeScript), hosting, closed decisions, and credits. Scope is unchanged from v2 — this is a factual refresh, not a re-scope. Deltas logged in `docs/product/DECISIONS.md`.

| | |
|---|---|
| **Status** | Locked for build (no mid-build iteration) |
| **Owner** | Satvik (founder / product) |
| **Context** | OpenAI Build Week (Devpost) · Track: **Apps for your life** |
| **Built with** | **Coded** in Codex + GPT-5.6. **App runtime is model-agnostic** (Vercel AI SDK): Gemini free tier in dev; GPT-5.6 and Claude wired as swappable adapters. Vision + PTT STT/TTS |
| **Date** | 2026-07-15 |
| **Submission** | Tue Jul 21, 5:00 PM PT → **Wed Jul 22, ~5:30 AM IST** |
| **Credits** | 1,250 Codex credits in hand + $100 grant request raised — **secured, not a blocker** |

---

## 1. TL;DR

Sarthi is a **voice-and-photo life coach that runs your whole life from one capture surface**. You dump a messy sentence — *"Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10"* — and a frontier LLM turns it into structured entries across four domains at once: a **Money** transaction, a **Health** meal + water, a **Skills** session, a **Habits** log. You confirm with a swipe; the coach reads it back and adapts what's next.

Four domains, four review experiences, **one capture pipeline** underneath. That single-utterance-to-many-entries move is the moat — it's exactly what plan-and-gamify apps can't do, because they make you tap into separate trackers.

## 2. Problem & why now

Self-improvement apps (Life Reset / Rise, 1.5M downloads) generate a fixed plan over preset habit areas and gamify adherence. Two ceilings in their own users' words: it *doesn't work alongside you* (no real adaptation), and it has **no concept of skills or mastery** — only day-streaks. And real life isn't one habit: people run **health, money, habits, and skills** in parallel, at different tempos, and current tools force a separate app (or separate tool inside the app) for each.

**Why now:** frontier LLMs collapse those four trackers into one spoken sentence. Vision estimates a meal's macros or reads a receipt; STT takes the dump; the model parses it into typed, domain-tagged entries and does the coaching. None of this was reliable or cheap a year ago.

**Two model layers (don't conflate them).** GPT-5.6 is central to how the app is *built* — coded with Codex powered by GPT-5.6 (the rubric's "built with Codex + GPT-5.6" story, captured via the `/feedback` session ID). At *runtime*, the model slot is **provider-agnostic**: dev runs on Gemini's free tier for cheap iteration, with GPT-5.6 and Claude wired as swappable adapters (env flip, no code change). The submitted demo can run on either — decided at record time.

## 3. Reference teardown — Life Reset (parity → surpass)

Keeps: 33/66/99-style arcs, XP/levels/streaks, calm painterly imagery, a light "collectible card" stats screen, a cumulative time counter (validates the mastery idea), a memory/journal thread, a Tools shelf.

Surpasses: **universal capture** (one sentence → many entries) vs. tap-into-separate-tools; a **coach that adapts** vs. a static plan; **vision-verified/estimated** entries vs. self-report; **mastery tracks** (hours) vs. day-streaks only; a **humane** monetization seam vs. survey-then-paywall. Drops: the 7 *static* mini-tools clutter — Tools returns as a bento grid of **AI-specialized** tools gated by an earning rule (every tool writes into a domain store; see §17).

## 4. Core insight — shared pipeline, per-domain stores

The four domains are, honestly, 2–3 apps overlapped. What unifies them is **not** one generic data model — it's the **ephemeral parse-and-confirm pipeline**. Nothing persists as a generic entry.

- One utterance → the model emits a transient `CaptureDraft` of domain-tagged `Proposal`s.
- Each confirmed proposal writes to **its own typed table** (`Transaction`, `Meal`, `Water`, `Workout`, `HabitLog`, `Session`, …).
- Each domain owns its **own review lens** over its own tables.

So capture feels like one surface; storage is four clean little apps; review looks deliberately unalike. That's what makes "all four, full" achievable in days — a new domain is a schema + a projection, the pipeline is built once.

## 5. Target user & dogfood

Primary user = **Satvik**, dogfooded in parallel: Health (gym, eating, weight), Money (spends, salary, rent/bills), Habits (5 AM wake, routine), Skills (DSA / system design). Quality bar: he logs his real life through it daily. Broader audience post-hackathon.

## 6. Product principles

1. **One capture, many entries** — the dump-and-file loop is the product; everything else serves it.
2. **Nothing writes unconfirmed** — the swipe gate is what turns the moat from risky (noise) to trustworthy.
3. **Estimate where it helps, always correctable** — AI fills numbers (kcal, burn) with visible confidence and one-tap edit.
4. **Shared pipeline, per-domain stores** — typed models, bespoke review lenses.
5. **The coach must respond** — reacts per capture, reflects daily and weekly; adaptation is shown, not hidden (glass-box).
6. **Two progression modes** — challenge arcs (days) for Health/Money/Habits, mastery tracks (hours) for Skills.
7. **Calm at rest, expressive at progress** — the imagery breathes; celebration is earned and brief (anti-overwhelm).
8. **Humane monetization** — free remains complete in v1; the sellable rail proves a transparent, non-paywalling Pro checkout.
9. **Provider-blind runtime** — LLM/voice/vision/DB behind interfaces, selected by env; a deterministic `fake` stack runs the loop keyless.
10. **Locked before build** — decisions are constraints; no mid-build iteration.

## 7. Scope

**In (v1):**
- Universal capture: voice / text / photo → parse → route-by-confidence → swipe-confirm → typed write.
- All **four domains, full**: Money, Health, Habits, Skills — each with its own store + review lens + onboarding.
- Extra capture paths: receipt/batch, recurring detection, backdating, correction-as-edit, photo-only.
- Cross-domain links (dual): a Habit can be satisfied-by another domain's metric.
- Three-tier coach: per-capture one-liner + daily brief + weekly brief.
- Game layer: XP, levels, per-domain stats, streaks, arc maps, mastery meters.
- Journey/Memory timeline (photos + milestones).
- Stats screen as light collectible cards; Tools as a bento grid of AI-specialized tools (Focus→Skills, Meditation→Habits, Afford-it→Money, Workout Counter→Health; 2+ live at v1, rolling).
- Eval harness + one A/B report across tiers **and** providers (Gemini vs GPT-5.6).
- **Theme system:** token architecture + 3 prebaked themes (Ember/Bone/Moss), each with light + dark modes; switcher in Settings.
- Premium Dark UI (Ember Dark default), **mobile-first installable PWA** (briefs on-open; push deferred), screenshot-verified at mobile; desktop responsive as stretch.
- **Sellable rail:** Supabase Auth email/password + reset in prod, per-user repository scoping, landing/pricing, Razorpay test-mode annual Pro at ₹499/year (`49900` paise), legal stubs, and authenticated opt-in judge seed. Free v1 remains ungated.

**Out / roadmap (v1 explicitly excludes):**
- **Learned estimate-memory** (your "dal 450→520 sticks") — deferred. v1 corrections edit only the current entry. Roadmap version is corrections-only, confidence-gated, inspectable, deletable (§24).
- Offline-first sync; user-**custom** theme editor (prebaked themes are in); investing/holdings (schema seam only); social; the full paid feature catalogue; native app; real-time streaming voice (PTT is the target).

## 8. Domains (all four, full)

| Domain | Tempo | Mode | Core entries | Review lens | AI's job |
|---|---|---|---|---|---|
| **Money** | episodic | arc + ledger | Transaction, RecurringRule | ledger: balance, safe-to-spend, budget bars, txn list, recurring shelf, leak insights | parse receipt, categorize, detect recurring, flag leaks, "can I afford X?" |
| **Health** | daily, multi-entry | arc | Meal, Water, Workout, Weighin | dashboard: rings (in/out, water, protein), meals, workout, weight sparkline | estimate kcal/macros/burn from text or photo, adapt workout |
| **Habits** | daily, binary | arc | Habit, HabitLog | streak grid: checklist, month heatmap, satisfied-by badges | behavior design (ramp targets, habit stacking) |
| **Skills** | session-based | **mastery** | Skill, Milestone, Session | curriculum + hours: mastery meter, generated milestone list, session log, next-session nudge | generate a roadmap for anything, log hours, checkpoint |

## 9. The capture → confirm loop (the moat)

1. **Dump** — hold-to-talk / type / snap. Any mix of domains in one go.
2. **Parse** — the model emits typed `Proposal`s, tags each with best-guess domain, estimates where needed (rotis+dal ≈ 450 kcal, bottle ≈ 500 ml).
3. **Route by confidence** — explicit values (`₹340`, `500ml`, "90 min") **auto-accept silently**; **estimated** values surface as cards. Only what deserves a glance is shown → low friction, no blind writes on fuzzy data.
4. **Swipe the estimate cards** — right = accept (writes), left = discard, tap = edit number/category, long-press = "why this number" (glass-box). Each card has a **domain chip you can flip** if the model guessed wrong (model decides, user overrides).
5. **Write** — each accepted proposal writes to its **own typed table**. Nothing generic persists.
6. **React** — coach gives the combined one-liner + any adaptation.

Unlocked paths, same deck: receipt snap → many transaction cards; "rent 15000" → **make recurring** card; "yesterday I skipped gym" → **backdated**; "that lunch was closer to 600" → **edit** card (finds the entry, no duplicate).

## 10. Data models (per-domain typed)

Transient (never persists):
- versioned `CaptureDraft { raw, source, evidenceRefs, temporalContext, proposals[] }`
- Zod-validated discriminated `Proposal` union per permitted typed target, with `create|correction|backdate` intent, `estimated:bool`, confidence, and status. No generic payload persistence route.

Money: `Transaction { amountPaise, direction, category, merchant?, recurringId?, date, evidence?, note, confidence }` · `RecurringRule { amountPaise, direction, category, cadence, nextPost }`
Health: `Meal { items[], kcal, macros{proteinGrams,carbsGrams,fatGrams}, confidence, evidence? }` · `Water { millilitres }` · `Workout { exercises[{name,sets,reps,load}], durationMinutes, burnKcal, confidence }` · `Weighin { weightGrams }`
Habits: `Habit { name, cadence, difficulty, satisfied_by? }` · `HabitLog { habit_id, status, source, date }`
Skills: `Skill { name, targetMinutes, curriculum:Milestone[] }` · `Milestone { label, done }` · `Session { skillId, minutes, note, source, date }`
Cross: `Profile { plan: free|pro, … }` · `Progress { domain, xp, level, stats_json, streak, cumulative_minutes? }` · `Plan/Arc`, `MasteryTrack`, `Adaptation { plan_id, before, after, reason }` · `CoachNote { scope[capture|daily|weekly], text, created_at }`. The `plan` column proves the v1 rail but gates nothing until Phase 2.

Every persistent row, including Profile, Progress, Plan/Arc, evidence, seed, and commit/undo support rows, carries `userId`; the complete Drizzle schema is an `docs/architecture/ARCHITECTURE.md` gate before schema code.

## 11. Review screens (four lenses, deliberately unalike)

- **Money — ledger.** This-month balance + safe-to-spend; category budget bars; txn list by day; recurring shelf (auto-posts salary/rent/subs); leak insight strip.
- **Health — dashboard.** Today's rings (in vs out, water, protein); meals (photo + kcal + editable confidence chip); workout summary + burn; weight sparkline. Best vision moment: meal photo → macros.
- **Habits — streak grid.** Checklist with streaks; month heatmap; stacking suggestions; **satisfied-by badges** ("Water ✓ auto from Health · 3.1L").
- **Skills — curriculum + hours.** Mastery meter with cumulative counter (`128:30:00 → 500h`); AI-generated milestone checklist; session log; next-session nudge.

## 12. Onboarding (one shape, four outputs)

Name the goal by type or voice, or pick a preset → the model generates the domain spine (Health: daily targets · Habits: starter list + cadence · Money: categories + budget · Skills: milestone curriculum) → confirm/trim → renders.

## 13. Cross-domain links (in v1)

A Habit can declare `satisfied_by` another domain's metric (water Habit ✓ when Health hydration ≥ 3L). No double entry — a Habit becomes a binary goal *over* another store's data. Reading/meditation: user frames it — mastery hours → Skill; daily consistency → Habit.

## 14. Coach — three-tier cadence

- **Per capture → one line.** Reactive sentence after the swipe. **Fast tier** (cheap; it's a reaction).
- **Daily brief → the ritual.** Morning plan + evening recap; where adaptation is shown. **Deep tier.** Lives in the Coach tab.
- **Weekly brief → the reflection.** Per-domain trends, one honest observation + one adjustment. **Deep tier.** This is the anti-churn surface ("it's paying attention over time") and the best post-capture "wow" for judges.

Coach is therefore both a reactive strip (inline at capture) and a scheduled ritual tab (daily + weekly briefs stack as a thread). *(Tiers `deep`/`fast` are provider-neutral: Gemini in dev, GPT-5.6 for the demo.)*

## 15. Game layer + progression

XP per accepted entry → per-domain + overall levels. Arc domains (Health/Money/Habits) track streaks + arc-map progress; Skills tracks cumulative mastery hours. Domain stats move from real entries. Humane grace on streaks (not pure penalty). Stats tab aggregates all as light collectible cards.

## 16. Journey / Memory

Every attached photo stored with date, domain, what it proved, and the coach note → scrollable memory gallery, punctuated by milestone markers (level-ups, arc completions, mastery thresholds). Cheap (a view over evidence rows); the emotional closer for the demo.

## 17. UI / UX & design system

- **Premium Dark**, warm near-black canvas; cards lifted a hair, never pure grey.
- **Domain color system (calm, not neon):** Health = sage · Money = honey · Habits = indigo · Skills = violet. One global energy accent = **warm amber**, reserved for streak/XP only.
- **Imagery is the soul:** calm, painterly, solitary-figure scenes (our own house style, not branded "Ghibli"), full-bleed on cards under a scrim. **Pre-generated** with GPT Image + Nano Banana, shipped as static assets; painterly gradients/textures as build-time placeholders.
- **Type split:** heavy display for big numbers, warm humanist for the coach's voice, tabular for stats.
- **Calm at rest:** fewer elements than the reference — one slim stat cluster, one coach line, only the next card exposes Done/Skip.
- **Capture affordance:** a persistent reflect/capture bar above the nav (mic + text); after Done/Skip it nudges "how'd it go?".
- **Nav (5 tabs):** Today · Journey · Coach · Stats · Tools.
- **Stats:** light collectible cards on dark (Life Reset "My Rating" inversion), domain-hued accents + amber for Overall.
- **Tools:** a bento grid of AI-specialized tools, each writing into a domain store (the earning rule): Focus timer → Skills hours · Meditation → Habits · Afford-it check → Money · Workout Counter → Health. 2+ live at v1 (rolling); the rest as coming-soon cards + a suggest-a-tool card. Painterly house-style cards.
- **Done/Skip primary; voice/text is the reflection layer** that powers adaptation (and can bulk-set completion).

## 18. Architecture

Provider-blind core, config-selected model tiers, typed store, eval harness. **Coded fresh in Codex.**

```
Interface     Next.js console (App Router, all-TypeScript): Today · capture sheet
      │       (voice/text/photo + swipe deck) · Journey · Coach · Stats · Tools
      │       (push-to-talk, Premium Dark)
Capture       STT/vision → LLM parse → CaptureDraft(proposals[]) →
      │       route-by-confidence → swipe-confirm → typed writes
Core          Orchestrator + generic Domain-Coach (per-domain specs) + 3-tier coach
Data/store    Per-domain typed tables via Drizzle: SQLite (dev) → Supabase Postgres (prod).
      │       Focus timer → Skills hours. Service methods: parse_dump · propose ·
      │       commit_entry · adapt_next · log_hours · brief_daily · brief_weekly · award_xp
Providers     LLM (Vercel AI SDK, env-routed): deep tier = parse + coaching,
      │       fast tier = per-capture line + classify. Dev = Gemini free tier;
      │       demo = GPT-5.6 / Claude (both wired).
      │       Vision: selected multimodal (Gemini dev / GPT-5.6 demo).
      │       Voice STT/TTS: PTT — Gemini multimodal (dev default); Sarvam / OpenAI /
      │       Web Speech adapters (+ deterministic fake stack, keyless).
Eval          parse accuracy · routing/domain-tag accuracy · estimate error ·
              adaptation sanity · state match · latency p50/p95 · cost/turn across
              tiers and providers
```

Invariants: provider protocols by env; one generic Domain-Coach; tool methods defined once; integer units (paise, ml, minutes, grams); deterministic `fake` stack for keyless tests.
**Stack:** all-TypeScript — Next.js (App Router) on Vercel; SQLite (dev) → Supabase Postgres (prod) via Drizzle; Tailwind + shadcn/ui + Framer Motion.

## 19. Model + Codex usage map

**Build layer:** the app is *coded* with **Codex + GPT-5.6** (capture the `/feedback` session ID). Runtime tiers below are provider-agnostic — Gemini in dev, GPT-5.6 (or Claude) for the demo.

| Capability | Runtime tier | Role |
|---|---|---|
| Parse dump → typed proposals + estimates | **deep** | the moat |
| Meal macros / receipt read | **vision** | estimate + verify |
| Daily / weekly briefs, adaptation | **deep** | coaching |
| Per-capture one-liner, domain classify | **fast** | cheap → cost story |
| Voice | STT/TTS (PTT) | dump + reply |

*Tier → model matrix (env-selected):* deep = Gemini `pro` (dev) / GPT-5.6 Sol (demo) · fast = Gemini `flash` (dev) / GPT-5.6 Luna (demo) · adapters kept for Claude.

Codex: scaffold repo, capture pipeline, per-domain stores, four lenses, coach tiers, Next.js console, eval harness — capture the `/feedback` **session ID** + log 3–4 "Codex accelerated X" moments.

## 20. Eval plan

Scored against ground-truth typed rows: parse accuracy, domain-tag/routing accuracy, **wrong-silent-write count (hard zero)**, estimate error (kcal/amount vs labels), adaptation sanity (LLM-as-judge + hand labels), state match, latency p50/p95, cost/turn across tiers and providers (Gemini vs GPT-5.6) → one typed A/B report.

## 21. Milestones (focused build within the window)

The former calendar was superseded by the D-026 two-ring plan and D-035’s work-gated execution policy. **Execution order, acceptance gates, and cut lines live only in `docs/product/PHASES.md` and `docs/planning/TICKETS.md`.**

**Release valve (pre-agreed):** if full Money acceptance blocks a higher-priority required gate, cut **Money to a light ledger** (log + one receipt parse + a budget bar) and keep **Health + Skills deep**. Do NOT add new domain concepts mid-build.

## 22. Success criteria

- **Money shot lands:** one spoken dump → a swipe-deck files entries across 3–4 domains → coach reads it back and adapts — under 60s of video. Weekly brief as the compounding "wow".
- Eval A/B report attached; README maps the model + Codex usage; `/feedback` ID captured.
- Satvik logs his real life through it daily (dogfood bar).

## 23. Decisions

**Locked:** shared pipeline + per-domain typed stores · all four domains full · route-by-confidence (explicit values auto-write only at ≥0.90 confidence; every other proposal gets a card) · latest-commit-batch compensating undo · model tags domain + user can flip on card · cross-domain links dual/in · three-tier coach (fast line + deep daily + deep weekly) · learned estimate-memory **deferred** · nav = Today/Journey/Coach/Stats/Tools · Stats = light cards · Tools = bento grid + earning rule (every tool writes to a domain store); Focus timer → Skills hours · Done/Skip primary + voice reflection · imagery pre-gen (GPT Image + Nano Banana), gradient placeholders · palette sage/honey/indigo/violet + amber energy · **all-TypeScript Next.js on Vercel** · **SQLite dev / Supabase prod via Drizzle and an AuthProvider-bound repository** · **Codex + GPT-5.6 = coding/build layer; runtime model-agnostic via AI SDK, Gemini free tier as dev default, GPT-5.6/Claude adapters wired** · **voice PTT, dev default = Gemini multimodal** · **one coach engine + domain registry seam** · deterministic `fake` stack · **themes: 3 prebaked (Ember/Bone/Moss) × light/dark, tokens-only components** · **Today = plan-forward (Life Reset pattern); entry feed lives in lenses** · **onboarding = deep-but-skippable (required core + optional detail sections)** · **Settings/Profile behind header avatar; nav stays 5 tabs** · **Phase-1 auth, pricing, Razorpay rail, legal stubs, and judge seed without paywalling the free experience** · **investing deferred (schema seam only)**.

**Still open (defaults):** name `Sarthi` · arc length 33 for demo · **which provider the submitted demo runs on (GPT-5.6 vs Gemini — decided at record time; both wired).**

## 24. Roadmap (post-hackathon)

Learned estimate-memory (corrections-only, confidence-gated, inspectable/deletable, scoped to food items + spend categories) · offline-first sync · token theme editor · full Money finance app · native app · streaming voice · social/leaderboards · paid feature catalogue and pricing experiments · multi-user profiles/income expansion.

## 25. Risks

- **Capture noise** (lossy parse writing silently) → the swipe gate + confidence + ask-don't-invent + undo. The single most important safeguard.
- **All-four in days** → only possible because the pipeline is built once; domains are schema + lens. Hold the line: no new domain concepts mid-build.
- **Estimate trust** → visible confidence + one-tap edit; wrong silent writes are the worst failure and are eval-tracked.
- **Voice time-sink** → PTT + fake stack first; streaming optional.
- **Scope creep from Tools/game** → Tools is one timer; game layer is deterministic frontend built after the pipeline.
- **Codex provenance** → build core in Codex; keep session ID.
- **Rubric — GPT-5.6 centrality** → GPT-5.6 is the coding tool (Codex) and a wired runtime adapter; the demo can run on GPT-5.6 to keep "central to the app" airtight. Dev-on-Gemini is a cost choice, not a rubric statement.
