# Sarthi Handoff 06 — Visual DoD Closed (SAR-005/006/007 screenshot-verified)

| | |
|---|---|
| **Written** | 2026-07-18 |
| **Session state** | `SAR-001`–`SAR-004` accepted; **`SAR-005` / `SAR-006` / `SAR-007` landed AND ✅ VISUAL DoD CLOSED (D-041)** — the built thin-spine UI is now screenshot-verified at 390px + desktop with a Sol design review, the one DoD each had deferred. `SAR-008` is not planned. |
| **Resume point** | Plan **`SAR-008 — Money typed store and ledger lens`** (the first demo-spine fan-out, now unblocked) → stop for Satvik's ticket-plan sign-off. Every screen-touching SAR from here carries the **D-041 visual gate** (screenshot → Sol review → fix → re-shoot) as part of its DoD. |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/planning/TICKETS.md` are signed; D-001–D-041 are constraints (`.codex/plan.md` holds the landed SAR-007 record + the visual-DoD close). |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `948141b` on `main` is the last main commit. Branch **`sar-003-schema-repository`** carries the committed SAR-003→SAR-007 trees; this session's visual-pass tooling + fixes + `.verify/screens/` evidence + docs land as fresh commits on the same branch (**not merged to `main`**). Branch/commit/merge posture is Satvik's call — the whole demo spine is one stacked branch. |

## 1. Locked execution state

- **✅ F3 GATE MET (automated) + ✅ SAR-005/006/007 VISUAL DoD CLOSED (D-041).** The F3 loop runs keyless end-to-end with `wrongSilentWrites === 0` as a hard aggregate (SAR-007), and the built surfaces are now verified *rendered* — not just functionally green. Fan-out (SAR-008/009/010) and non-provisioning Phase-1 work remain unblocked.
- **Product + safety:** `AGENTS.md` invariants apply without exception. Nothing estimated writes unconfirmed (server-enforced, D-040). Integer units; typed domain writes only; `core/` framework/provider/DB-import clean; tokens-only UI — **amber only on XP/streak/level, and only when EARNED** (D-041 refinement); demo path never paywalled.
- **Workflow:** Sol plans + reviews · Terra writes all code · Luna read-only. **New: Sol design-reviews rendered screenshots, not only diffs** — the `reviewer` agent Reads the `.verify/screens/` PNGs and critiques against the design law (D-041).
- **New decision this session:** **D-041** — visual screenshot-verify is a real SAR completion gate: `pnpm screenshots` (Playwright headless Chromium, `scripts/screenshot.mjs`) at 390px + desktop → Sol design review of the rendered shots → fixes → re-shoot; mobile 390px blocks, desktop blocks only correctness (D-034). Open decision unchanged: **D-006** (demo runtime provider).
- **External deadline:** Tue Jul 21, 5:00 PM PT. D-035: only dependency + acceptance evidence advance work.

## 2. This session's work (the visual pass)

- **Browser tooling wired (was the blocker).** `scripts/screenshot.mjs` (Playwright, headless Chromium) sets the theme via `localStorage['sarthi-theme']` (read by the pre-paint script), drives the real UI via the accessible names, and saves to `.verify/screens/<screen>-<state>-<width>-<theme>-<mode>.png`. `package.json`: `playwright` devDep (exact-pinned) + a `screenshots` script. `scripts/seed-dev.ts` gained a `SEED_STATE=populated|empty|alldone` env for the state variants. **38 shots** captured (Today populated/empty/all-done, the 6-theme Today sweep, the capture flow input→shimmer→confirm→why→edit→done, the Health lens across Ember/Bone/Moss).
- **Sol design review of the rendered UI → 5 mobile-blocking fixes, all landed:**
  1. **Level-up bloom** was amber-on-amber illegible → a legible `--energy` label over a soft radial glow (`components/capture/LevelUpBloom.tsx`).
  2. **Accepted estimates vanished** from the done state (broke the trust picture) → a "Confirmed by you" hairline ledger (`components/capture/CaptureSheet.tsx`, new `confirmed` state).
  3. **Health protein/water rings** read as amber/neon + failed AA on light → clay `--health-protein` + slate-teal `--health-water`, moved **per-mode** (`app/globals.css`).
  4. **Un-earned amber** on the arc day-counter + zero/base stats → neutral; amber only when earned (`components/today/StatCluster.tsx`, `components/ui/StatPill.tsx`).
  5. **Dev theme-pill obscured the Settings avatar** → repositioned bottom-left + hidden in shots (`components/dev/ThemeSwitcher.tsx`, `data-dev-switcher`).
