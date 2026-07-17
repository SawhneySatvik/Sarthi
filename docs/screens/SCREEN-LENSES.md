# docs/screens/SCREEN-LENSES.md — The Four Domain Lenses

| | |
|---|---|
| **Role** | Each domain's full review experience over its own typed tables. **Deliberately unalike** — a ledger, a dashboard, a grid, a curriculum. This is where the raw entry feed lives (Today stays plan-forward). |
| **Where they render** | As **Today's body** when a domain chip is selected (nav stays on Today) · via Stats card tap (activates the chip) · via deep links (Journey "view entry", capture strip rows) |
| **Shape** | Health & Habits = single-view · Money & Skills = list → drill |
| **Inherits** | `docs/experience/DESIGN.md` · capture bar persists beneath every lens |

---

## 0. Shared lens conventions (all four)

- **Header:** domain name in the domain hue (caption) + one headline number (Display) + a one-line coach read (Fraunces, `--ink-2`) specific to the domain today.
- **Entry rows everywhere obey one grammar:** left domain-hue tick · content · meta right (time/amount) · **confidence chip on estimated values** (tap = edit, long-press = why — same glass-box as the capture card). Swipe row left = delete through the latest commit-batch path (one five-minute Undo). Every number the AI estimated is editable *here*, forever — corrections edit in place (no duplicates), matching the capture "edit card" path.
- **Add is always the capture bar** — lenses have no separate "+" forms. The one exception: Habits checklist ticks (binary, explicit).
- Lens-local sub-colors are allowed **inside a lens only** (see Health rings) as tokens; they never leak to the rest of the app.
- Empty day sections collapse; the lens never renders a wall of zeros.

---

## 1. MONEY — the ledger (honey · list → drill)

### 1a. Anatomy (top → bottom)
```
₹ 41,250 this month          ← headline: balance (Display)
Safe to spend: ₹ 8,400 til the 31st   ← the hero derived number
"Rent posts Friday — the dip is planned."  ← coach read
──────────────────────────────
BUDGETS   Food ▮▮▮▮▮░ 78%  · Transport ▮▮░ 34% · …   ← category bars
RECURRING SHELF   Salary ↑1st · Rent ↓5th · Spotify ↓12th   ← horizontal chips
LEAK STRIP   "3 food deliveries this week — ₹1,240"   ← one insight, dismissible
──────────────────────────────
TODAY        Lunch · Food        −₹340   [est ✓]
             Auto: Spotify       −₹119   ↻
YESTERDAY    …                              ← txn list, day-grouped
```

- **Safe-to-spend** = balance − remaining budgeted − upcoming recurring till month end. Long-press = the math (glass-box).
- **Budget bars:** category chips with fill; >90% turns `--warn`, over turns `--danger` (the only status colors in the lens). **Tap a category → drill:** that category's txns + its bar history (the multi-item behavior).
- **Recurring shelf:** upcoming auto-posts as chips (↑ income / ↓ expense, next date). Posted ones show `↻` in the feed. Tap = edit rule / pause.
- **Leak strip:** exactly one AI insight at a time (fast tier, daily), dismissible; never a stack of nags.
- **Txn rows:** merchant/note · category chip (tap = recategorize) · amount right (tabular; income in `--ok`).

### 1b. States
Day 1 (no txns): budgets render at 0 with the coach read "Say a spend out loud — I'll file it." · No budget set: bars replaced by `Set budgets` chip → onboarding E5 resume · Category drill empty · Month rollover: headline animates to the new month, last month collapses into a summary row.

### 1c. Data contract
Reads `Transaction[]`, `RecurringRule[]`, categories/budgets, derived safe-to-spend. Writes: recategorize, edit amount, delete+undo, rule pause — all via `commit_entry` edit path. All amounts in paise, rendered ₹.

---

## 2. HEALTH — the dashboard (sage · single-view)

