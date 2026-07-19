# docs/screens/SCREEN-TODAY.md — Today (the daily hub)

| | |
|---|---|
| **Role** | The home tab. **Plan-forward (locked D-014):** what's left to do today, per domain. Not a feed — the raw entry log lives inside each lens. |
| **Pattern** | Life Reset's plan spine: pending challenges stacked, Done/Skip exposed on the *next* one only, completed items settle in place. |
| **Entry points** | App open (default tab) · fan-out dismiss · notification taps |
| **Inherits** | `docs/experience/DESIGN.md` tokens/motion/don'ts · capture bar per DESIGN §6 |

> **SAR-019A / D-048 amendment:** the plan remains forward-looking, but every
> remaining item is now an art-led card. Right swipe is Done and left swipe is
> Skip; each card retains visible 44px actions and keyboard equivalence. The
> underlying scoped status write, capture nudge, XP, and completed-settle rules
> below are unchanged.

---

## 0. The one-sentence spec

Open the app → one painterly scene, one slim progress cluster, one coach line, and the day's remaining challenges in a calm stack — Done/Skip on the next one, capture bar below for everything messier.

## 1. Screen anatomy (All view, top → bottom)

```
┌─────────────────────────────────────┐
│  HEADER SCENE (painterly, scrim)    │  ← time-of-day variant
│  "Wednesday, Jul 15"    [avatar]    │
│  Day 12 of 33        🔥 6   ◇ L4    │  ← slim stat cluster (amber)
├─────────────────────────────────────┤
│  ( All | Health | Money | Habits | Skills )   ← switcher chips
├─────────────────────────────────────┤
│  coach line — Fraunces, one line    │
├─────────────────────────────────────┤
│  NEXT UP                            │
│  ┌───────────────────────────────┐  │
│  │ ● Habits · 5AM wake            │  │  ← the ONLY card with
│  │   streak 6 · by 5:10 today     │  │     [ Skip ]  [ Done ]
│  └───────────────────────────────┘  │
│  LATER TODAY                        │
│  ▫ Health · Gym — push day   6pm    │  ← compact rows, no buttons
│  ▫ Skills · 60m System Design      │
│  ▫ Money · Log today's spends      │
│  COMPLETED (3)              ▾       │  ← settled cluster, collapsed
├─────────────────────────────────────┤
│  [ 🎤  What happened?      📷 ]     │  ← global capture bar
│  [ Today · Journey · Coach · … ]    │  ← nav
└─────────────────────────────────────┘
```

## 2. Header

- **Scene:** full-bleed painterly image under `--scrim`, ~180px tall (shrinks to a 64px bar on scroll, date + cluster persist). **Time-of-day variants:** dawn (<9), day (9–17), dusk (17–21), night (>21) — 4 pre-generated assets per arc theme; gradient placeholder until art lands.
- **Slim stat cluster** (the *only* amber on this screen at rest): `Day 12 of 33` (arc) · `🔥 6` (best active streak) · `◇ L4` (overall level). Display type, tabular. Tap cluster → Stats tab. No rings, no bars, no grid — one line (DESIGN "calm at rest").
- Avatar top-right → Settings/Profile sheet (D-016).

## 3. Domain switcher (chip bar)

