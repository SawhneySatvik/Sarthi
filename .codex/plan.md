# SAR-018 — Landed active plan

**Approved and landed on 2026-07-19.** Full signed implementation contract:
`.codex/plans/SAR-018.md`.

## Landed evidence

1. All 41 supplied sources build deterministically into typed `public/art/` WebP
   derivatives; the manifest locks signed names/dimensions and `art:check` works
   in a fresh clone with no raw source folder. Total payload: 1.13 MB.
2. F2–F11 seams and the signed art placements are complete. No new write path,
   table, provider, domain, or product screen was introduced.
3. D-041 evidence is intentionally compact: 12 stitch and 14 art shots—Ember
   Dark at mobile + desktop, then only Ember Light Today and Moss Dark Tools as
   high-risk contrast samples. Onboarding and the real Sunday-evening Coach band
   have dedicated verified shots.
4. `pnpm check` (223 tests), `pnpm build`, `pnpm art:check`, `git diff --check`,
   and `.codex/hooks/check-invariants.sh` pass keyless.

## Non-negotiables

- Do not modify `.gitignore`; raw `assets/images` PNG sources remain local and
  untracked. Commit only optimized derivative assets and source code.
- Preserve the single typed capture/commit path, all estimate safeguards, integer
  units, repository-bound user scope, fake-stack keylessness, and `core/` import
  cleanliness.
- No new screens, domain concepts, tables, real provider keys, auth/billing, or
  silent data fallbacks. Stop and report if any is required.
