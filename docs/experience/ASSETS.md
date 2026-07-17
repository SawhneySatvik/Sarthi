# docs/experience/ASSETS.md — The Illustration Asset System

| | |
|---|---|
| **Role** | The soul layer. Life Reset's real moat is its asset philosophy — emotionally resonant scenes instead of icons. This doc adapts that philosophy to Sarthi's own house style and specs generation → integration end to end. |
| **Philosophy** | **Moments, not icons. People over objects. One visual universe.** A habit is a sunlit 5AM room, not an alarm clock glyph. |
| **IP stance (locked)** | Our own painterly house style — *cinematic/painterly, never described or promoted as "Ghibli"/"Solo Leveling"/any studio or franchise.* No recognizable characters. Emotional atmosphere is not IP; named styles are. |
| **Pipeline** | Pre-generated (GPT Image / Gemini image models) → static assets shipped in-repo. Gradient placeholders until art lands (layout never blocks on art). |
| **Schedule** | Generation + curation = Day 4 (per milestones), time-boxed to ~3h. |

---

## 1. The house style (and why it differs from the reference in one way)

The reference screens use close-up anime character faces. **We deliberately don't**, for two reasons:
1. **Consistency survives batch generation.** Faces are the first thing to drift across 40 generations; environmental scenes with a solitary figure (turned away, silhouetted, or at distance) stay coherent. Both your teardown notes name inconsistency as the premium-killer — this is the structural fix.
2. **IP cleanliness.** Distant-figure painterly scenes are unmistakably ours; stylized anime faces invite "that's X-style" comparisons.

**Style definition:** painterly digital illustration, soft brushwork, cinematic atmospheric light (golden hour / dawn / dusk / lamplit night), muted-warm palette that harmonizes with Ember (near-black shadows, warm ambers, sage greens, dusty indigos), a single solitary figure — seen from behind, in silhouette, or small in the frame — inside an evocative everyday environment. Quiet, aspirational, "main-character energy" without a face. Grain and light bloom welcome; neon, gloss, and hard vector edges are not.

## 2. THE MASTER STYLE BLOCK (paste into every generation, verbatim)

```
STYLE (constant): painterly digital illustration, visible soft brushstrokes,
cinematic atmospheric lighting, warm muted palette on deep near-black shadows
(#0C0B0A ambience), subtle film grain, gentle light bloom. One solitary human
figure, always seen from behind / in silhouette / small in frame — face never
visible or detailed. Quiet, contemplative, aspirational mood. Slice-of-life
realism with a slightly dreamlike glow. Composition leaves the LOWER THIRD
calm and uncluttered (dark falloff) for text overlay. No text, no logos, no
watermarks, no borders. NOT flat vector, NOT 3D render, NOT photoreal, NOT
neon/cyberpunk.
```

Per-asset prompts = `MASTER STYLE BLOCK + SUBJECT line + PALETTE ACCENT line + ASPECT`. Palette accent keys the scene to its domain: Health = sage-green ambient tones · Money = honey-gold · Habits = dusty indigo/blue-hour · Skills = violet dusk · Overall/arc = warm amber.

## 3. Asset inventory (v1 ≈ 40 images)