### 2a. Anatomy
```
1,840 / 2,200 kcal            ← headline: energy in vs target
"Protein's lagging — eggs at dinner?"   ← coach read
( ◔ energy  ◑ water  ◕ protein )        ← the three rings
──────────────────────────────
MEALS   [photo] Lunch — rotis + dal   620 kcal  [est 74%]
        Breakfast — eggs, toast       410 kcal  [est ✓]
WORKOUT  Push day · 48 min · ≈310 kcal burn  [est]
WEIGHT   71.2 kg  ▁▂▂▃▂▁ 30d           ← sparkline + last weigh-in
```

- **Rings:** energy (in vs out incl. workout burn) · water (vs target) · protein (vs target). **Per-metric tints (lens-local tokens, resolves the last open UI question):** energy = sage `--dom-health` · water = muted aqua `--health-water` · protein = warm tan `--health-protein`. Three same-hue rings are unreadable at a glance; these tints exist only inside this lens. Ring tap → that metric's day detail.
- **Meal cards:** photo thumb (if any) under scrim · items · kcal (Display, small) · **confidence chip** (`est 74%` — tap edits kcal/macros, long-press = why breakdown per item). Macros row (p/c/f, tabular) expands on tap.
- **Workout row:** name · duration · burn estimate with chip; expands to exercises/sets.
- **Weight:** 30-day sparkline + last value; weigh-ins come via capture ("71.2 today").

### 2b. States
No meals yet today: rings at 0 with "What did you eat?" read · No targets (onboarding B3 skipped): rings show `Set targets` → backfill question fires · Photo-less meals render text-only cards · Overshoot day: energy ring overfills in `--warn` past 100%, coach read stays kind.

### 2c. Data contract
Reads `Meal[]`, `Water[]`, `Workout[]`, `Weighin[]`, targets from Profile. Writes: kcal/macro edits, deletes+undo. Units: kcal int, millilitres int, grams int, `weightGrams` int; display conversion happens at the UI edge.

---

## 3. HABITS — the streak grid (indigo · single-view)

### 3a. Anatomy
```
6 of 8 today                   ← headline: today's completion
"Wake streak's carrying the week."       ← coach read
──────────────────────────────
CHECKLIST
● 5AM wake        🔥 6         ✓done
● Meditate        🔥 2         ○   ← tap circle = done (explicit)
● Water 3L        ⚡ auto from Health · 2.1/3L   ← satisfied-by badge
● No sugar        —            ○
──────────────────────────────
MONTH   [heatmap: 7×5 dots, indigo intensity = % complete]
STACKING  "You meditate after waking 5/6 times — make it official?" [Stack it]
```