- Sticky under the header: `All · Health · Money · Habits · Skills`. Active chip = domain-hued fill; inactive = `--bg-card` outline.
- Selecting a domain **swaps Today's body to that domain's full lens** (nav stays on Today — a lens *is* Today's body; specs in `docs/screens/SCREEN-LENSES.md`). `All` restores the plan spine.
- Swipe left/right anywhere on the body also moves between chips (crossfade at `--t-base`, no parallax carnival).
- Chips carry a subtle dot when that domain has pending items (`--ink-3` dot; never a red badge — calm).

## 4. Coach line

One sentence, Fraunces, `--ink-2`, from the morning brief (deep tier): *"Leg day and a lighter lunch today — rent posts tomorrow, so keep spends under ₹600."* Tap → Coach tab. Refreshes after each capture fan-out. Never two lines; truncate with an ellipsis that opens Coach.

## 5. The plan spine (the core)

### 5a. Ordering & grouping
- **NEXT UP** — the first card remains the visual lead, highest-priority pending item: time-anchored items due soonest first; otherwise habit-cadence order.
- **LATER TODAY** — remaining pending items use the same art-card grammar at a quieter scale. Every card can be acted on directly; the UI retains order but no longer artificially blocks a deliberate action.
- **COMPLETED (n)** — collapsed cluster at the bottom; expands to settled rows with `--ok` checks and how each completed (Done tap / auto via capture / satisfied-by badge). Skipped items land here too, marked quietly (`--ink-3` "skipped"), no shame styling.

### 5b. The NEXT UP card
- `--bg-card`, domain-hued left edge, title in title type, meta line beneath (streak count, target, time).
- Actions: **[ Skip ]** ghost button (left) · **[ Done ]** filled domain-hue button (right). 44px min.
- **Done:** check draws in (`--t-fast`), row settles downward into COMPLETED (DESIGN §5.6), XP ticks in the cluster (+amber roll), next pending item rises into NEXT UP at `--t-base`. Then the capture bar placeholder swaps to **"How'd it go?"** for 30s — tap/hold routes into the capture sheet with that item as the parse hint (the reflection layer that powers adaptation).
- **Skip:** row fades + slides down into COMPLETED as "skipped"; capture bar nudges *"What got in the way?"* (same 30s, optional). The coach uses skips in the evening recap — the UI never scolds.
- Quantified challenges (e.g., "3L water") show a micro-progress fill inside the card (domain hue at 20% opacity) fed by captured entries; **Done auto-fires when the metric is met.**

### 5c. Auto-completion & satisfied-by
- Entries captured via the sheet check off matching plan items in place (a meal logged → "Log lunch" completes with a `via capture` tag).
- `satisfied_by` habits complete themselves with a **badge row**: `Water ✓ auto from Health · 3.1L` — badge in the source domain's hue. No double entry, and the mechanic is *visible* (glass-box).

## 6. States

| State | Behavior |
|---|---|
| **Fresh morning** | full spine, NEXT UP = first morning habit; dawn scene |
| **All done** | spine collapses to a single quiet celebration card — scene brightens, "Day 12 complete." + coach's evening line + `View recap` → Coach. No confetti storm; one amber pulse. |
| **Nothing planned** (onboarding skipped a domain) | that domain's rows absent; a single `--ink-3` row: "No Money plan yet — set one up" → onboarding section resume |
| **Rest day** (plan says so) | NEXT UP becomes a rest card (scene + "Recovery day — stretch, hydrate"), capture bar still live |
| **Mid-arc day N** | default anatomy above |
| **Arc complete** | full-screen takeover ONCE (the exception to no-modal): completion scene + arc summary → Journey milestone. Next arc CTA. |
| **New user, onboarding done <24h** | spine + a one-time dismissible hint row under the switcher: "Hold the mic and just say your day." |

## 7. What Today deliberately does NOT have

No entry feed (lenses own it) · no charts (Stats owns them) · no brief history (Coach owns it) · no more than one actionable card · no badges/red dots · no pull-to-refresh spinner (background refresh, shimmer only on first load).

## 8. Responsive & a11y

- Desktop: spine in the 720px column; header scene 220px; switcher chips left-aligned; NEXT UP actions become keyboard-reachable (`D` done, `S` skip when focused).
- Rows ≥ 56px; Done/Skip ≥ 44px; switcher swipe has chip-tap equivalence.
- Time-of-day scenes are decorative — date/cluster text meets AA on scrim in all theme-modes.
- Screen reader order: date → cluster → coach line → NEXT UP (with actions) → later list → completed.

## 9. Data contract

- Reads: `Plan/Arc` (day items, cadence, targets) · `Progress` (xp, level, streak) · domain metrics for quantified fills + `satisfied_by` · morning `CoachNote`.
- Writes: `HabitLog`/plan-item status on Done/Skip (source: `tap`) · nothing else — all richer writes go through the capture sheet.
- Auto-complete listeners: on `commit_entry`, re-evaluate matching plan items + satisfied-by rules.

## 10. Defaults set here (vetoable)

1. **One actionable card** (NEXT UP) — tapping a later row promotes it rather than exposing buttons everywhere.
2. **"How'd it go?" nudge lives in the capture bar** for 30s after Done/Skip (not a popup).
3. **Completed cluster collapsed by default**, count visible.
4. Chip pending-dots in `--ink-3` (no colored badges).
5. Arc-completion is the single allowed full-screen moment.

## 11. Screenshot-verify checklist

Fresh morning · mid-day with 2 completed · NEXT UP Done animation frame · Skip state · quantified fill at 60% · satisfied-by badge · all-done evening · rest day · no-plan domain row · onboarding hint · each domain chip active (lens swap smoke test) — 390px + desktop, Ember Dark + Light minimum; dawn/dusk scene variants.