| Set | Count | Placement (spec ref) | Aspect | Subjects |
|---|---|---|---|---|
| **A. Today headers — time of day** | 4 | Today header scene (SCREEN-TODAY §2) | 3:1 wide | dawn: figure at a window, first light · day: desk by bright window · dusk: rooftop/balcony golden hour · night: lamplit room, city bokeh |
| **B. Challenge/habit archetypes** | 20 | plan cards, habit detail, lens accents (SCREEN-TODAY §5, LENSES) | 16:9 | *Habits (indigo):* waking at dawn · making the bed · cold-morning bathroom light · journaling by lamp · phone face-down on a shelf · meditation cushion by a window · night routine, dim lamp. *Health (sage):* home-cooked meal on a small table · water glass catching light · figure mid-run on an empty dawn street · gym floor, single figure at a rack · stretching on a mat · weighing scale by a window. *Skills (violet):* desk with code on a glowing screen · notebook + textbook spread · figure at a whiteboard · late-night focused desk. *Money (honey):* small notebook + receipts on a desk · market street from behind · a jar of coins on a windowsill. |
| **C. Tools bento** | 4 | tool cards (SCREEN-TOOLS §2) | 4:5 tall | focus: deep-work desk, warm monitor glow (violet) · meditation: cushion, incense light (indigo) · afford-it: ledger + evening window (honey) · workout counter: chalk + barbell corner (sage) |
| **D. Onboarding backdrops** | 4 | phase backdrops (SCREEN-ONBOARDING §2) | 9:16 | welcome: figure on a hill at sunrise (amber) · core: quiet room, morning · generation: four-color aurora over a valley · confirm: path leading forward |
| **E. Milestones & arc** | 5 | Journey markers, arc completion, level-up context (SCREEN-JOURNEY §2, TODAY §6) | 16:9 | summit figure at golden hour (arc complete) · long road behind, looking back (weekly) · lantern being lit (level-up) · first-week: small sapling on a sill · 100h: dawn over a city from a desk window |
| **F. Coach & misc** | 3 | weekly brief band (SCREEN-COACH §3), rest day, all-done evening | 6:1 band / 16:9 | thin misty-morning band · hammock/quiet porch (rest) · lamplit evening room (day done) |

**Not illustrated:** capture cards (user photos + data are the content), lenses' data zones, Stats (uses sheen + grain tokens), Settings. Restraint is part of the system — art appears where *emotion* is the job, never where *data* is.

## 4. Generation pipeline

