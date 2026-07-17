# docs/experience/DESIGN-PROMPTS.md — The Prototype Prompt Chain (Claude Design)

| | |
|---|---|
| **Purpose** | A sequenced set of paste-ready prompts that turn the spec docs into a clickable Sarthi prototype in Claude Design — and double as the build-ticket spine for Codex. |
| **Inputs to upload first** | `docs/experience/DESIGN.md` · `docs/screens/SCREEN-CAPTURE.md` · `docs/screens/SCREEN-TODAY.md` · `docs/screens/SCREEN-ONBOARDING.md` · `docs/screens/SCREEN-COACH.md` · `docs/screens/SCREEN-STATS.md` · `docs/screens/SCREEN-JOURNEY.md` · `docs/screens/SCREEN-TOOLS.md` · `docs/screens/SCREEN-LENSES.md` · `docs/screens/SCREEN-SETTINGS.md` · `docs/experience/FLOWS.md` (+ `docs/product/PRD.md` for context) |
| **Order** | P0 foundation → P1 capture → P2 today → P3 lenses → P4–P9 remaining screens → P10 stitch → P11 theme pass |

---

## 0. How to run the chain

1. **One project, all docs uploaded, prompts in order.** Each prompt builds on the previous output — never skip P0.
2. **One prompt = one working session.** Generate → compare against the prompt's acceptance list → iterate with short follow-ups ("the strip rows should tick in staggered, 40ms") → only then move on. Don't stack two screens in one session.
3. **Iteration language:** reference tokens and spec sections, not vibes. "Card uses `--bg-card` not a grey" beats "make it darker."
4. **Everything is mock data.** The prototype fakes the AI (canned parse results, the 12-day seed persona below). No API calls.
5. **Mobile frame first** (390px). Desktop is a stretch pass at the end, not per-screen.

### The seed persona (use everywhere)
Satvik · Day 12 of a 33-day arc · L4 · 1,240 XP · best streak 6 (5AM wake) · Health: 1,840/2,200 kcal, water 2.1/3L, protein 82/130g, 71.2kg · Money: ₹41,250 balance, safe-to-spend ₹8,400, Food budget 78%, rent ₹15,000 on the 5th · Habits: 6/8 today, meditate streak 2 · Skills: System Design 128:30/500h L3, DSA 42:10/500h · Canonical dump: *"Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10."*

---

## 1. GLOBAL GUARDRAILS — paste at the top of EVERY prompt

```
CONTEXT: Sarthi — a voice-and-photo life coach. One spoken sentence files typed
entries across four domains (Health/Money/Habits/Skills); estimates are confirmed
by swipe; a coach adapts the plan. Specs are in the uploaded docs — docs/experience/DESIGN.md is
law; the screen doc named below is the source of truth for this prompt.

HARD RULES (from docs/experience/DESIGN.md — do not deviate):
- Mobile-first, 390px frame. React + Tailwind. All colors/radii/durations via CSS
  variables — NEVER hardcode a hex in a component.
- Tokens (Ember Dark, the default): canvas #0C0B0A, card #17130E, raised #1E1913,
  line #2A241C, ink1 #F4EFE4, ink2 #A79E8E, ink3 ~55% ink2, energy(amber) #E8913E,
  health #7FB08C, money #D8A24A, habits #8189CF, skills #A97FC9. Radius: card 20px,
  chip 999px, input 14px. One soft shadow max.
- Type: display = Clash Display (fallback Sora) for big numbers/titles; UI = Inter;
  COACH VOICE = Fraunces (every sentence the coach says); stats use tabular-nums.
- Amber appears ONLY on XP/streak/level/Overall. Domain hues mark domain things.
- Calm at rest: one focal element per viewport; no spinners (shimmer skeletons);
  no modal celebrations; no red badges.
- Imagery: use painterly two-stop gradient placeholders per domain hue + subtle
  grain (real art comes later). Text over imagery sits on a dark scrim.
- Motion: 200ms standard ease; springs only for gestures; the ONLY hero motion is
  the level-up amber bloom (≤900ms, inline, once).
- Mock everything; no network. Use the seed persona data provided.
```

---

## P0 — Foundation: tokens, shell, nav, capture bar

**Goal:** the app skeleton every screen mounts into. **Docs:** `docs/experience/DESIGN.md` §2–§7.

