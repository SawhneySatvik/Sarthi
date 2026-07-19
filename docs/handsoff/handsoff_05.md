# Sarthi Handoff 05 — F3 Gate Met (SAR-005/006/007 landed)

| | |
|---|---|
| **Written** | 2026-07-18 |
| **Session state** | `SAR-001`–`SAR-004` accepted; **`SAR-005` (token shell + Today spine), `SAR-006` (Health slice + capture-sheet hero), `SAR-007` (F3 fake-stack eval) landed. ✅ F3 GATE MET (automated).** `SAR-008` is not planned. |
| **Resume point** | Plan **`SAR-008 — Money typed store and ledger lens`** (the first demo-spine fan-out, now unblocked) → stop for Satvik's ticket-plan sign-off. Also run the **manual visual screenshot pass** (open DoD across SAR-005/006/007). |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/planning/TICKETS.md` are signed; D-001–D-040 are constraints (`.codex/plan.md` holds the landed SAR-007 record). |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `948141b` on `main` is the last main commit. Branch **`sar-003-schema-repository`** carries the committed SAR-003 + SAR-004 + SAR-005 + SAR-006 + SAR-007 trees (all stacked; **not merged to `main`**). Working tree clean after the SAR-007 commits. Branch/commit/merge posture is Satvik's call — the whole demo spine is one stacked branch. |

## 1. Locked execution state

- **✅ F3 GATE MET (automated).** The full F3 loop runs keyless end-to-end and `wrongSilentWrites === 0` holds as a hard aggregate over the four Architecture gate-3 fixtures (SAR-007). Fan-out (SAR-008/009/010) and non-provisioning Phase-1 work are now unblocked (TICKETS SAR-007).
- **Product + safety:** `AGENTS.md` invariants apply without exception. Nothing estimated writes unconfirmed — now enforced server-side at the capture seam (D-040 re-route). Integer units; typed domain writes only; `core/` framework/provider/DB-import clean; tokens-only UI (amber only on XP/streak/level); demo path never paywalled.
- **Workflow:** Sol plans + reviews · Terra writes all code · Luna read-only. Every ticket: approved `.codex/plan.md` → build → Sol diff review. This session ran SAR-004 remediation → 005 → 006 (two-pass) → 007, each reviewed.
- **New decisions this session:** **D-039** (framework-clean read-models in `core/domains` + the server-only composition accessor; tokens-only via a Tailwind `@theme` layer) · **D-040** (capture-sheet route-handler transport + the server-re-routes-auto trust seam; **corrected** — the auto/accepted distinction is the `commits.kind` envelope, not a persisted row `status`). Open decision unchanged: **D-006** (demo runtime provider).
- **External deadline:** Tue Jul 21, 5:00 PM PT. D-035: only dependency + acceptance evidence advance work.

## 2. Landed-ticket evidence (this session)

- **SAR-005 — token shell + thin Today spine.** 6 theme-modes (`[data-theme][data-mode]` + a Tailwind `@theme` layer, CI-guarded parity, self-hosted `next/font`, AA contrast verified headless), 5-tab shell + header + dev theme pill, a Today spine reading real repos via `app/lib/session.ts` (server-only accessor) + the pure `core/domains/today.ts` read-model, Done/Skip a user-scoped manual write. Sol 1-pass ACCEPTABLE TO LAND. → D-039.
- **SAR-006 — Health slice + capture-sheet hero (the F3 loop).** Route handlers `app/api/capture/{parse,commit,undo}` → the capture sheet (`components/capture/*`, framer-motion) → typed Health writes via the real SAR-004 commit service → XP/level-up/undo → Today `via capture`; the Health 3-ring lens (`core/domains/health.ts` + `components/lenses/HealthLens.tsx`); the canonical entity seed (`data/seed/canonical.ts`, D-K). Sol **two-pass** (4 blocking findings — phantom strip rows, undo divergence, amber-on-orb, auto-batch provenance — fixed; + 2 hardening MEDIUMs) ACCEPTABLE TO LAND. → D-040.
- **SAR-007 — F3 fake-stack eval (THE GATE).** `tests/eval/{report,harness,f3-gate.eval.test}.ts` drives the 4 gate-3 fixtures keyless (canonical via the real `parseDump`; the rest hand-built) + `estimated-meal-photo` synthesized; hard-asserts `wrongSilentWrites === 0` aggregate (closes N-6). Sol confirmed non-vacuous by mutation probe. Test-eval-clean (no production edit beyond the D-040 doc fix). `pnpm check` **106 tests**, build, invariants green, keyless.

