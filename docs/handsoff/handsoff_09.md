# Sarthi Handoff 09 — F11 stitch + art system landed (SAR-018)

| | |
|---|---|
| **Written** | 2026-07-19 |
| **Session state** | `SAR-001`–`SAR-018` accepted/landed on `sar-003-schema-repository` (stacked, not merged to `main`). The keyless inner-ring story is stitched through F11; the supplied 41-scene illustration system is live. |
| **Resume point** | Plan **SAR-019 — Token sweep and screenshot verification**. It owns the signed P11 six-theme pass; do not turn SAR-018's compact art evidence into a redundant theme/state matrix. |
| **Validation** | `pnpm check` **223 tests**, `pnpm build`, `pnpm art:check`, `git diff --check`, and `.codex/hooks/check-invariants.sh` pass. |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |

## 1. What SAR-018 landed

- **F2–F11 hand-offs are real:** Today Done/Skip reframes the global capture bar;
  Stats routes into a real lens; the Skills drill opens an existing scoped Focus
  run pre-set to 50 minutes; Journey evidence opens; Coach adaptations remain
  glass-box Keep/Revert; avatar Settings returns to the actual themed shell.
  No route receives a `userId`, no new typed-write path exists, and text/voice/
  photo/tool capture still use their existing safety seams.
- **Art system:** `scripts/build-art.mjs` converts the local raw `assets/images/`
  source drop into exactly 41 checked WebPs in `public/art/`. The typed
  `components/art/registry.ts` is the only public path boundary; `ArtFrame`
  provides ratio/scrim/alt/fallback. Output is **1.13 MB** (hard cap 3 MB).
  `pnpm art:build` needs sources; `pnpm art:check` validates committed outputs
  and works in a clone with no sources.
- **Purposeful placements only:** Today headers + contextual/empty cards; Tools
  bento + Focus setup; onboarding backdrops; Journey milestones; Coach weekly
  band. Capture cards, lenses, Stats, and Settings remain art-free.
- **Visual evidence:** `.verify/screens/stitch-*` (12) exercises the F2–F11
  hand-offs. `.verify/screens/art-*` (14) proves the placement families at Ember
  Dark 390px + desktop, with two targeted risk checks only: Today Ember Light and
  Tools Moss Dark. The onboarding shot uses an isolated fresh fixture; Coach
  freezes the browser to a Sunday evening so the real weekly band is visible.

## 2. Review history and carry-forward constraints

- Sol caught/repaired three concrete visual defects before acceptance: whole-card
  opacity made unavailable Tools text too dim; Focus evidence raced the sheet
  transition; onboarding's art layer collapsed from position utility conflict.
  Each has a re-shot rendered proof.
- Raw `assets/images/` PNGs are intentionally **local/untracked**. Do not stage
  them and do not edit the user-owned `.gitignore` change. Commit only the
  optimized outputs, script, registry, app code, verification evidence, and docs.
- The supplied extra Focus image is `tools.focus_detail`; the ledger-with-
  protagonist source is the Tools Afford-it crop. Signed §15 output paths use
  their documented underscore names; tests reject stale artifact paths.
- SAR-019 is still responsible for the full P11 six-theme token/contrast sweep.
  SAR-020 owns the full 12-fixture/provider-A/B eval and formal F11 dry run.
  **Hard stop before SAR-021** (production auth/deploy/billing/secrets).

## 3. Resume procedure

1. Read `AGENTS.md`, `.codex/GOAL`, this handoff, `docs/planning/TICKETS.md`
   SAR-019, `docs/experience/DESIGN.md`, and all referenced screen screenshot
   checklists.
2. Run `make doctor`, then `git status --short`. Expected non-code leftovers only
   are the user-owned `.gitignore` change and local `assets/` source folder until
   the SAR-018 commits are made; do not stage either.
3. If visual proof is needed, use populated SQLite and a fresh server port:
   `SEED_STATE=populated pnpm db:seed:dev`, `PORT=<fresh> pnpm start`, then
   `SHOTS=art BASE_URL=http://localhost:<fresh> node scripts/screenshot.mjs` or
   `SHOTS=stitch …`; stop the server when done. The app DB client pins on first
   require, so do not re-seed a running server expecting it to change state.
4. Write and approve `.codex/plans/SAR-019.md` before Terra starts. Keep primary
   screenshot coverage focused; P11, unlike SAR-018, is expressly the six-mode
   token pass, so expand only where its acceptance requires it.

## 4. Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_09.md`. `SAR-001`–`SAR-018` are
> accepted/landed on `sar-003-schema-repository`; F11 is stitched keylessly and
> the 41-scene art registry ships as 1.13 MB WebP. Read `AGENTS.md`,
> `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-019, `docs/experience/DESIGN.md`,
> and the screen checklists. Preserve raw `assets/images/` as local/untracked and
> do not touch the user-owned `.gitignore` diff. Then plan **SAR-019** only: the
> signed P11 token/contrast/AA/amber/shimmer/Fraunces sweep across six modes, with
> smart representative screenshots rather than redundant permutations. Run the
> standard Terra-build → Sol-review → D-041 → logical-commit loop. Hard stop
> before SAR-021.
