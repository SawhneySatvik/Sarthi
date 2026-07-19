# SAR-019A — LANDED 2026-07-19

**Accepted build record.** Full implementation contract:
`.codex/plans/SAR-019A.md`.

`pnpm check`, `pnpm build`, `pnpm art:check`, `git diff --check`, and `.codex/hooks/check-invariants.sh` pass keyless. Sol completed a targeted D-041 review of Today, Journey, and capture at mobile plus desktop smoke. Next plan: `SAR-020` only.

## Non-negotiables

- `SAR-019` is manually accepted; preserve its evidence unchanged.
- D-047 permits bounded `daily_reflections` and `reflection_media` only. They
  are explicit user-authored Journey memory records, never a fifth domain,
  generic event log, XP source, plan mutation, or hidden coach adaptation.
- D-048 supersedes the Today one-action-only presentation rule: every remaining
  task is an art-led card with an accessible Done/Skip action and a swipe
  equivalent. All writes still use the existing scoped status action.
- Keep the capture F3 contract byte-for-byte safe: no estimate auto-write,
  no new generic reminder/thought persistence, no TTS, and no real keys.
- `MediaProvider` is keyless/local in dev and strictly user-scoped. The web
  gallery accepts up to four JPEG/PNG/WebP images per reflection; video defers
  to the native-mobile phase.
- Do not modify `.gitignore`, `next-env.d.ts`, or raw `assets/` sources.
- HARD STOP before `SAR-021`.

## Required evidence

`pnpm check` · `pnpm build` · `pnpm art:check` · `git diff --check` ·
`.codex/hooks/check-invariants.sh`; then smart D-041 evidence (Bone light/dark
at 390 + desktop smoke, plus focused Ember/Moss contrast samples) for Today,
Journey, Stats/lenses, Tools, and capture.
