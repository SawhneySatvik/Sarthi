# Sarthi — docs/experience/DESIGN.md (Design Rules)

| | |
|---|---|
| **Status** | Locked design law. Screen MDs inherit everything here and may not contradict it. |
| **Scope** | Tokens & themes · type · color law · motion · layout · components · imagery · accessibility |
| **Date** | 2026-07-15 |

> North star: **calm at rest, expressive at progress.** Fewer elements than the reference app, celebration earned and brief. Every screen serves the capture loop.

---

## 1. Principles (inherited by every screen)

1. **Calm at rest.** One focal element per viewport. Whitespace is a feature. No competing accents.
2. **Expressive at progress.** Motion and amber appear only when the user earns them (accept, complete, level-up, streak).
3. **The coach feels like a person.** Coach text is set in the humanist voice, never inside a data-dense card.
4. **Glass-box.** Every AI number carries a visible confidence affordance and a "why" one gesture away.
5. **Nothing writes unconfirmed** — the UI must make auto-filed vs. pending-card states unmistakably different.
6. **Tokens only.** No component ever hardcodes a color, radius, or duration. A theme is a token file.

---

## 2. Theme architecture (Slack-style: prebaked themes × light/dark)

**Model:** `theme` (palette family) × persisted `mode` preference (light | dark | system). Every theme ships both concrete modes; `system` resolves to the device preference. Components consume **semantic tokens only**; themes remap tokens, never components.

### 2a. Semantic token set (the contract)

| Token | Role |
|---|---|
| `--bg-canvas` | app background |
| `--bg-card` | resting card |
| `--bg-raised` | sheet / modal / hovered card |
| `--line` | hairline borders, dividers |
| `--ink-1` | primary text |
| `--ink-2` | secondary text |
| `--ink-3` | muted / placeholder |
| `--energy` | XP / streak / level-up **only** (brand amber) |
| `--dom-health` `--dom-money` `--dom-habits` `--dom-skills` | domain hues (fills, chips, rings) |
| `--dom-*-strong` | text-safe deepened variant of each domain hue |
| `--ok` `--warn` `--danger` | status |
| `--scrim` | gradient overlay for imagery under type |
| `--ring` | focus ring |
| `--elev-card` | card elevation (soft shadow by default; a theme may set `none` and lean on `--line`) |

**Brand constants across all themes:** `--energy` amber and the four domain hues keep their identity in every theme; only their *tints* adjust per mode (softer on dark, deeper on light). Themes retune **surfaces and neutrals** — that's what makes them feel different without breaking domain semantics.

### 2b. Shipped themes (v1 = 3 themes × 2 modes)

**Ember** — flagship; the PRD's Premium Dark, plus its warm-paper light twin.

| Token | Ember Dark (reference) | Ember Light |
|---|---|---|
| canvas | `#0C0B0A` | `#FAF6EE` |
| card | `#17130E` | `#FFFDF8` |
| raised | `#1E1913` | `#FFFFFF` |
| line | `#2A241C` | `#E8E0D2` |
| ink-1 / ink-2 | `#F4EFE4` / `#A79E8E` | `#1C1710` / `#6B6153` |
| energy | `#E8913E` | `#C86F1B` |
| dom health/money/habits/skills | `#7FB08C` `#D8A24A` `#8189CF` `#A97FC9` | strong: `#4C8A5E` `#A47417` `#5560B8` `#8352A8` |

**Bone** — editorial minimalist (derived from the aa-bot system, D-023): warm-bone light, soft off-black dark, hairline borders instead of shadows. Light: canvas `#FAF7F2`, card `#FFFFFF`, raised `#FDFCF9`, line `#E5DFD6`, ink `#211E1C`/`#6F6A66`. Dark: canvas `#131211`, card `#181614`, raised `#201D1A`, line `#302D2A`, ink `#F4F1EC`/`#A3A09B`. Sets `--elev-card: none` (the 1px line carries the lift). Same energy + domain constants; global type + painterly art laws still apply — Bone is Sarthi in editorial-minimal skin, not an aa-bot port.

**Moss** — nature-calm, green-tinted neutrals (closest to the painterly imagery). Dark: canvas `#0B0E0B`, card `#131A14`. Light: canvas `#F4F7F2`, card `#FDFFFC`.

> Exact non-Ember values are starting points — tune during the screenshot-verify pass with contrast checks (§9). Adding a fourth theme later = one token file, zero component work.

### 2c. Theme behavior

- **First run:** Bone, mode follows system preference. Switcher lives in Settings (and as an optional onboarding step).
- Persist per user (`localStorage` dev → Supabase profile prod). Apply the resolved value via `data-theme="bone" data-mode="dark"` on `<html>`; Tailwind reads CSS vars.
- **Deferred (unchanged):** user-*custom* theme editor. Prebaked themes are in v1; the editor is roadmap.