```
[GLOBAL GUARDRAILS]

Build the Sarthi app SHELL only — no screen content yet:

1. TOKEN LAYER: a CSS-variable theme system on <html data-theme data-mode>.
   Implement all semantic tokens from docs/experience/DESIGN.md §2a. Ship three themes × two
   modes: Ember (values above + warm-paper light: canvas #FAF6EE, card #FFFDF8,
   ink #1C1710, line #E8E0D2), Bone (editorial: dark canvas #131211/card #181614;
   light #FAF7F2/#FFFFFF), Moss (green-tinted: dark #0B0E0B/#131A14; light
   #F4F7F2/#FDFFFC). Domain hues + amber constant across themes (deepened
   "-strong" variants on light). Add a temporary floating theme-switcher pill
   (top corner) cycling theme+mode so every later screen can be checked in all six.
2. SHELL: bottom nav — 5 tabs (Today, Journey, Coach, Stats, Tools), lucide icons,
   1.5px stroke, active = ink1 + tiny dot; NO labels-only-color states.
3. GLOBAL CAPTURE BAR docked directly above the nav: rounded bar with a mic
   button (≥64px circle), placeholder text "What happened?", small camera icon.
   Static for now (P1 wires it).
4. Header pattern: screen title left, 32px avatar right.
5. Route stubs for the five tabs with placeholder text in each.

ACCEPT WHEN: switching the pill restyles the entire shell live in all 6
theme-modes with AA-readable text; nav+capture bar match docs/experience/DESIGN.md §6; nothing
hardcodes a color.
```

## P1 — Capture sheet (the moat — overbuild this one)

**Goal:** all four states + gestures. **Docs:** `docs/screens/SCREEN-CAPTURE.md` (whole), `docs/experience/FLOWS.md` F3. Expect 2–3 iteration rounds; it's worth it.

```
[GLOBAL GUARDRAILS]

Build the CAPTURE SHEET per docs/screens/SCREEN-CAPTURE.md — a bottom sheet sliding over the
current tab (tab stays visible, dimmed under a scrim; sheet ≈62% height in input,
≈88% in confirm; grabber + ✕).

STATE A — INPUT: prompt line "What happened?"; hero mic (72px) with a fake live
waveform while held (press-and-hold simulation); keyboard toggle → text field;
camera icon; seed chips row: log a meal · add expense · did a session · skipped
something · weigh-in · receipt; micro-history line "Last: lunch ₹340 · 2:10pm".

STATE B — PARSING: input collapses; the raw utterance pinned top in quotes
(Fraunces); 2–3 skeleton cards with a diagonal shimmer (NO spinner).

STATE C — CONFIRM, two visually distinct zones:
(1) "Filed automatically" strip — quiet micro-rows ticking in staggered 40ms:
    ✓ ₹340 · Food | ✓ 500ml water | ✓ 90min · System Design (ok-green check,
    domain-hued left tick, tap = inline edit).
(2) ESTIMATE DECK — Tinder stack (next cards peek at 96/92% scale). Top card:
    domain chip top-left (tap expands to 4-chip domain flip row), confidence dot
    top-right (green ≥.8 / warn .5–.8), estimate in Display type ("≈ 450 kcal"),
    item line ("2 rotis + dal"), "estimated · why?" footer. Gestures: drag right
    = accept (toss + writes), left = discard, tap = edit-in-place (number
    stepper + category chips), long-press = card FLIPS to a "why this number"
    back face in Fraunces with the per-item breakdown + confidence. Mirror
    buttons under the deck: ✕ ✎ ✓. Deck counter "2 of 5".
    Include ONE question card variant: "Which skill was the 90 min?" +
    chips (DSA / System Design / + new).

STATE D — FAN-OUT: accepted entries fly toward a domain summary row
(Health ×2 · Money ×1 · Skills ×1) shrinking into chips; XP "+40" rolls in amber;
then an inline LEVEL-UP bloom (amber radial, ≤900ms, once); coach line fades in
(Fraunces): "Solid lunch under budget — water's ahead of pace. Gym at 6 still
on?"; footer: Done · + Add more.

Wire the flow with the canonical dump (seed persona): mic hold → release plays
A→B→C (strip: ₹340, 500ml, 90min; deck: meal ≈450kcal card + the skill question
card) → resolve → D.

ACCEPT WHEN: the two confirm zones are unmistakably different at a glance; all
four gestures work; the question card blocks nothing else; level-up is inline
and brief; the whole loop runs on mock data end-to-end.
```

## P2 — Today (plan-forward hub)

**Goal:** the home tab. **Docs:** `docs/screens/SCREEN-TODAY.md`, `docs/experience/FLOWS.md` F2.

