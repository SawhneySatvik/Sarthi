# docs/screens/SCREEN-TOOLS.md — Tools (the bento shelf) · v2

| | |
|---|---|
| **Role** | A bento grid of independent, **AI-specialized** tools — each one writes into a domain store (the earning rule, locked D-017). Re-locks the earlier "one timer" spec. |
| **Roster** | Pomodoro/Focus · Meditation · Afford-it check · Workout Counter — **2+ live at v1, rolling basis**; the rest ship as coming-soon cards + a suggest-a-tool card. |
| **Inherits** | `docs/experience/DESIGN.md` — tokens, imagery (painterly house style, NOT the reference's anime look), motion, don'ts |

---

## 0. The one-sentence spec

A calm bento wall of specialist tools — tap one, it opens full-sheet, does one thing beautifully, and files what it measured into the right domain.

## 1. The earning rule (what keeps this from becoming the drawer)

Every tool must **write into a domain store** — measured or AI-derived, but always filed. No dead utilities. Consequences already applied: *Screen Blocker* is native-app roadmap only (web apps can't block other apps — never show it as buildable); *Book Summary* dropped (feeds nothing); *Expense Tracker* dropped (capture + Money lens IS the tracker); *Meal Planner* dropped from roster (not selected; roadmap candidate).

## 2. Grid anatomy

```
┌─────────────────────────────────────┐
│  Tools                     [avatar] │
│  Tap a tool to start        (--ink-2)│
├─────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐     │
│  │ FOCUS      │  │ MEDITATION │     │   ← live cards
│  │ (tall)     │  └────────────┘     │     2-col bento, varied
│  │            │  ┌────────────┐     │     heights (tall/square)
│  └────────────┘  │ AFFORD IT? │soon │   ← coming-soon: dimmed
│  ┌────────────┐  └────────────┘     │     60%, "soon" pip
│  │ WORKOUT    │  ┌────────────┐     │
│  │ COUNTER soon│ │ + suggest  │     │   ← suggest-a-tool card
│  └────────────┘  └────────────┘     │
└─────────────────────────────────────┘
```

- **Card anatomy:** painterly scene full-bleed under `--scrim` · tool name (Display) · one-line description (`--ink-2`) · domain tick on the left edge (the hue of the store it writes to — the earning rule made visible).
- **Live card:** full opacity, tap → tool opens as a **full-height sheet** (same pattern as capture — grabber, over-the-tab).
- **Coming-soon card:** 60% opacity, `soon` pip (`--ink-3`, never amber); tap → one quiet toast "On the way." No teaser modals, no notify-me capture in v1.
- **Suggest card:** `--bg-card` outline style (no scene), lightbulb icon, "Would you like a new tool?" → opens a one-field sheet; submission acknowledges for the current session only. Persistent feedback collection is deferred rather than adding a generic row.
- Layout: CSS grid, 2 columns mobile; live tools sort first, Focus always the tall anchor card.

## 3. Tool specs

### 3a. Focus / Pomodoro — LIVE #1 (→ Skills, violet)
Unchanged from v1 spec, now sheet-based: durations `25 · 50 · 90 · custom` · required skill selector (defaults to most recent; `+ new` creates a Skill) · running state persists app-wide with a resume ribbon above the nav · complete = one violet pulse + writes `Session { skillId, minutes, source:'timer' }` because user explicitly started the measured timer; it uses the same latest-batch commit and five-minute Undo path as capture · `+ note?` chip → capture sheet pre-framed · any abandoned timer asks `Log X min / Discard` before it writes · mastery caption `128:30 → 500h` under Start (same counter as the Skills lens).

### 3b. Meditation / Breathing — LIVE #2 target (→ Habits, indigo)
- Idle: pattern chips `Box 4-4-4-4` · `4-7-8` · `Calm 5m` · `10m` · scene + a breath circle preview.
- Running: the **breath circle** — a soft indigo circle scaling with the phase (inhale grow / hold / exhale shrink), phase word in Fraunces ("in… hold… out…"), optional TTS voice guidance (off by default, DESIGN default). Countdown small, tabular.
- Complete: one indigo pulse · writes `HabitLog { habit_id: meditate, status: done, source:'tool' }` + minutes in the log note (creates the "Meditate" habit on first use, with consent chip: "Add Meditate to your habits?") · strip-toast with Undo · Today's matching item auto-checks.
- Reduced motion: circle → opacity fade between phases.

### 3c. Afford-it check — coming-soon → live rolling (→ Money, honey)
- Input: amount + item, text or voice ("can I spend 3k on shoes?").
- **Deep tier** answers over the real ledger: safe-to-spend, upcoming recurring posts, category budget state → a verdict card: `Yes, comfortably` / `Tight — rent posts Friday` / `Not this month`, with the math shown beneath (glass-box: the three numbers it used).
- Writes: nothing by default; a `Bought it → log ₹3,000` chip files the Transaction through the standard commit path.
- This is the Money AI's "can I afford X?" job (PRD §8) given a front door.

### 3d. Workout Counter — coming-soon (→ Health, sage)
Sets/reps/load logger for the gym: exercise chips (recent-first) · big steppers for reps/load · rest timer between sets · finish writes one `Workout { exercises[], duration_min }` row (explicit values) → Health lens + Today auto-check. Designed for one-thumb use at the rack.

## 4. States

| State | Behavior |
|---|---|
| v1 launch | Focus + Meditation live; Afford-it + Workout Counter as coming-soon; suggest card last |
| Tool flips live (rolling) | card brightens; one-time `new` pip (`--ink-3`) until first open |
| Timer/breath session running, user browses grid | running card shows a live pip + elapsed; resume ribbon rule applies |
| No skills yet (Focus) | selector → mini-sheet: pick existing or name new |
| Afford-it with <7 days of Money data | verdict prefaced honestly: "Early guess — I've only seen 4 days." |
| Suggestion submitted | card flips to "Noted — thank you." for the session |

## 5. Responsive & a11y

Desktop: 3-column bento in the 720px column, Focus stays the anchor. All cards ≥44px targets; scene text AA under scrim in all theme-modes. Breath circle phases announced for screen readers; TTS guidance is the a11y-preferred mode when on. Reduced motion per DESIGN §5.

## 6. Data contract

Writes per tool (§3): `Session` (Focus) · `HabitLog` (Meditation) · optional `Transaction` (Afford-it) · `Workout` (Counter) — all through the typed commit path, all explicit values, all covered by latest-batch Undo, all feeding XP + Today auto-complete listeners. Reads: `Skill[]`, `Habit[]`, Money ledger/budget/recurring (Afford-it, deep tier). Suggest card persists nothing in v1.

## 7. Defaults (vetoable)

1. Live priority order: Focus → Meditation → Afford-it → Workout Counter.
2. Coming-soon tap = toast only (no notify-me list in v1).
3. Meditation TTS guidance off by default.
4. Focus is always the tall anchor card; live tools sort before coming-soon.

## 8. Screenshot-verify checklist

Grid (2 live + 2 soon + suggest) · Focus sheet (idle/running/complete/abandon) · Meditation (pattern pick/breath circle mid-phase/complete + consent chip) · Afford-it verdict (yes/tight/early-data) · coming-soon toast · suggestion flip · resume ribbon — 390px + desktop, Ember Dark + Light.
