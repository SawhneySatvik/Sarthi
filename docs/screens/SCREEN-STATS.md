# docs/screens/SCREEN-STATS.md — Stats (the collectible card wall)

| | |
|---|---|
| **Role** | The light collectible-card wall — the Life Reset "My Rating" inversion. Pride surface: levels, streaks, mastery, domain stats as beautiful cards. Every number traces to real entries. |
| **Inherits** | `docs/experience/DESIGN.md` · game layer is deterministic frontend over `Progress` |

---

## 0. The one-sentence spec

Your life as a small deck of luminous cards — one amber Overall, four domain cards — flippable through Current / Potential / Day-1, each a doorway into its lens.

## 1. Anatomy

```
┌─────────────────────────────────────┐
│  Stats            ( Current | Potential | Day-1 )   ← segmented toggle
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  OVERALL — amber card          │  │  ← hero, full width
│  │  L4 · 1,240 XP · Day 12 · 🔥6  │  │
│  └───────────────────────────────┘  │
│  ┌───────────┐  ┌───────────┐       │
│  │ HEALTH    │  │ MONEY     │       │  ← 2×2 domain grid
│  └───────────┘  └───────────┘       │
│  ┌───────────┐  ┌───────────┐       │
│  │ HABITS    │  │ SKILLS    │       │
│  └───────────┘  └───────────┘       │
└─────────────────────────────────────┘
```

## 2. The cards (the collectible feel)

- **Material:** `--bg-card` with a *subtle* domain-hued radial sheen from the top edge (8–12% opacity) + the painterly texture token — collectible, not neon. Radius `--r-card`, one shadow. Overall card uses `--energy` sheen — the app's largest amber surface, and it's earned by existing.
- **Overall card:** level glyph (Display, huge) · XP with progress hairline to next level · arc day · best streak. Tap → subtle 3D tilt (pointer-follow, ±4°, desktop only).
- **Domain card anatomy:** domain name (caption, hue) · **headline stat** (Display): Health = adherence % · Money = safe-to-spend · Habits = best streak · Skills = **cumulative hours `128:30`** (the mastery counter, tabular) · two micro-stats beneath · a 7-day micro-sparkline · level pip (`L3`).
- **Tap a domain card → that domain's lens** (Today tab activates with the chip pre-selected — one navigation model, no duplicate lens rendering).

## 3. The toggle (Current / Potential / Day-1)

- **Current** — live values (default).
- **Potential** — deep-tier projection *if the current plan holds* ("at this pace: L6 by arc end · 152h → 500h by Nov"). Values render in `--ink-2` with a `projected` tag — never visually confusable with real numbers. Cached daily.
- **Day-1** — the starting snapshot (frozen at onboarding accept). The emotional delta view; cards show `then → now` inline.
- Toggle animates cards with a fast flip (`--t-base`, rotateY 90° swap) — the collectible gesture.

## 4. States

| State | Behavior |
|---|---|
| Day 1 | cards render with starting values; Potential shows *"come back in 3 days — I need data"* (Fraunces) |
| Domain with no plan | card renders dimmed at 60% with `Set up` chip → onboarding section |
| Level-up since last visit | that card's pip pulses once on entry (the only motion at rest) |
| Projection unavailable | Potential falls back to Current with the tag `not enough data` |

## 5. Responsive & a11y

Desktop: Overall left, 2×2 grid right, tilt on. Mobile: stacked as diagrammed; grid collapses to 1-col at 320px. Flip respects reduced-motion (crossfade). All stats have text labels for screen readers; sheen is decorative. AA on all card text per theme-mode.

## 6. Data contract

Reads: `Progress{domain, xp, level, stats_json, streak, cumulative_minutes}` · `Plan/Arc` day · Day-1 snapshot · `Potential` projection (deep tier, cached daily, prompt fed by plan + trailing 7 days). Writes: none — Stats is a pure projection (the game layer stays deterministic frontend).

## 7. Defaults (vetoable)

1. Headline stats as listed in §2 (adherence / safe-to-spend / streak / hours).
2. Potential is deep-tier, cached once per day.
3. Card tap navigates to lens (no in-place expand in v1).
4. Day-1 snapshot freezes at onboarding accept, never edited.

## 8. Screenshot-verify checklist

Wall default · each toggle state · flip mid-frame · Day-1 delta rendering · dimmed no-plan card · level-pip pulse · Day-1-user Potential empty state — 390px + desktop, all three themes once (sheen tuning), Ember Dark + Light fully.
