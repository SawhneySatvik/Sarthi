# docs/screens/SCREEN-JOURNEY.md — Journey (the memory timeline)

| | |
|---|---|
| **Role** | The emotional scroll-back: a vertical memory timeline of proof photos, coach notes, and milestone markers. Cheap to build (a view over evidence rows) — the demo's closer. |
| **Inherits** | `docs/experience/DESIGN.md` · imagery rules §8 |

> **SAR-019A / D-047 amendment:** each real day is a rounded story card on the
> timeline, with a cinematic cover and four equal tiles: Wellness, Task
> Progress, Memories, and Journal & AI Reflection. `DailyReflection` is an
> explicit, scoped memory record (mood, integer energy, optional integer sleep
> minutes, journal); it is not a fifth domain and never changes XP, plans, or
> adaptations. Images are private JPEG/PNG/WebP attachments (max four); web
> video is deferred to native mobile. Empty data renders an intentional prompt,
> never invented history.

---

## 0. The one-sentence spec

Scroll down through your days — photos you captured, the coach's line about each, and the milestones blooming between them.

## 1. Anatomy

```
┌─────────────────────────────────────┐
│  Journey                   [avatar] │
├──────┬──────────────────────────────┤
│  ●   │  TODAY · Day 12              │   ← day node on a spine line
│  │   │  [photo card] lunch · Health │
│  │   │  "Solid macros for a mess    │
│  │   │   dal." — coach              │
│  ◆   │  ── MILESTONE ──             │   ← amber marker
│  │   │  Level 4 · yesterday         │
│  ●   │  Day 11 · 2 photos ▸         │
│  ⋮   │                              │
└──────┴──────────────────────────────┘
```

- **Spine:** a 2px `--line` vertical rail, left-aligned; **day nodes** (`--ink-3` dots) and **milestone markers** (`--energy` diamonds) sit on it. The rail subtly brightens behind milestone markers.
- Reverse-chron; today pinned at top.

## 2. Items

- **Photo card:** the evidence image full-bleed under scrim, radius `--r-card`, max 240px tall · domain chip top-left · caption row: what it proved ("lunch · 620 kcal" / "receipt · ₹1,240") · the coach's one-liner beneath in Fraunces. Tap → full-screen viewer (pinch-zoom, swipe between, `View entry` → lens).
- **Multi-photo day:** collapsed row "Day 11 · 2 photos ▸" expands in place to its cards (keeps the scroll calm).
- **Milestone marker:** amber diamond + Display label — `Level 4` · `Arc: 33 days ✓` · `100h — System Design` · `First week complete`. Arc completions get a slim painterly band. Tap → the moment's context (arc summary sheet / Stats).
- **Text-only days** (entries but no photos): tiny node only — the timeline is *memories*, not a log (the log lives in lenses).

## 3. States

| State | Behavior |
|---|---|
| Day 1–2, no photos | one gentle prompt card: "Snap your first proof — a meal, a receipt, the gym mirror." → camera into capture sheet |
| Long history | month separators (caption, sticky); virtualized list |
| Photo missing/deleted | caption row persists without image ("photo removed") |
| Milestone-dense day | markers stack with 8px gaps — never merged |

## 4. Responsive & a11y

Desktop: rail centered-left in the 720px column, cards right of it. Viewer arrows + Esc. Alt text = caption row. Reduced motion: no rail brighten, no marker pulse. Scrim text AA everywhere.

## 5. Data contract

Reads: evidence rows (photo, date, domain, entry ref) · `CoachNote` per capture · milestone events derived from `Progress`/`Plan` (level-ups, arc completions, mastery thresholds, streak records). Writes: none. Photos: local files (dev) → Supabase storage (prod), thumbnails lazy-loaded.

## 6. Defaults (vetoable)

1. Text-only days = node only (no empty cards).
2. Viewer includes `View entry` deep-link.
3. Milestone set: level-ups, arc completions, mastery thresholds (10/100h…), streak records (7/30…), "first" moments.

## 7. Screenshot-verify checklist

Timeline with photo card + milestone · multi-photo expand · full-screen viewer · month separator · Day-1 prompt · milestone-dense day — 390px + desktop, Ember Dark + Light.
