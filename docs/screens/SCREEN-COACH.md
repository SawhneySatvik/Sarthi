# docs/screens/SCREEN-COACH.md — Coach (the reading room)

| | |
|---|---|
| **Role** | The anti-churn surface. Where the coaching *compounds*: morning plan, evening recap, the weekly brief, history, and an ask field. Feels like a person, not a dashboard. |
| **Tone** | Calm, text-forward, Fraunces-first, barely gamified. The one tab with almost no chrome. |
| **Inherits** | `docs/experience/DESIGN.md` · coach = deep tier (briefs) + fast tier (inline answers) |

---

## 0. The one-sentence spec

A quiet thread of the coach's readings of your life — today at top, the weekly brief as the rich card, history beneath, and a field to ask it anything.

## 1. Anatomy (top → bottom)

```
┌─────────────────────────────────────┐
│  Coach                     [avatar] │
├─────────────────────────────────────┤
│  TODAY — morning plan / evening     │  ← the ritual card
│  recap (state-dependent, Fraunces)  │
│  · adaptation chips (if any)        │
├─────────────────────────────────────┤
│  THIS WEEK — weekly brief card      │  ← richer: 4 domain lines +
│  (Sun evening onward)               │    one observation + one adjustment
├─────────────────────────────────────┤
│  EARLIER — collapsed history thread │
├─────────────────────────────────────┤
│  [ Ask your coach…            🎤 ]  │  ← ask field (text + voice)
└─────────────────────────────────────┘
```

Canvas is `--bg-canvas` with generous leading — a reading page, not cards-on-cards. Only the weekly brief gets full card treatment.

## 2. TODAY card (the ritual)

- **Morning (until first evening recap):** the plan in prose — 3–5 sentences, Fraunces, `--ink-1`. Domain names inline get their hue tint. Ends with one **backfill question** if `profile_gap`s exist (D-015) — answer chips render inline beneath it.
- **Evening (after ~19:00 or all-done):** the recap — what happened, what it means, one line per domain that moved. Honest, never scolding: *"You skipped the gym and logged why — travel days need a lighter default. Tomorrow's plan reflects that."*
- **Adaptation chips (glass-box):** when the plan changed, a chip row under the prose: `Gym → home workout` · `Lunch budget ↓`. **Tap a chip → the Adaptation sheet:** before → after + reason (from `Adaptation{before, after, reason}`), with `Keep` / `Revert`. Adaptation is *shown and reversible*, never silent.

## 3. THIS WEEK card (the compounding wow)

- Appears Sunday evening; pinned for the week. `--bg-card`, slightly taller, a thin painterly band at top.
- Structure: **four domain trend lines** (one sentence each, domain tick + micro-sparkline drawn from real entries) → **one honest observation** (Fraunces, pull-quote weight: *"You train hard on days you wake at 5 — the two are one habit, not two."*) → **one adjustment** (chip → Adaptation sheet).
- Footer: `Day 8–14 · based on 43 entries` (`--ink-3`) — evidence line, glass-box again.

## 4. EARLIER (history thread)

Reverse-chron, collapsed rows: date · scope tag (`daily` / `weekly`) · first line. Tap expands in place. Weekly briefs get the card treatment when expanded; dailies stay prose. Infinite scroll, month separators. No search in v1 (roadmap).

## 5. Ask field

- Docked above the nav (replaces the global capture bar **on this tab only** — asking *is* this tab's capture). Placeholder: *"Ask your coach…"*, mic parity.
- Answers stream in as a thread item above the field (fast tier; deep tier when the question touches plans/money math — router decides by intent). Answer style: 2–4 sentences, Fraunces; may end with an action chip (`Adjust plan` → Adaptation sheet, `Log it` → capture sheet pre-framed).
- Q&A items live in the thread but visually lighter (`--ink-2`) than briefs — the ritual stays the spine.
- Guardrail: money/health answers stay informational + plan-scoped; no advice-beyond-data (ties to eval "adaptation sanity").

## 6. States

| State | Behavior |
|---|---|
| Day 1, no entries | TODAY = first plan + a warm two-liner; no weekly card; history empty (no empty-state art — the plan *is* the content) |
| Pre-Sunday week 1 | weekly slot absent entirely (not a locked teaser) |
| Brief generating | prose skeleton shimmer, 2 lines |
| Brief failed | yesterday's card stays + quiet `↻ retry` row |
| Backfill answered | chips collapse into the prose ("Mixed diet — noted.") with a `--t-fast` settle |
| 3+ days inactive | TODAY opens with re-entry prose, plan auto-lightened (an Adaptation, chip shown) — never a guilt wall |

## 7. Responsive & a11y

Desktop: single 620px reading column (narrower than app column — reading measure). Ask field fixed bottom. Expanded rows keyboard-toggleable. Sparklines have text equivalents ("Health: 5 of 7 days on target"). AA for Fraunces at body+1 on canvas in all theme-modes.

## 8. Data contract

- Reads: `CoachNote{scope: daily|weekly}` thread · `Adaptation[]` · `profile_gap` queue · entry counts for evidence lines.
- Writes: `brief_daily`/`brief_weekly` triggers (schedule + on-open staleness check) · gap answers → `Profile` · ask-field turns (session-scoped in v1; thread-persisted = roadmap) · `Adaptation` keep/revert.
- Tiers: briefs = deep; ask default = fast with deep escalation; backfill parse = fast.

## 9. Defaults (vetoable)

1. Ask field replaces the capture bar on this tab only.
2. Weekly brief generates Sunday evening (arc-relative later).
3. Q&A is session-visible but not permanently threaded in v1.
4. Evening recap flips at 19:00 or on all-done, whichever first.

## 10. Screenshot-verify checklist

Morning plan · evening recap · adaptation chips + sheet · weekly brief (full) · evidence footer · backfill question + answered settle · history expanded (daily + weekly) · ask Q&A streamed · Day-1 · re-entry — 390px + desktop, Ember Dark + Light.