```
[GLOBAL GUARDRAILS]

Build TODAY per docs/screens/SCREEN-TODAY.md, mounted in the shell's Today tab:

- Header: painterly gradient scene (~180px, shrinks to 64px on scroll) with date;
  slim stat cluster in amber Display: "Day 12 of 33 · 🔥 6 · ◇ L4" (the only
  amber at rest).
- Sticky domain switcher chips: All · Health · Money · Habits · Skills (active =
  domain-hued fill; subtle ink3 pending-dot; selecting a domain swaps the body —
  stub lens bodies with a labeled placeholder for now, P3 fills them).
- Coach line, one sentence, Fraunces ink2.
- PLAN SPINE: "NEXT UP" — exactly ONE card with [Skip](ghost) [Done](domain-hue
  fill) buttons; card has domain left-edge, title, meta (streak/time). "LATER
  TODAY" — compact rows (tap promotes a row into NEXT UP). "COMPLETED (3)" —
  collapsed cluster; expanded rows show ✓ + how ("done" / "via capture" /
  satisfied-by badge "Water ✓ auto from Health · 3.1L" in sage).
- Done: check draws, row settles into Completed, XP ticks in cluster, next item
  rises; the capture bar placeholder flips to "How'd it go?" for a beat.
  Skip: quiet fade-down, "skipped" in ink3, no shame styling.
- One quantified card variant: "Water 3L" with a 20%-opacity domain fill at 70%.
- Seed with the persona's plan (5AM wake done, gym 6pm, 60m system design,
  log spends, water 3L…).

ACCEPT WHEN: only one card ever shows buttons; Done/Skip choreography matches;
completed cluster reads calm; switcher swaps bodies; header collapses on scroll.
```

## P3 — The four lenses

**Goal:** domain bodies behind the switcher. **Docs:** `docs/screens/SCREEN-LENSES.md`, seed persona. Run as **two sessions**: P3a Health + Habits (single-view), P3b Money + Skills (list→drill).

```
[GLOBAL GUARDRAILS]

P3a — Build the HEALTH and HABITS lenses as Today-body swaps per docs/screens/SCREEN-LENSES.md:

HEALTH (sage): header "1,840 / 2,200 kcal" Display + coach read; THREE RINGS —
energy=sage, water=muted aqua, protein=warm tan (lens-local tints; define as
--health-water/--health-protein tokens); meal cards (gradient photo thumb,
items, kcal, confidence chip "est 74%" → tap opens kcal/macros edit; macros
p/c/f row expands); workout row (expandable); weight sparkline 30d + "71.2 kg".
Entry-row grammar everywhere: domain tick left · content · meta right ·
confidence chip on estimates · swipe-left delete with a 5s Undo toast.

HABITS (indigo): header "6 of 8 today" + coach read; checklist rows — habit,
streak flame (amber NUMBER only), tap-circle to complete; ONE satisfied-by row:
"Water 3L ⚡ auto from Health · 2.1/3L" (not hand-tickable — tapping it wiggles
+ shows a hint); month heatmap (7×5 indigo-intensity dots; one hollow-ring
grace day); ONE stacking suggestion strip with [Stack it]/dismiss.

ACCEPT WHEN: rings are glanceable as three distinct metrics; the satisfied-by
row visibly refuses manual ticks; row grammar is identical across both lenses.
```

```
[GLOBAL GUARDRAILS]

P3b — Build the MONEY and SKILLS lenses (list→drill) per docs/screens/SCREEN-LENSES.md:

MONEY (honey): "₹ 41,250 this month" Display; "Safe to spend: ₹ 8,400 til the
31st" hero line (long-press → a small sheet showing the math: balance −
remaining budgets − upcoming recurring); category budget bars (Food 78%, one at
94% in warn); recurring shelf chips (Salary ↑1st · Rent ↓5th · Spotify ↓12th);
ONE dismissible leak strip ("3 food deliveries this week — ₹1,240"); txn list
grouped by day (category chip tap = recategorize popover; income rows in ok-
green). Tap a category bar → CATEGORY DRILL (that category's txns + bar history).

SKILLS (violet): track cards — "System Design · 128:30 / 500h · L3" with meter +
next-session nudge; "+ new skill" card. DRILL: hero counter 128:30:00 → 500h
(tabular Display), meter, coach read; CURRICULUM checklist (✓ done, ▸ current,
○ upcoming, "↻ regenerate rest" affordance); session log rows (🎤/timer source
tags); "Start 50m focus →" chip.

ACCEPT WHEN: safe-to-spend math sheet works; drills push and return cleanly;
the mastery counter is the unmistakable hero of the Skills drill.
```

## P4 — Onboarding

**Docs:** `docs/screens/SCREEN-ONBOARDING.md`, `docs/experience/FLOWS.md` F1.