---

## 3. Typography

| Role | Face | Usage |
|---|---|---|
| **Display** | **Clash Display** (Fontshare; fallback Sora) | big numbers, screen titles, level/XP, mastery counters |
| **UI / body** | **Inter** | everything interactive and structural |
| **Coach voice** | **Fraunces** (light, slightly warm optical size) | every sentence the coach speaks — one-liners, briefs, "why this number" |
| **Tabular** | Inter with `font-variant-numeric: tabular-nums` | stats, ledgers, timers — no separate mono font |

Scale (mobile-first): display-xl 40/44 · display 28/32 · title 20/26 · body 15/22 · caption 12/16. Coach voice renders at body+1 with relaxed leading (`1.65`). Never set coach text in Display; never set data in Fraunces.

## 4. Color law

- Amber (`--energy`) appears **only** on XP, streak, level-up, and the Overall stats card. If amber is on screen, the user earned it. **Amber only when EARNED (D-041 fold-back):** the arc **day-counter** ("Day 5 of 30") is a position, not a reward → neutral `--ink-2`; a **zero/base stat** (streak `0`, level `1`) hasn't been earned → neutral `--ink-3`. A stat pill turns amber only once its value crosses the earned threshold (streak `> 0`, level `> 1`).
- Domain hue appears on: the domain chip, lens accents, ring fills, card left-edge ticks. Never as large text on `--bg-card` without the `-strong` variant (contrast). **Health-lens ring tints (D-041):** water `--health-water` `#6f9fae` dark / `#3f7e93` light · protein `--health-protein` `#a8815c` dark / `#8a6238` light — set **per-mode** (`[data-mode="light"]`) for AA on warm paper, and pulled deliberately clear of `--energy` amber + `--dom-money` gold so the three rings read as three distinct metrics, never as "earned" amber. **Money-lens tokens (D-042):** dark-mode `--dom-money` is bronze `#c0883a` (deepened from `#d8a24a` so it reads clear of `--energy` amber; light unchanged), and dark budget-bar status colors `--warn` `#e6972e` / `--danger` `#c96e63` stay distinct from `--dom-money` — the fill turns `--warn` above 90% and `--danger` when over (the only status colors in the lens), so a >90% bar signals urgency.
- Surfaces: max two elevations visible at once (`card` on `canvas`, or `raised` over both). Cards are lifted a hair — one soft shadow token, never stacked shadows, never pure grey.
- Imagery always sits under `--scrim` when type is on it.

## 5. Motion system (Framer Motion)

**Durations:** `--t-fast 120ms` (state ticks) · `--t-base 200ms` (most transitions) · `--t-slow 320ms` (sheets, page) · `--t-hero 600–900ms` (level-up only).
**Easing:** standard `cubic-bezier(0.2, 0, 0, 1)`; springs for gesture-driven motion (swipe: `stiffness ~300, damping ~30`).

Signature motions (the only choreographed ones — everything else is `--t-base` fades/slides):

1. **Capture sheet** slides up over the current tab (`--t-slow`), backdrop dims to scrim.
2. **Parse shimmer** — skeleton cards with a slow diagonal sheen (the one CSS-keyframe exception). Never a spinner.
3. **Swipe deck** — cards follow the finger (spring), rotate ±8° with drag, toss offscreen on commit; the "filed automatically" strip items tick in with a 40ms stagger.
4. **Fan-out** — accepted entries fly toward their domain chip and shrink into it; XP counter rolls.
5. **Level-up bloom** — amber radial bloom + number flip, ≤900ms, fires once, inline in the fan-out. Never modal.
6. **Done/Skip on Today** — Done: check draws in, row settles into the completed cluster; Skip: fade + slide down, no shame animation.
7. **Streak** — flame pulses once only on increment.

`prefers-reduced-motion`: springs → 150ms fades, bloom → static amber flash, shimmer → static skeleton.

## 6. Layout & navigation

- **Design width:** mobile-first at 390px; content column caps at 720px on desktop.
- **Capture:** one white elevated pencil FAB floats bottom-right above the mobile nav / desktop rail. It morphs into the global capture sheet; text, photo, and PTT stay reachable inside that sheet from every tab.
- **Verification:** 390px mobile is the visual-fidelity gate; every changed screen/state also receives a desktop responsive smoke screenshot (D-034).
- **Settings/Profile:** avatar top-right on every tab → sheet/route. Not a sixth tab.
- Grid: 4px base, 16px gutters, 20px card padding, radius tokens `--r-card 20px` / `--r-chip 999px` / `--r-input 14px`.
- Safe areas respected; capture bar lifts above the keyboard when text input is active.