- **Polish (same pass):** categorical capture confirm zones — flat filed-strip hairline rows vs. the single raised estimate card (`components/capture/FiledStrip.tsx`); completed rows dropped the punitive strikethrough (`components/today/PlanSpine.tsx`); Health rows use real labels + a glass-box `~` on estimates (`core/domains/health.ts`, `components/lenses/HealthLens.tsx`).
- **Verified:** `pnpm check` **106 tests**, build, invariants, boundary green after the fixes; keyless. Fixes confirmed in the re-shot `.verify/screens/` set.

**Deferred follow-ups (none block; signed cut states, not gaps):**
- Cut checklist states stay as their future tickets — dawn/dusk header scenes, quantified-fill, the satisfied-by grid (SAR-009), receipt-batch, edit-card polish, E1–E4.
- The full **6-mode P11 token sweep** of every screen is **SAR-019**; this pass covered the per-state minimum (Ember D+L, +Bone/Moss for the tint-sensitive rings, +a 6-theme Today sweep).
- Minor nits consciously left: capture input mask-fade, transcript-in-Fraunces.

## 3. Current repository map (additions this session)

```text
scripts/screenshot.mjs          the Playwright screenshot-verify harness (D-041; theme via init-script, drives the UI)
scripts/seed-dev.ts             +SEED_STATE=populated|empty|alldone for the state variants
.verify/screens/*.png           38 built-surface shots at 390px + desktop (git-tracked review evidence)
app/globals.css                 per-mode Health ring tints (--health-water/--health-protein) + bone-dark hairline lift
components/capture/{CaptureSheet,FiledStrip,LevelUpBloom}.tsx   confirmed-ledger · flat rows · legible bloom
components/today/{StatCluster,PlanSpine}.tsx, components/ui/StatPill.tsx   amber-when-earned · no strikethrough
components/dev/ThemeSwitcher.tsx, components/lenses/HealthLens.tsx, core/domains/health.ts   pill move · real labels
```

Commands: `make doctor` · `pnpm install --frozen-lockfile` · `pnpm check` (106 tests) · `pnpm test:eval` (F3 gate) · `pnpm build` · `.codex/hooks/check-invariants.sh` · **`pnpm screenshots`** (needs `next build` + `next start` up + a seeded DB; `SEED_STATE`/`BASE_URL`/`SHOTS` env-driven).

## 4. SAR-008 boundary (next ticket)

**Ticket:** `SAR-008 — Money typed store and ledger lens` · **Agent:** `screens`/`pipeline` (Terra) · check `docs/planning/TICKETS.md`. A new domain is "a schema (exists) + a lens": the Money typed store already exists (SAR-003 `transactions` + `categories`), and capture already writes it (SAR-004/006). SAR-008 adds the **Money ledger lens** (integer paise, no floats — invariant #2) in the Today domain switcher's Money slot (currently a placeholder), following the Health-lens pattern (`core/domains/*` pure read-model + a `components/lenses/*` body). Read `docs/screens/SCREEN-LENSES.md` (Money §) + `docs/experience/DESIGN-PROMPTS.md` before planning. **Its DoD now includes the D-041 visual gate** — screenshot the Money lens at 390px + desktop, Sol design review, fix, re-shoot. Do NOT rebuild the capture pipeline.

## 5. `.codex` skill policy

- The full policy is in `docs/handsoff/handsoff_01.md` §5 and still applies. `AGENTS.md`, the architecture, and screen/design docs override every skill default.

## 6. Resume procedure

1. Read this handoff, `AGENTS.md`, `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-008, `docs/screens/SCREEN-LENSES.md` (Money), and the D-041 gate in `docs/product/DECISIONS.md`.
2. Run `make doctor`; inspect `git status --short` (the demo spine is stacked on `sar-003-schema-repository`).
3. Write `.codex/plan.md` for **SAR-008 only** — include the D-041 visual gate in its acceptance list — then STOP for sign-off.
4. Build → Sol diff review → **`pnpm screenshots` + Sol design review of the Money lens** → land; then SAR-009 (Habits + satisfied-by grid) / SAR-010 (Skills), then the Phase-1 sellable wrap.

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_06.md`. `SAR-001`–`SAR-007` are accepted/landed — the F3 gate is met (automated) AND the SAR-005/006/007 visual DoD is closed (D-041, screenshot-verified with a Sol design review); `SAR-008` is not planned. Read `AGENTS.md`, `.codex/GOAL`, `docs/screens/SCREEN-LENSES.md` (Money), the SAR-008 ticket, and D-041; run `make doctor`; inspect `git status --short` (the demo spine is stacked on `sar-003-schema-repository`). Then write only the `.codex/plan.md` for SAR-008 (Money ledger lens — schema + lens, do not rebuild capture; include the D-041 visual gate in acceptance) and stop for sign-off. Preserve the keyless fake stack, integer-paise money (no floats), tokens-only UI (amber only when earned), repository-bound `userId` scoping, and the no-silent-estimate invariant.