```
[GLOBAL GUARDRAILS]

Build ONBOARDING per docs/screens/SCREEN-ONBOARDING.md as a standalone flow:

Welcome (gradient scene, "One sentence a day. Four lives in order.", Begin) →
CORE B1–B6, ONE question per screen: name (text) · birthdate (wheel) · body
(height/weight steppers, cm/kg⇄ft/lb) · day shape (chips + wake/sleep dual
slider) · "Pick your battles" (multi-chips per domain incl. "name a skill"
text) · time budget chips. Pattern per screen: question in Display, a Fraunces
why-line, chip/input surface, a small mic bottom-right (decorative here), thin
amber progress hairline (CORE only). Crossfade+rise between questions.
→ GENERATION: four domain chips orbit "Drafting your plans…" (shimmer) →
CONFIRM: four spine cards (domain edge, editable target rows, swipe-row to
drop, Fraunces derivation line "Based on your 30 minutes and 9–5 — here's a
start."), footer "Looks right — start Day 1" (amber) + per-card ↻ →
DETAIL interstitial ("Sharpen it" / "Later — take me in") → a cherry-pick grid
of E1–E5 with Skip everywhere (build E1 food-pattern + E2 screen-time slider
fully; stub the rest) → THEME step: three live mini-previews + light/dark/
system → land on Today with the hint row.

ACCEPT WHEN: core feels ~2 min; skipping detail feels safe (hairline already
full); the confirm cards clearly derive from the answers; theme step actually
switches tokens.
```

## P5 — Coach

**Docs:** `docs/screens/SCREEN-COACH.md`, `docs/experience/FLOWS.md` F6/F7.

```
[GLOBAL GUARDRAILS]

Build COACH per docs/screens/SCREEN-COACH.md — a reading page, not a dashboard (Fraunces-
first, canvas background, only the weekly brief gets a card):

TODAY: evening-recap prose (4 sentences, domain names tinted) ending with one
backfill question + inline answer chips ("veg · non-veg · mixed") that collapse
into the prose on tap ("Mixed diet — noted."). Adaptation chip row under it:
"Gym → home workout" → tap opens the ADAPTATION SHEET: before → after → reason,
[Keep][Revert].
THIS WEEK card: painterly band top; four domain lines each with a micro-
sparkline; a pull-quote observation ("You train hard on days you wake at 5 —
the two are one habit, not two."); one adjustment chip; evidence footer
"Day 8–14 · based on 43 entries" ink3.
EARLIER: collapsed history rows (date · daily/weekly tag · first line), tap
expands in place; month separator.
ASK FIELD docked at bottom (replaces the capture bar on this tab): "Ask your
coach…" + mic; sending streams a canned 3-sentence answer ending in an action
chip [Adjust plan].

ACCEPT WHEN: it reads like a page (measure ~620px feel, generous leading); the
adaptation sheet shows its work; the weekly card is clearly the richest object.
```

## P6 — Stats · P7 — Journey · P8 — Tools (one session each, they're lighter)

```
[GLOBAL GUARDRAILS]

P6 STATS per docs/screens/SCREEN-STATS.md: segmented toggle Current | Potential | Day-1.
OVERALL hero card — amber radial sheen (8–12%) + grain, L4 glyph huge, XP
hairline, Day 12, 🔥6. 2×2 domain grid — domain sheen, headline stat in Display
(Health adherence 81% · Money safe-to-spend ₹8,400 · Habits 🔥6 · Skills
128:30 tabular), two micro-stats, 7-day sparkline, level pip. Toggle flips
cards (rotateY): Potential values in ink2 + "projected" tag ("L6 by arc end");
Day-1 shows "then → now". Card tap → navigates to that lens. One dimmed 60%
no-plan variant with a [Set up] chip.

ACCEPT WHEN: collectible-but-calm (sheen subtle); projections can't be mistaken
for real numbers; the flip feels like turning a card.
```

```
[GLOBAL GUARDRAILS]

P7 JOURNEY per docs/screens/SCREEN-JOURNEY.md: left vertical 2px rail; day nodes (ink3 dots)
+ MILESTONE amber diamonds ("Level 4", "First week complete" — Display labels);
photo cards (gradient placeholder, ≤240px, domain chip, caption "lunch ·
620 kcal", coach line in Fraunces beneath); a collapsed multi-photo day row
("Day 11 · 2 photos ▸" expands in place); text-only days = node only; month
separator; tap photo → full-screen viewer (swipe between, "View entry" link).
Seed ~8 items across 12 days incl. 2 milestones.

ACCEPT WHEN: it scrolls like a memory, not a log; milestones punctuate; the
rail stays continuous.
```