1. **Two-model bake-off first (15 min):** run 3 identical prompts through GPT Image and the Gemini image model; pick the one that holds the style block better, then **generate the whole library in that single model** (cross-model mixing is the #1 consistency killer).
2. **Batch by set** (A, then B…), keeping the style block byte-identical; only SUBJECT/ACCENT/ASPECT change. Where the tool supports a reference/seed image, chain the best Set-A output as the style reference for every later batch.
3. **Generate 2 candidates per asset**, curate to 1. Kill list: visible faces · text/watermark artifacts · palette drift (too saturated / too cool) · busy lower third · style drift toward vector/3D/photoreal.
4. **The grid test:** drop all keepers into one contact sheet — if any image is identifiable as "from a different app," regenerate it. (Both teardown notes are right: one inconsistent asset breaks the premium feel.)
5. **Post-process (script, one pass):** resize to target boxes at 2×, convert to **WebP q80** (AVIF stretch), strip metadata. Target weights: headers ≤160KB, cards ≤100KB, band ≤60KB.
6. **Light-mode strategy:** do NOT regenerate a light library. Same image + a lighter scrim recipe (see §5) — the painterly warmth reads beautifully on Ember Light. Only Set A gets optional brighter variants if time allows.

## 5. Integration in the app

### 5a. Files & manifest
```
/public/art/{set}/{key}.webp        → e.g. /art/habits/wake_dawn.webp
/lib/art/manifest.ts                → typed registry
```
```ts
export const ART = {
  'today.header.dawn':   { src: '/art/today/dawn.webp',   accent: 'energy'  },
  'habit.wake_dawn':     { src: '/art/habits/wake_dawn.webp', accent: 'habits' },
  'health.meal_home':    { src: '/art/health/meal_home.webp', accent: 'health' },
  'tools.focus':         { src: '/art/tools/focus.webp',  accent: 'skills' },
  // …
} as const;
export type ArtKey = keyof typeof ART;
```

### 5b. One component renders all art
```tsx
<SceneCard artKey="habit.wake_dawn" scrim="bottom" mode={mode}>…children…</SceneCard>
```
- Renders the image full-bleed in the rounded card, `object-cover`, lazy-loaded.
- **Scrim recipe (token-driven):** dark mode = `linear-gradient(transparent 30%, rgb(from var(--bg-canvas)) 100%)` bottom-weighted; light mode = same geometry, softer stop (55%) + a 12% darken overall so `--ink-1`-on-scrim stays AA. One recipe, six theme-modes, zero per-image work.
- **Fallback = the gradient placeholder token** (two-stop painterly gradient in the asset's `accent` hue + grain). Missing/loading/killed asset → placeholder, automatically. This is also exactly what the Claude Design prototype shows today — the prototype's gradients ARE the fallback layer, so integration is a drop-in swap, not a redesign.

### 5c. How assets attach to *dynamic* content (the clever bit)
Static screens hardcode keys. But habits/challenges are **AI-generated at onboarding** — so the spine generator picks the art: the structured-output schema for plan items gains an `art_key: ArtKey` field, and the generation prompt includes the key list with one-line descriptions ("choose the closest scene"). Unknown/missing → fallback covers it. A user's custom "Practice violin" skill lands on `skills.desk_night` gracefully. New art later = add file + manifest row + the key list in the prompt; nothing else changes.

### 5d. Prototype vs build
Claude Design prototype: keep gradients (don't feed generated images into the prototype loop). Codex build: `SceneCard` + manifest on Day 1–2 with fallbacks only; drop the WebP library in on Day 4 — screens light up without touching components.

## 6. QA checklist (gates Day 4)
Grid test passed · every placement from §3 renders · scrim legibility AA in all six theme-modes (spot: Ember Light + Moss Dark) · total art payload ≤ 3MB · lazy-load verified on Today (only header + first card eager) · fallback path verified by deleting one file · no asset shows a face or text artifact.

## 7. Roadmap (post-v1)
Per-arc "worlds" (a new 40-image universe per theme) · seasonal header variants · milestone art personalization (skill-specific 100h scenes) · animated subtle-parallax headers (respecting reduced-motion).

---
---

# PART 2 — GENERATION BRIEF & PROMPT LIBRARY

> Extends §2–§4 into a run-ready brief. Locked inputs (D-022): **global-neutral world** · **one recurring protagonist** (same silhouette in every figure scene) · **both formats, manual-first canonical** (paste blocks are the primary workflow; the JSON manifest mirrors them for scripting).

## §8. BACKGROUND (paste this as session context)

Sarthi is a voice-first life coach app for four life domains — Health, Money, Habits, Skills. Its interface is Premium Dark (near-black warm canvas `#0C0B0A`), minimal, and calm; illustrations carry all the emotional weight. The asset library is ~40 painterly scenes forming ONE visual universe: the quiet, cinematic life of a single unnamed protagonist improving their days. Scenes depict *moments and aspirations, not icons* — a sunlit bed at dawn instead of an alarm-clock glyph. Every image will sit inside a rounded card under a bottom dark gradient (scrim) with white text over its lower third, on either a dark or warm-light app background. The world is global-neutral: no country-specific signage, products, or landmarks.

## §9. ROLE (the persona)

You are the sole visual-development artist for Sarthi — think of yourself as painting 40 frames from one film about one person. You have one style, one protagonist, one light philosophy, and you never break them. Your success is measured by a contact sheet: all 40 frames side by side must be instantly recognizable as the same hand, the same world, the same person. You prefer restraint over spectacle: your drama comes from light, not action.

## §10. INSTRUCTIONS (exact operating procedure)

1. **Bake-off (15 min):** Generate `today.header.dawn`, `habit.wake_dawn`, and `skills.desk_night` in both GPT Image and the Gemini image model using the full assembled prompts (§13/§14). Pick the model that best holds brushwork + palette + silhouette. **Generate the entire library in that one model. Never mix models.**
2. **Assemble every prompt identically:** `THE PREFIX (§13, byte-identical every time)` + the asset's `SCENE / ACCENT / FRAME` line from §14. Do not paraphrase the prefix, do not "improve" it mid-run.
3. **Batch by set, in order A → B → C → D → E → F.** If the tool supports a reference image, attach your best Set-A keeper to every subsequent generation as the style anchor.
4. **Generate exactly 2 candidates per asset.** Curate to 1 immediately using §11. If both fail, regenerate once with the same prompt; if it fails again, simplify the SCENE line (remove one noun) — never touch the prefix.
5. **Aspect handling:** generate at the `generate_at` ratio in §14; final crops (3:1 headers, 6:1 band) are cut from 16:9 in post — keep the horizon/subject in the middle band so the crop survives.
6. **After each set:** contact-sheet the keepers next to Set A. Any frame that reads as "a different app" → regenerate before moving on.
7. **Post-process (one scripted pass at the end):** crop to final ratios → resize to 2× target boxes → WebP q80 → strip metadata → name exactly per the manifest `file` field → drop into `/public/art/…`.
8. **Log:** note the winning model + any SCENE lines you simplified, in one comment block at the top of the manifest.

## §11. EXPECTATIONS (pass/fail quality gates)

An image is a KEEPER only if ALL are true:
- **Style:** visible painterly brushwork; soft grain; light bloom; palette harmonizes with `#0C0B0A` (warm muted, shadows near-black — never grey, never oversaturated).
- **Protagonist scenes:** silhouette matches the PROTAGONIST BLOCK exactly — same short dark tousled hair shape, same slim-athletic build, same 3-item wardrobe; seen from behind / silhouetted / small in frame; **zero facial features visible** (no eyes, mouth, or readable profile).
- **Composition:** lower third is calm and dark-falling (text will live there); single clear focal point; no clutter at the edges where the card radius crops.
- **Cleanliness:** no text, letters, numbers, logos, watermarks, borders, or franchise-recognizable elements anywhere.
- **Universe:** put next to any Set-A keeper, it obviously belongs.

FAIL (kill on sight, regenerate): any visible face or frontal figure · a second person · vector-flat or 3D-render or photoreal drift · neon/cyberpunk grading · busy lower third · text artifacts · anatomy errors · country-specific signage/products · recognizable studio/franchise styling.

Library-level: total payload ≤ 3MB after WebP; headers ≤160KB, cards ≤100KB, band ≤60KB each.

## §12. FORMAT (how the deliverables are structured)

- **Manual (canonical):** copy THE PREFIX once into your clipboard manager; per image, paste PREFIX + the one `SCENE/ACCENT/FRAME` line from the §14 table.
- **Scripted:** the §15 JSON manifest is a drop-in loop input — `prompt = PREFIX + render(entry)`; `file` is the output path; `generate_at` is the API size parameter; `final_ratio` drives the crop step.
- **File naming:** exactly the manifest `file` value (`/art/{set}/{key}.webp`) — the app's `ART` registry (§5a) depends on it.
- **Curation record:** keep the 40 keepers in one folder + one contact-sheet PNG; that sheet is the Day-4 QA artifact.

## §13. THE BLOCKS (assembled prefix — byte-identical in every prompt)

**THE PREFIX = STYLE + PROTAGONIST + NEGATIVE, in this order:**

```
STYLE: painterly digital illustration, visible soft brushstrokes, cinematic
atmospheric lighting, warm muted palette over deep near-black shadows (#0C0B0A
ambience), subtle film grain, gentle light bloom, quiet contemplative
aspirational mood, slice-of-life realism with a slightly dreamlike glow.
Composition keeps the LOWER THIRD calm, uncluttered, falling to dark — white
text will overlay there.

PROTAGONIST (when a figure is present, it is ALWAYS this same person): a young
adult, slim-athletic build, short dark tousled hair, wearing only items from
this wardrobe — charcoal hoodie, plain off-white tee, dark joggers. The figure
is ALWAYS seen from behind, in full silhouette, or small within the frame.

DO NOT: no visible face, no eyes, no mouth, no readable profile, no frontal
figure, no second person or crowd; no text, letters, numbers, logos,
watermarks, signatures, borders, or frames; not flat vector art, not 3D
render, not photorealistic photography, not anime cel-shading with hard black
outlines; no neon or cyberpunk grading, no oversaturation; no busy detail in
the lower third; no country-specific signage, brands, or landmarks; no
recognizable studio, franchise, or named-artist style; no distorted anatomy
or extra limbs.
```

## §14. THE PROMPT LIBRARY (all 40 — append one line to THE PREFIX)

Line template: `SCENE: {subject}. ACCENT: {accent}. FRAME: generate at {generate_at}, key subject in the middle band.`

| Key | Fig | Final | Gen at | Accent | SCENE |
|---|---|---|---|---|---|
| `today.header.dawn` | ✓ | 3:1 | 16:9 | warm amber | protagonist standing at a large bedroom window, curtains half open, first pale-gold dawn light flooding across the floor, sleeping city rooftops beyond |
| `today.header.day` | ✓ | 3:1 | 16:9 | warm amber | protagonist at a bright tidy desk beside a sun-filled window, papers and a closed laptop, clear midday warmth |
| `today.header.dusk` | ✓ | 3:1 | 16:9 | warm amber | protagonist leaning on a rooftop railing, low golden-hour sun over a soft skyline, long warm shadows |
| `today.header.night` | ✓ | 3:1 | 16:9 | warm amber | protagonist in a lamplit room beside a dark window, warm interior glow, blurred city lights outside |
| `habit.wake_dawn` | ✓ | 16:9 | 16:9 | dusty indigo | protagonist sitting up on the edge of a bed, pale blue-gold dawn through venetian blinds, still and quiet |
| `habit.make_bed` | ✓ | 16:9 | 16:9 | dusty indigo | protagonist smoothing a duvet flat, soft morning light raking across white sheets |
| `habit.cold_morning` | — | 16:9 | 16:9 | dusty indigo | cool blue-hour bathroom, light through frosted glass, a neatly folded towel on the rail, faint steam |
| `habit.journal` | ✓ | 16:9 | 16:9 | dusty indigo | protagonist writing in a small notebook inside a pool of warm desk-lamp light, dark room around |
| `habit.phone_down` | — | 16:9 | 16:9 | dusty indigo | a phone lying face-down on a wooden shelf beside a small plant, calm evening window light |
| `habit.meditate` | ✓ | 16:9 | 16:9 | dusty indigo | protagonist seated cross-legged on a floor cushion before a bright hazy window, morning stillness |
| `habit.night_routine` | ✓ | 16:9 | 16:9 | dusty indigo | protagonist turning down bedcovers by a dim warm bedside lamp, book and water glass on the nightstand |
| `health.meal_home` | — | 16:9 | 16:9 | sage green | a simple home-cooked meal steaming on a small wooden table by a window, morning light through the steam |
| `health.water` | — | 16:9 | 16:9 | sage green | a clear glass of water on a windowsill catching bright window light, soft refractions on the sill |
| `health.run_dawn` | ✓ | 16:9 | 16:9 | sage green | protagonist mid-stride down an empty tree-lined street at dawn, long shadow, cool air haze |
| `health.gym` | ✓ | 16:9 | 16:9 | sage green | protagonist alone at a barbell rack in a quiet gym, one overhead beam of light, dust motes |
| `health.stretch` | ✓ | 16:9 | 16:9 | sage green | protagonist stretching on a mat in a soft-lit living room, morning light across the floor |
| `health.weigh` | — | 16:9 | 16:9 | sage green | a simple bathroom scale on warm wooden floorboards beside a bright window, morning calm |
| `skills.desk_code` | ✓ | 16:9 | 16:9 | violet dusk | protagonist at a desk lit by a glowing monitor, abstract soft shapes of code, violet dusk outside the window |
| `skills.books` | ✓ | 16:9 | 16:9 | violet dusk | protagonist leaning over an open textbook and notebook under warm lamplight, pen in hand |
| `skills.whiteboard` | ✓ | 16:9 | 16:9 | violet dusk | protagonist sketching abstract diagrams on a whiteboard in a dim study room, marker glow |
| `skills.desk_night` | ✓ | 16:9 | 16:9 | violet dusk | protagonist at a late-night desk, warm lamp on, violet night sky and distant city lights beyond the glass |
| `money.ledger` | — | 16:9 | 16:9 | honey gold | a small open notebook, loose receipts and a pen on a desk in low honey evening light |
| `money.market` | ✓ | 16:9 | 16:9 | honey gold | protagonist walking away down a quiet market lane under golden awnings, warm late sun |
| `money.jar` | — | 16:9 | 16:9 | honey gold | a glass jar of coins on a windowsill in warm slanting afternoon sun, soft glints |
| `tools.focus` | ✓ | 4:5 | 4:5 | violet dusk | protagonist deep in work at a warm-lit desk, monitor glow on their back, violet night outside |
| `tools.meditation` | ✓ | 4:5 | 4:5 | dusty indigo | protagonist seated on a cushion facing a bright window, one thin curl of incense smoke rising |
| `tools.afford` | — | 4:5 | 4:5 | honey gold | an open ledger notebook and a small lamp on a desk before a warm evening window |
| `tools.workout` | ✓ | 4:5 | 4:5 | sage green | protagonist chalking hands at a barbell in a quiet gym corner, single shaft of light, chalk dust drifting |
| `onboard.welcome` | ✓ | 9:16 | 9:16 | warm amber | protagonist standing on a grassy hill at sunrise, vast warm sky, wind in the grass, world waiting below |
| `onboard.core` | — | 9:16 | 9:16 | warm amber | a quiet tidy room in soft morning light, window open, curtains breathing, empty chair |
| `onboard.generate` | — | 9:16 | 9:16 | four-band | a dark valley at night under a soft aurora of four gentle color bands — sage, honey, indigo, violet — reflected in a still lake |
| `onboard.confirm` | ✓ | 9:16 | 9:16 | warm amber | protagonist a few steps along a path leading forward through morning mist toward warm light |
| `mile.arc_complete` | ✓ | 16:9 | 16:9 | warm amber | protagonist standing relaxed on a summit at golden hour, the climbed valley far below, wind-still |
| `mile.week_back` | ✓ | 16:9 | 16:9 | warm amber | protagonist paused on a long open road at dusk, looking back at the distance already covered |
| `mile.levelup` | — | 16:9 | 16:9 | warm amber | two hands lighting a small hand-held lantern in blue dusk, warm flare blooming, face out of frame |
| `mile.first_week` | — | 16:9 | 16:9 | warm amber | a small green sapling in a clay pot on a windowsill, bright morning light, fresh soil |
| `mile.hundred_hours` | — | 16:9 | 16:9 | warm amber | dawn breaking over a city seen from a desk window, the desk lamp still on from the night's work |
| `coach.week_band` | — | 6:1 | 16:9 | warm amber | a thin misty morning landscape, low soft amber horizon over quiet fields, near-abstract calm |
| `today.rest` | — | 16:9 | 16:9 | warm amber | an empty hammock on a quiet porch in dappled afternoon light, leaves moving softly |
| `today.done_evening` | — | 16:9 | 16:9 | warm amber | a cozy lamplit room at evening, the day's things set down neatly, deep blue night in the window |

## §15. JSON MANIFEST (scripted mirror — same 40, loop-ready)

```json
{
  "prefix_blocks": ["STYLE", "PROTAGONIST", "DO_NOT"],
  "line_template": "SCENE: {subject}. ACCENT: {accent}. FRAME: generate at {generate_at}, key subject in the middle band.",
  "assets": [
    {"key":"today.header.dawn","file":"/art/today/dawn.webp","set":"A","final_ratio":"3:1","generate_at":"16:9","accent":"warm amber","figure":true,"subject":"protagonist standing at a large bedroom window, curtains half open, first pale-gold dawn light flooding across the floor, sleeping city rooftops beyond"},
    {"key":"today.header.day","file":"/art/today/day.webp","set":"A","final_ratio":"3:1","generate_at":"16:9","accent":"warm amber","figure":true,"subject":"protagonist at a bright tidy desk beside a sun-filled window, papers and a closed laptop, clear midday warmth"},
    {"key":"today.header.dusk","file":"/art/today/dusk.webp","set":"A","final_ratio":"3:1","generate_at":"16:9","accent":"warm amber","figure":true,"subject":"protagonist leaning on a rooftop railing, low golden-hour sun over a soft skyline, long warm shadows"},
    {"key":"today.header.night","file":"/art/today/night.webp","set":"A","final_ratio":"3:1","generate_at":"16:9","accent":"warm amber","figure":true,"subject":"protagonist in a lamplit room beside a dark window, warm interior glow, blurred city lights outside"},
    {"key":"habit.wake_dawn","file":"/art/habits/wake_dawn.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":true,"subject":"protagonist sitting up on the edge of a bed, pale blue-gold dawn through venetian blinds, still and quiet"},
    {"key":"habit.make_bed","file":"/art/habits/make_bed.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":true,"subject":"protagonist smoothing a duvet flat, soft morning light raking across white sheets"},
    {"key":"habit.cold_morning","file":"/art/habits/cold_morning.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":false,"subject":"cool blue-hour bathroom, light through frosted glass, a neatly folded towel on the rail, faint steam"},
    {"key":"habit.journal","file":"/art/habits/journal.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":true,"subject":"protagonist writing in a small notebook inside a pool of warm desk-lamp light, dark room around"},
    {"key":"habit.phone_down","file":"/art/habits/phone_down.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":false,"subject":"a phone lying face-down on a wooden shelf beside a small plant, calm evening window light"},
    {"key":"habit.meditate","file":"/art/habits/meditate.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":true,"subject":"protagonist seated cross-legged on a floor cushion before a bright hazy window, morning stillness"},
    {"key":"habit.night_routine","file":"/art/habits/night_routine.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"dusty indigo","figure":true,"subject":"protagonist turning down bedcovers by a dim warm bedside lamp, book and water glass on the nightstand"},
    {"key":"health.meal_home","file":"/art/health/meal_home.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"sage green","figure":false,"subject":"a simple home-cooked meal steaming on a small wooden table by a window, morning light through the steam"},
    {"key":"health.water","file":"/art/health/water.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"sage green","figure":false,"subject":"a clear glass of water on a windowsill catching bright window light, soft refractions on the sill"},
    {"key":"health.run_dawn","file":"/art/health/run_dawn.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"sage green","figure":true,"subject":"protagonist mid-stride down an empty tree-lined street at dawn, long shadow, cool air haze"},
    {"key":"health.gym","file":"/art/health/gym.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"sage green","figure":true,"subject":"protagonist alone at a barbell rack in a quiet gym, one overhead beam of light, dust motes"},
    {"key":"health.stretch","file":"/art/health/stretch.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"sage green","figure":true,"subject":"protagonist stretching on a mat in a soft-lit living room, morning light across the floor"},
    {"key":"health.weigh","file":"/art/health/weigh.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"sage green","figure":false,"subject":"a simple bathroom scale on warm wooden floorboards beside a bright window, morning calm"},
    {"key":"skills.desk_code","file":"/art/skills/desk_code.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"violet dusk","figure":true,"subject":"protagonist at a desk lit by a glowing monitor, abstract soft shapes of code, violet dusk outside the window"},
    {"key":"skills.books","file":"/art/skills/books.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"violet dusk","figure":true,"subject":"protagonist leaning over an open textbook and notebook under warm lamplight, pen in hand"},
    {"key":"skills.whiteboard","file":"/art/skills/whiteboard.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"violet dusk","figure":true,"subject":"protagonist sketching abstract diagrams on a whiteboard in a dim study room, marker glow"},
    {"key":"skills.desk_night","file":"/art/skills/desk_night.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"violet dusk","figure":true,"subject":"protagonist at a late-night desk, warm lamp on, violet night sky and distant city lights beyond the glass"},
    {"key":"money.ledger","file":"/art/money/ledger.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"honey gold","figure":false,"subject":"a small open notebook, loose receipts and a pen on a desk in low honey evening light"},
    {"key":"money.market","file":"/art/money/market.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"honey gold","figure":true,"subject":"protagonist walking away down a quiet market lane under golden awnings, warm late sun"},
    {"key":"money.jar","file":"/art/money/jar.webp","set":"B","final_ratio":"16:9","generate_at":"16:9","accent":"honey gold","figure":false,"subject":"a glass jar of coins on a windowsill in warm slanting afternoon sun, soft glints"},
    {"key":"tools.focus","file":"/art/tools/focus.webp","set":"C","final_ratio":"4:5","generate_at":"4:5","accent":"violet dusk","figure":true,"subject":"protagonist deep in work at a warm-lit desk, monitor glow on their back, violet night outside"},
    {"key":"tools.meditation","file":"/art/tools/meditation.webp","set":"C","final_ratio":"4:5","generate_at":"4:5","accent":"dusty indigo","figure":true,"subject":"protagonist seated on a cushion facing a bright window, one thin curl of incense smoke rising"},
    {"key":"tools.afford","file":"/art/tools/afford.webp","set":"C","final_ratio":"4:5","generate_at":"4:5","accent":"honey gold","figure":false,"subject":"an open ledger notebook and a small lamp on a desk before a warm evening window"},
    {"key":"tools.workout","file":"/art/tools/workout.webp","set":"C","final_ratio":"4:5","generate_at":"4:5","accent":"sage green","figure":true,"subject":"protagonist chalking hands at a barbell in a quiet gym corner, single shaft of light, chalk dust drifting"},
    {"key":"onboard.welcome","file":"/art/onboard/welcome.webp","set":"D","final_ratio":"9:16","generate_at":"9:16","accent":"warm amber","figure":true,"subject":"protagonist standing on a grassy hill at sunrise, vast warm sky, wind in the grass, world waiting below"},
    {"key":"onboard.core","file":"/art/onboard/core.webp","set":"D","final_ratio":"9:16","generate_at":"9:16","accent":"warm amber","figure":false,"subject":"a quiet tidy room in soft morning light, window open, curtains breathing, empty chair"},
    {"key":"onboard.generate","file":"/art/onboard/generate.webp","set":"D","final_ratio":"9:16","generate_at":"9:16","accent":"four-band aurora: sage, honey, indigo, violet","figure":false,"subject":"a dark valley at night under a soft aurora of four gentle color bands reflected in a still lake"},
    {"key":"onboard.confirm","file":"/art/onboard/confirm.webp","set":"D","final_ratio":"9:16","generate_at":"9:16","accent":"warm amber","figure":true,"subject":"protagonist a few steps along a path leading forward through morning mist toward warm light"},
    {"key":"mile.arc_complete","file":"/art/mile/arc_complete.webp","set":"E","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":true,"subject":"protagonist standing relaxed on a summit at golden hour, the climbed valley far below, wind-still"},
    {"key":"mile.week_back","file":"/art/mile/week_back.webp","set":"E","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":true,"subject":"protagonist paused on a long open road at dusk, looking back at the distance already covered"},
    {"key":"mile.levelup","file":"/art/mile/levelup.webp","set":"E","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":false,"subject":"two hands lighting a small hand-held lantern in blue dusk, warm flare blooming, face out of frame"},
    {"key":"mile.first_week","file":"/art/mile/first_week.webp","set":"E","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":false,"subject":"a small green sapling in a clay pot on a windowsill, bright morning light, fresh soil"},
    {"key":"mile.hundred_hours","file":"/art/mile/hundred_hours.webp","set":"E","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":false,"subject":"dawn breaking over a city seen from a desk window, the desk lamp still on from the night's work"},
    {"key":"coach.week_band","file":"/art/coach/week_band.webp","set":"F","final_ratio":"6:1","generate_at":"16:9","accent":"warm amber","figure":false,"subject":"a thin misty morning landscape, low soft amber horizon over quiet fields, near-abstract calm"},
    {"key":"today.rest","file":"/art/today/rest.webp","set":"F","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":false,"subject":"an empty hammock on a quiet porch in dappled afternoon light, leaves moving softly"},
    {"key":"today.done_evening","file":"/art/today/done_evening.webp","set":"F","final_ratio":"16:9","generate_at":"16:9","accent":"warm amber","figure":false,"subject":"a cozy lamplit room at evening, the day's things set down neatly, deep blue night in the window"}
  ]
}
```

## §16. Fully-assembled example (what one complete paste looks like)

```
[THE PREFIX from §13, verbatim]

SCENE: protagonist sitting up on the edge of a bed, pale blue-gold dawn through
venetian blinds, still and quiet. ACCENT: dusty indigo. FRAME: generate at
16:9, key subject in the middle band.
```
