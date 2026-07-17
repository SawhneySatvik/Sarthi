# docs/screens/SCREEN-ONBOARDING.md — Onboarding

| | |
|---|---|
| **Role** | First touch. Capture enough to generate four credible domain spines — without a form-wall. **Deep-but-skippable (locked D-015):** required core + optional detail sections; the coach backfills skips over week 1. |
| **Shape** | One question per screen · chip-MCQ first, voice/type always available · painterly backdrops · "one flow, four outputs" |
| **Inherits** | `docs/experience/DESIGN.md` · capture-sheet input patterns (mic, chips) |

---

## 0. The one-sentence spec

A calm, one-question-at-a-time conversation — tap chips or just talk — that ends with the AI drafting your four plans in front of you; answer the deep stuff now or let the coach ask later.

## 1. Flow map

```
A. Welcome (1)  →  B. CORE — required (5–6 screens, ~2 min)
                →  C. Spine generation (shimmer) → D. Confirm & trim (4 cards)
                →  E. DETAIL — optional sections (skippable, resumable)
                →  F. Theme pick (optional, 1) → G. Land on Today (hint row active)
```

Progress: a thin `--energy` hairline at top fills across CORE only (detail sections don't extend it — skipping never feels like leaving something undone). Back = chevron, always. No step counters ("3 of 14" is dread).

## 2. Screen pattern (every question uses this)

- **Backdrop:** painterly scene under heavy scrim (per-phase variants; gradient placeholder).
- **Question** in Display type, one line, `--ink-1`. Optional sub-line in Fraunces (`--ink-2`) — the coach's voice framing *why* it asks: *"So targets fit your body, not an average."*
- **Answer surface:** chip grid (`--r-chip`, single or multi-select, 2–4 per row) or a focused input (number pad / date wheel / slider). **Mic is always present** (small, bottom-right) — speak any answer instead ("I'm 71 kilos, around 5'10"") → fast-tier parse fills the field(s), user confirms.
- **Continue** activates on answer; `Skip` (ghost, `--ink-3`) appears only in DETAIL phase.
- Transition between questions: `--t-base` crossfade + 12px rise. No sliding carousels.

## 3. Phase A — Welcome (1 screen)

Full scene · wordmark · one line: **"One sentence a day. Four lives in order."** · `Begin` · quiet `I have an account` (prod). No feature carousel — the product demos itself in D.

## 4. Phase B — CORE (required, ~2 min)

| # | Question | Surface | Feeds |
|---|---|---|---|
| B1 | "What should I call you?" | text (name only) | Profile |
| B2 | "When were you born?" | date wheel | age → kcal/targets |
| B3 | "Your body, roughly" | height + weight steppers (cm/kg ⇄ ft-in/lb toggle; integers stored metric) | Health targets |
| B4 | "What does your day look like?" | chips: `student` `9–5` `shift work` `founder/freelance` `at home` + wake/sleep time dual-slider | Habits cadence + plan timing |
| B5 | "Pick your battles" | multi-chips, one per domain: Health `eat better · gym · lose/gain` · Money `track spends · budget · stop leaks` · Habits `wake early · routine · focus` · Skills `+ name one` (text/voice) | the four goal seeds |
| B6 | "How much time can you actually give?" | chips: `15m` `30m` `1h` `2h+` per day | plan density |

Rules: B5 requires **at least one domain** selected (any subset — un-selected domains get no plan and show the "set one up" row on Today). Skills naming accepts anything — the roadmap generator handles arbitrary skills. Every answer editable later in Settings.

## 5. Phase C — Spine generation (the first "wow")

- Full-screen shimmer moment: the four domain chips orbit a center label — *"Drafting your plans…"* — while the **deep tier** generates each spine (Health daily targets · Habits starter list + cadence · Money categories + budget · Skills milestone curriculum) from B-answers.
- Budget ≤ 8s (parallel calls); over → per-domain skeletons resolve independently (don't block all four on one).

## 6. Phase D — Confirm & trim (4 cards, the contract)

- One card per selected domain, stacked vertically (not a deck — this is review, not triage). Card = domain-hued edge + the spine as **editable rows**: tap a target to adjust (stepper), swipe a row left to drop it, `+ add` at bottom.
- Header line per card in Fraunces: *"Based on your 30 minutes and 9–5 — here's a start."* (glass-box: the plan visibly derives from answers).
- Footer: **`Looks right — start Day 1`** (primary, amber — this is an earned moment) · `Regenerate` (ghost, per-card ↻).
- Accepting writes `Plan/Arc` + `Habit` + `Skill/Milestone` rows + Money categories. **Nothing is created until this tap** — the swipe-gate philosophy applies to onboarding too.

## 7. Phase E — DETAIL (optional, skippable, resumable)

Interstitial: *"Five quick things sharpen the coach. Answer now, or I'll ask as we go."* → `Sharpen it` / `Later — take me in`.

| # | Section | Surface | Feeds |
|---|---|---|---|
| E1 | Food pattern | chips: `veg` `egg` `non-veg` `mixed` + `cook · order · mess/canteen` | meal estimates + diet suggestions |
| E2 | Screen time (honest) | slider 1–10h+ with a Fraunces nudge: *"No judgment — calibration."* | Habits targets |
| E3 | Focus | chips: `deep-focus easily` `depends on the day` `easily pulled away` | session lengths, Tools timer default |
| E4 | Career & skills detail | chips (`SWE` `student` `design` `business` `other`+text) + current-level chip per named skill (`new` `some` `solid`) | Skills curriculum depth |
| E5 | Money picture | monthly income (optional, stepper, stored paise) + fixed bills quick-add ("rent 15000" — voice-friendly) | budget realism + RecurringRule seeds |

Each section = 1–2 screens, `Skip` always visible, order-free (a section grid lets users cherry-pick). Exit anytime via `Done` — partial answers persist.

**Backfill contract (the D-015 mechanic):** skipped sections enqueue as `profile_gap` items; the **daily brief asks exactly one** per day, conversationally (*"Quick one — veg, non-veg, or mixed most days?"*), answerable inline in Coach or by voice. Gaps also resurface contextually (first meal estimate with unknown diet → the question card in the capture deck). Settings shows remaining gaps.

## 8. Phase F — Theme (optional, 1 screen)

Three live mini-previews (Ember · Bone · Moss, rendered with real tokens) + light/dark/system toggle. Default preselected: Ember + system mode. `Skip` = defaults. (Full switcher in Settings.)

## 9. Phase G — Landing

Crossfade to **Today**, Day 1: spine populated, the one-time hint row active ("Hold the mic and just say your day."), coach's first line already present — *"Day 1, [name]. Small and consistent beats big and rare."*

## 10. States & edges

| State | Behavior |
|---|---|
| Kill app mid-flow | resume at last answered question (draft persisted locally) |
| Voice answer unparseable | field stays empty, chips pulse once — fall back to tap |
| Spine generation fails (one domain) | that card renders a retry skeleton; others proceed; `start Day 1` allowed with ≥1 spine |
| Returning user (prod) | sign-in on A → skip to G |
| Demo/judge seed | after authenticated signup, opt-in `Try the 12-day demo` clones that user’s seed rows once; a judge/dev-only recording gesture may invoke the same idempotent action |
| Under-18 birthdate | proceeds; Health targets switch to conservative defaults, no weight-loss framing |

## 11. Responsive & a11y

Desktop: question column centered at 520px, backdrop full-bleed. Chips ≥44px, single-column at 320px. Date wheel has typed fallback. Mic parity everywhere (DESIGN §9 "voice never the only path" — inverted here: chips never the only path either). Reduced motion: crossfades only. All scrim text AA in all theme-modes.

## 12. Data contract

- Writes on D-accept: `Plan/Arc`, `Habit[]`, `Skill + Milestone[]`, Money categories (+ `RecurringRule` seeds from E5), `Profile { name, dob, heightCm, weightGrams, dayShape, wake, sleep, timeBudgetMinutes, … }` — integers everywhere (cm, grams, paise, minutes).
- E-partial answers patch `Profile`; skips → `profile_gap` queue (consumed by `brief_daily`).
- Generation: deep tier, one call per domain (parallel), structured output validated against spine schemas.

## 13. Defaults set here (vetoable)

1. CORE is 6 questions — the floor for credible spines; everything else earns its place in DETAIL.
2. Progress hairline covers CORE only.
3. One backfill question per daily brief (never two).
4. Theme step ships in v1 (it's one screen and shows off D-013).
5. Demo seed gesture ships (video insurance).

## 14. Screenshot-verify checklist

A · B1–B6 (incl. unit toggle, B5 multi-domain, voice-fill confirm) · C shimmer · D (4 cards, edited row, regenerate, 1-domain-only variant) · E grid + E1/E2/E5 · F previews (all 3 themes) · G landing · resume state · failed-spine retry — 390px + desktop, Ember Dark + Light.
