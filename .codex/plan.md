# DTOP-0 — Desktop foundation (approved)

## Scope

Create the shared desktop geometry and navigation foundation only. DTOP-1–4 own
per-surface desktop layouts. Mobile remains byte-identical.

## Contract

- Add `--w-reading: 45rem`, `--w-canvas: 72rem`, `--w-rail-compact: 4rem`, and
  `--w-rail-expanded: 15rem` in `app/globals.css`.
- `< md`: existing BottomNav and all base/mobile classes unchanged.
- `md` (768–1023): current icon-only 4rem rail, hidden labels, reading-width shell.
- `lg` (1024+): 15rem labeled sidebar; shell expands from reading width to canvas width.
- `xl` is a convention for later additional columns, never a third width system.

## Allowed files

`app/globals.css`, `app/(app)/layout.tsx`, `components/shell/LeftRail.tsx`,
`components/tools/ToolsProvider.tsx`, `app/(app)/loading.tsx`,
`scripts/screenshot.mjs`, and `docs/experience/DESIGN.md`.

`BottomNav.tsx` is validation-only. Do not touch capture, Coach, Today, lenses,
providers, `core/`, data, route contracts, or any trust-path behavior.

## Verification

- Add `SHOTS=shell` to cover Today, Journey, Coach, Stats, and Tools at 390/1280,
  asserting the active primary-navigation link.
- Make desktop capture/voice calls respect `THEMES` rather than forcing Ember.
- `pnpm check`, `pnpm test:eval`, Bone dark/light screenshots, human mobile 390
  comparison excluding dynamic timestamps, then Sol diff review.
- F3 remains keyless and unchanged: parse → confidence route → auto strip/cards →
  explicit acceptance → typed write → XP → Today update → undo.