```
[GLOBAL GUARDRAILS]

P8 TOOLS per docs/screens/SCREEN-TOOLS.md v2: 2-col BENTO — Focus (tall anchor, live) ·
Meditation (live) · Afford-it (soon) · Workout Counter (soon) · suggest-a-tool
card (outline style, lightbulb, "Would you like a new tool?"). Cards: gradient
scene, name Display, one-liner, domain tick on the left edge; soon = 60% + ink3
"soon" pip (tap → toast "On the way."). FOCUS SHEET: 25/50/90/custom chips,
skill selector chip (violet), huge tabular countdown, hairline ring, running
state + a slim resume ribbon visible on other tabs, complete = violet pulse +
strip-toast "✓ 50 min → System Design · 129:20 total" with Undo + a "+ note?"
chip. MEDITATION SHEET: pattern chips (Box 4-4-4-4 · 4-7-8 · 5m · 10m), the
breath circle (indigo, grows/holds/shrinks with phase words in Fraunces),
complete = consent chip "Add Meditate to your habits?" then the strip-toast.

ACCEPT WHEN: the grid looks full but calm; both live tools run their loop;
domain ticks make the earning rule visible.
```

## P9 — Settings

```
[GLOBAL GUARDRAILS]

Build SETTINGS per docs/screens/SCREEN-SETTINGS.md — full-height sheet from the avatar; the
QUIETEST screen (grouped 52px rows, no per-row icons): identity header;
APPEARANCE → theme sub-screen with three LIVE preview cards (mini-Today in real
tokens) + Light/Dark/System segment — applying crossfades the whole app behind
the sheet (replace P0's temporary pill with this); PROFILE → "Your details"
(editable onboarding answers; weight edit shows the consequence line "Updating
weight recalibrates your kcal target." → [Save & recalibrate]) + "Coach's open
questions (3)" answerable chip rows; CAPTURE & VOICE toggles (Hold⇄Tap to talk,
Spoken replies Off); COACH rows (brief times, on-open briefs "Morning + weekly");
DATA (Export row, Danger zone sub-screen with typed confirm); DEVELOPER
(collapsed): AI provider Gemini · GPT-5.6 · Claude · Fake with a tier-map
caption, Voice provider row, Seed demo data row.

ACCEPT WHEN: theme preview cards are real token renders; the provider row
exists (the live-demo moment); danger zone can't be hit accidentally.
```

## P10 — Stitch pass (flows, not screens)

```
[GLOBAL GUARDRAILS]

No new screens. Wire the FLOWS per docs/experience/FLOWS.md so the prototype demos end-to-end:
F3 capture loop from any tab (canonical dump → confirm → fan-out → Today items
auto-check with "via capture" + the satisfied-by badge updating) · F2 Done →
"How'd it go?" capture-bar flip · F8 Skills drill "Start 50m focus" → Focus
sheet pre-set → complete → counter ticks up · Stats card tap → lens · Journey
photo → viewer · avatar → Settings → theme apply live. Then run FLOWS F11
(the demo script) start to finish and fix every seam it exposes.

ACCEPT WHEN: the F11 shot list can be performed in the prototype without a
dead end.
```

## P11 — Theme & polish pass

```
[GLOBAL GUARDRAILS]

Sweep every screen in all SIX theme-modes (Ember/Bone/Moss × light/dark):
fix contrast to AA (use the -strong domain variants on light), tune the Bone/
Moss surface values where they feel off, verify amber discipline (nothing amber
that isn't XP/streak/level), verify shimmer-not-spinner everywhere, verify the
coach never speaks outside Fraunces. Output: a list of every token value you
changed (to fold back into docs/experience/DESIGN.md).
```

---

## 2. Mapping to Codex (this doc's second life)

The chain **is** the frontend build plan. In Codex: P0 = the token layer + shell ticket (Day 1 alongside the pipeline) · P1–P3 = Day 1–2 UI tickets (capture with Health first — matches the milestone table) · P4–P9 = Day 3–4 · P10 = the integration gate before eval · P11 = the screenshot-verify pass (`.verify/screens/`, per each screen doc's checklist). Differences from the prototype: real components consume the real stores/AI SDK instead of mocks; otherwise the acceptance lists transfer verbatim as ticket DoD. Keep prototype code as *reference*, not gospel — Codex builds fresh (provenance rule), with the prototype open in a second window as the visual target.

## 3. If a generation fights you

Re-anchor with three moves: (1) restate the token rule + the specific spec section; (2) shrink scope ("only State C this round"); (3) paste the acceptance list and ask it to self-check. If a screen is 80% right, iterate — regenerating from scratch loses the 80%.