**Deferred follow-ups (none block; fold into the named ticket):**
- **Manual visual screenshot-verify** (390px + desktop) across SAR-005/006/007 — the one open DoD; no browser tooling in the repo (`pnpm db:seed:dev && pnpm dev` to walk it, or wire a Playwright/Chrome MCP).
- **SAR-006:** F4a/F4b (correction/backdate) + the question-card UI are unreachable on the content-blind fake fixture (proven by unit tests; need a non-canonical fixture); mic uses the fake-voice shortcut (real PTT = SAR-013); fan-out/undo-toast/40ms-stagger trims; habitLog edit toggle; one coach note per accept; R3/R4 (accept-vs-auto race, server-side question re-verification) — informational.
- **SAR-007 → SAR-020:** fold the expected-auto allowlist + a `commits.kind` habit-write check into the `wrongSilentWrites` metric itself; add the canonical meal-accept → `mealItems` step to the gate scenario; the full 12-fixture / provider-A/B `EvalReport` is SAR-020.
- **Carry-forward:** UTC→user-local `localDate` at the capture/Today edge; SAR-005's header time-of-day scene + satisfied-by rendering (SAR-009).

## 3. Current repository map (additions this session)

```text
app/api/capture/{parse,commit,undo}/route.ts   the capture route-handler seam (D-040; server re-routes auto)
app/lib/session.ts                              server-only getSession → {user, repos, llm} (D-E/SAR-005)
app/(app)/{layout,today,journey,coach,stats,tools}  the app shell + routes; Today reads repos + read-models
components/capture/*                            the capture sheet hero (orb/strip/deck/gestures/undo, framer-motion)
components/today/*, components/lenses/HealthLens, components/shell/*, components/ui/*   the UI kit
core/domains/{today,health}.ts                  pure framework-clean read-models (invariant #9)
data/seed/canonical.ts                          the canonical entity seed (SAR-007 reuses it)
tests/eval/{report,harness,f3-gate.eval.test}.ts  the F3 gate eval
app/globals.css                                 the 6-theme-mode token layer (@theme)
```

Commands: `make doctor` · `pnpm install --frozen-lockfile` · `pnpm check` (106 tests) · `pnpm test:eval` (F3 gate) · `pnpm build` · `.codex/hooks/check-invariants.sh` · `pnpm db:seed:dev && pnpm dev` (walk F3 locally).

## 4. SAR-008 boundary (next ticket)

**Ticket:** `SAR-008 — Money typed store and ledger lens` · **Agent:** `screens`/`pipeline` (Terra) · check `docs/planning/TICKETS.md`. Per the moat thesis, a new domain is "a schema (exists) + a lens": the Money typed store already exists (SAR-003 `transactions` + `categories`), and capture already writes it (SAR-004/006). SAR-008 adds the **Money ledger lens** (integer paise, no floats — invariant #2) in the Today domain switcher's Money slot (currently a placeholder), following the Health-lens pattern (`core/domains/*` pure read-model + a `components/lenses/*` body). Read `docs/screens/SCREEN-LENSES.md` (Money §) + `docs/experience/DESIGN-PROMPTS.md` before planning. Do NOT rebuild the capture pipeline.

## 5. `.codex` skill policy

- The full policy is in `docs/handsoff/handsoff_01.md` §5 and still applies. `AGENTS.md`, the architecture, and screen/design docs override every skill default.

## 6. Resume procedure

1. Read this handoff, `AGENTS.md`, `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-008, `docs/screens/SCREEN-LENSES.md` (Money).
2. Run `make doctor`; inspect `git status --short` (clean; the demo spine is stacked on `sar-003-schema-repository`).
3. **Run the manual visual screenshot pass** for SAR-005/006/007 if a browser is available (or hand it to Satvik) — the one open DoD.
4. Write `.codex/plan.md` for **SAR-008 only**, then STOP for sign-off.
5. Build → Sol diff review → land; then SAR-009 (Habits + satisfied-by grid) / SAR-010 (Skills), then the Phase-1 sellable wrap.

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_05.md`. `SAR-001`–`SAR-007` are accepted/landed — **the F3 gate is met (automated)**; `SAR-008` is not planned. Read `AGENTS.md`, `.codex/GOAL`, `docs/screens/SCREEN-LENSES.md` (Money), and the SAR-008 ticket; run `make doctor`; inspect `git status --short` (the demo spine is stacked on `sar-003-schema-repository`). Then write only the `.codex/plan.md` for SAR-008 (Money ledger lens — schema + lens, do not rebuild capture) and stop for sign-off. Also flag the open manual DoD: the visual screenshot-verify pass across SAR-005/006/007. Preserve the keyless fake stack, integer-paise money (no floats), tokens-only UI, repository-bound `userId` scoping, and the no-silent-estimate invariant.