## 7. Component sourcing policy

- **Base primitives:** shadcn/ui (Radix) — button, sheet, dialog, tabs, input, toggle, progress. Themed via §2 tokens only.
- **Hero components:** may adapt from 21st.dev / Aceternity / Magic UI (card stacks, shimmer, number tickers) — but every import is **re-tokened before commit**; a component with a hardcoded hex or ad-hoc duration fails review.
- **Icons:** lucide-react only, 1.5px stroke, `--ink-2` default.
- **Motion:** Framer Motion for all choreography; no scattered CSS animations (shimmer excepted).
- Charts/rings: lightweight SVG (custom rings, sparklines) over a chart library — the visuals are simple and bespoke.

## 8. Imagery (full system: `docs/experience/ASSETS.md`)

- **House style:** calm, painterly, solitary-figure scenes in atmospheric light (cinematic/painterly — never described as any studio brand). Pre-generated (GPT Image + Nano Banana), shipped static.
- **Placement map:** Today header scene (time-of-day variants) · arc/challenge cards · Tools hero · Journey milestone markers · onboarding backdrops · Stats and lens header/summary bands. Dense metrics, ledgers, forms, and capture proposal cards stay data-first.
- Always full-bleed inside the card under `--scrim`; type on imagery is Display or Fraunces, never body UI text.
- **Build placeholder:** two-stop painterly gradient per domain hue + subtle grain texture token — layout never blocks on art. Light modes get lighter scrim + brighter variants of the same scenes (or the gradient placeholder until generated).

## 9. Accessibility & the "everyone" bar

- WCAG AA contrast verified **per theme per mode** in the screenshot-verify loop (this is why `-strong` domain variants exist).
- Hit targets ≥44px; the capture mic is ≥64px.
- Full keyboard path for the swipe deck: ←/→ = discard/accept, Enter = edit, `?` = why.
- Voice is never the only path — every capture has a text equivalent; every swipe has buttons under the deck.
- Font-size respects system scaling; layouts tested at 120%.
- Light modes are first-class (the non-technical/older audience), not inverted afterthoughts — hence Ember Light's warm paper rather than pure white.

## 10. Screen inventory (each gets its own MD, one by one)

| # | Screen | File | Notes |
|---|---|---|---|
| 1 | Capture sheet | `docs/screens/SCREEN-CAPTURE.md` | the moat — overbuild: input / shimmer / confirm-deck / fan-out states |
| 2 | Today | `docs/screens/SCREEN-TODAY.md` | **plan-forward (locked)**: pending challenges spine, Done/Skip, completed settle in place; feed lives in lenses; domain switcher swaps body to lens |
| 3 | Onboarding | `docs/screens/SCREEN-ONBOARDING.md` | **deep-but-skippable (locked)**: required core + optional detail sections, MCQ-chip + voice, calm |
| 4 | Coach | `docs/screens/SCREEN-COACH.md` | reading room: daily plan/recap, weekly brief card, history, ask field |
| 5 | Stats | `docs/screens/SCREEN-STATS.md` | collectible card wall, Current/Potential/Day-1 toggle, card → lens drill |
| 6 | Journey | `docs/screens/SCREEN-JOURNEY.md` | vertical memory timeline, milestone markers |
| 7 | Tools | `docs/screens/SCREEN-TOOLS.md` | **bento grid (re-locked D-017)**: AI-specialized tools, earning rule (each writes to a domain store); 2+ live, coming-soon + suggest cards |
| 8 | Lenses ×4 | `docs/screens/SCREEN-LENSES.md` | Money ledger · Health dashboard · Habits grid · Skills curriculum |
| 9 | Settings/Profile | `docs/screens/SCREEN-SETTINGS.md` | theme switcher, profile fields, providers, data |
| 10 | Flows | `docs/experience/FLOWS.md` | first-run, daily loop, weekly ritual, correction, backdate, receipt batch |

Phase-1 public routes inherit this system: `docs/screens/SCREEN-AUTH.md` covers signup/login/reset and `docs/screens/SCREEN-PRICING.md` covers pricing/checkout.

---

## 11. Hard "don'ts"

No spinners (shimmer instead) · no modal celebrations · no amber outside earned moments · no neon · no pure-grey cards · no third elevation · **no card-of-cards — nested cards become hairline-divided rows** (aa-bot law, adopted app-wide) · no naked gradient placeholders — always + grain overlay so placeholders read intentional · no dev-ish labels in UI (`meal photo` mono tags → glyphs) · no coach text in data cards · no hardcoded colors/durations · no shame animations on Skip · no wall-of-bullets screens — the calm is the brand.