- **Checklist rows:** habit · streak flame (amber **only** on the number, per color law) · state circle. Tap circle = done (source `tap`); tap row = habit detail sheet (history, cadence, difficulty, satisfied-by config, pause).
- **Satisfied-by rows** show the live source metric and hue (`⚡ auto from Health`); they can't be hand-ticked (the metric is the truth) — long-press explains the rule.
- **Heatmap:** current month, indigo intensity by day-completion %; tap a day = that day's checklist snapshot. Humane-grace days (streak protected) get a hollow ring, not a gap.
- **Stacking strip:** one AI suggestion max (fast tier, weekly), with a one-tap `Stack it` (sets the habit's anchor) or dismiss.

### 3b. States
All done: headline flips to "8 of 8 — clean day." with one indigo pulse · New habit (from coach/capture): slides into the list with a `new` pip · Paused habits sink to a collapsed group · Broken streak: flame resets quietly, no funeral animation; the coach mentions it in the evening recap instead.

### 3c. Data contract
Reads `Habit[]`, `HabitLog[]`, satisfied-by source metrics, streaks from `Progress`. Writes: `HabitLog` on tick (explicit), habit edits/pause, stack anchor. Grace logic lives in the game layer, surfaced here as the hollow ring.

---

## 4. SKILLS — curriculum + hours (violet · list → drill)

### 4a. List view
```
SKILLS                          ← track cards, one per skill
┌ System Design ────────────┐
│ 128:30 / 500h  ▮▮▮░░  L3   │   ← mastery meter + counter (Display, tabular)
│ next: "Design a rate limiter"│  ← next-session nudge
└────────────────────────────┘
┌ DSA ───────────────────────┐ …
[ + new skill ]                 ← name anything → AI roadmap
```

### 4b. Drill (one skill)
```
System Design        128:30:00 → 500h      ← the cumulative counter, hero
▮▮▮▮▮▮░░░░  L3 · 26%
"Two sessions this week — checkpoint Sunday?"   ← coach read
──────────────────────────────
CURRICULUM  ✓ Fundamentals  ✓ Caching  ▸ Rate limiting  ○ Sharding …
            ← AI-generated milestones, checkable; [↻ regenerate rest]
SESSIONS    Tue · 90m · "consistent hashing" · 🎤
            Mon · 50m · timer
NEXT        [ Start 50m focus → ]   ← deep-links the Tools Focus timer, skill pre-set
```

- **Counter:** `HH:MM:SS` tabular Display — the mastery moment; ticks live if a Focus session is running.
- **Curriculum:** milestone checklist from onboarding/`+ new` generation (deep tier). Manual check-off allowed; `▸` marks the AI's suggested current milestone. `↻ regenerate rest` re-plans *unchecked* milestones only (done stays done). Milestone check → small violet pulse + the coach may adapt the next-session nudge.
- **Sessions log:** source-tagged rows (🎤 capture / timer / typed), minutes tabular; standard row grammar (edit/delete/undo).
- **Next-session nudge:** one line + a `Start Nm focus →` chip that opens the Tools Focus sheet with skill + duration pre-set (the two surfaces are one loop).
- **Thresholds:** crossing 10/100/500h fires the milestone treatment (Journey marker + one violet-to-amber pulse here).

### 4c. States
No skills: single invite card "Name anything — I'll build the road." (voice ok) · Roadmap generating: curriculum skeleton shimmer · Regenerate keeps checked items pinned · Dormant skill (14d+): card dims 80%, nudge softens ("pick it back up with 25m?").

### 4d. Data contract
Reads `Skill[]`, `Milestone[]`, `Session[]`, mastery/levels from `Progress`. Writes: milestone toggles, session edits/deletes, new-skill create → deep-tier `generate_roadmap`, regenerate. Minutes int; counter derived.

---

## 5. Responsive & a11y (all lenses)

Desktop: lenses fill the 720px column; Money/Skills drills open as a right-side detail pane instead of a push. Heatmap dots ≥16px with day-labels for screen readers; rings have text equivalents ("water 2.1 of 3L"); every swipe-delete has a row-menu equivalent. AA per theme-mode, including lens-local tints (`--health-water`, `--health-protein` get `-strong` variants).

## 6. Defaults set here (vetoable)

1. **Health rings = per-metric lens-local tints** (sage / aqua / tan) — resolves the last open UI question; all-sage rejected for glanceability.
2. Leak strip and stacking strip each show **exactly one** suggestion at a time.
3. Satisfied-by rows are never hand-tickable.
4. Skills `↻ regenerate` touches unchecked milestones only.
5. Money drill = category-level in v1 (merchant-level roadmap).

## 7. Screenshot-verify checklist

**Money:** full ledger · category drill · budget >90% · recurring shelf · leak dismissed · Day-1. **Health:** three rings mid-fill · overshoot · meal card + macro expand + why-flip · no-targets. **Habits:** checklist mixed states · satisfied-by live · heatmap + grace ring · stacking strip. **Skills:** track list · drill with live-ticking counter · curriculum regenerate · empty-invite · dormant card. All at 390px + desktop smoke, Ember Dark + Light; rings/heatmap once in Bone + Moss (tint tuning).
