# Sarthi Handoff 07 — Demo-Spine Fan-Out Complete (SAR-008/009/010 landed)

| | |
|---|---|
| **Written** | 2026-07-18 (autonomous session) |
| **Session state** | `SAR-001`–`SAR-007` accepted/landed (F3 gate met; SAR-005/006/007 visual DoD closed). **✅ The demo-spine fan-out is COMPLETE: `SAR-008` (Money, D-042), `SAR-009` (Habits, D-043), `SAR-010` (Skills, D-044) all LANDED** — each gated (Sol code review + D-041 design review, keyless) and committed. All four domain lenses (Health · Money · Habits · Skills) are real and screenshot-verified; the last Today placeholder is retired. |
| **Resume point** | Plan + build **`SAR-011 — Meal/receipt vision path`** (the next F3→fan-out lane ticket) → then SAR-012 (onboarding) → 013 (voice) → 014 (coach/game). All keyless on the fake stack. Per-ticket flow: architect plan → Terra build → Sol code review + `pnpm check`/invariants → D-041 screenshot design review → commit. |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/planning/TICKETS.md` are signed; D-001–D-044 are constraints. Fan-out ticket plans in `.codex/plans/SAR-008/009/010.md`. |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `948141b` on `main` is the last main commit. Branch **`sar-003-schema-repository`** carries the committed SAR-003→SAR-010 trees (all stacked; **not merged to `main`**). Working tree clean after each ticket's 3-commit batch (feat · verify-evidence · docs). Branch/commit/merge posture is Satvik's call — the whole spine is one stacked branch. |

## 1. Locked execution state

- **✅ Demo-spine fan-out complete.** The moat's thesis is proven end-to-end: one capture pipeline → four typed stores → **four deliberately-unalike lenses**. A new domain was, as designed, "a schema (already existed) + a lens (+ a small cross-layer touch)". The F11 hero shots are now real: Money budget bars + safe-to-spend, a habit that **satisfies itself from Health**, the Skills **mastery counter**.
- **Product + safety:** `AGENTS.md` invariants hold without exception. Integer units everywhere (paise / minutes, **no float**); nothing estimated writes unconfirmed (the lenses are read-only except SAR-009's guarded manual-tick, which writes only explicit user completions and refuses satisfied-by habits UI + server); `core/` framework/DB-import clean; tokens-only UI (amber only on earned XP/streak/level — D-041); typed per-domain reads; demo path never paywalled.
- **Workflow (this session ran autonomously per Satvik's directive):** Sol plans + reviews (code AND rendered screenshots, D-041) · Terra writes all code · Luna orchestrates. Every ticket ran plan → build → Sol code review + Sol D-041 design review → fixes → commit. Recommended decisions were taken and logged (D-042/043/044); commit-per-ticket, HARMONY-clean (no engine/model names or footers in any tracked doc/commit).
- **New decisions this session:** **D-042** (Money read-only lens + pinned safe-to-spend glass-box model + token retune), **D-043** (Habits read-model + guarded manual-tick; satisfied-by = refusal enforced twice; GRACE_DAYS lifted into `core/game/streak.ts`), **D-044** (Skills read-only mastery lens; mastery = summed session minutes, not `cumulativeMinutes`). Open decision unchanged: **D-006** (demo runtime provider).
- **External deadline:** Tue Jul 21, 5:00 PM PT. D-035: only dependency + acceptance evidence advance work.

## 2. Landed-ticket evidence (this session)

- **SAR-008 — Money ledger lens (D-042).** `core/domains/money.ts` `buildMoneyView` (integer paise, no float) + `components/lenses/MoneyLens.tsx`: grouped day ledger, a glass-box safe-to-spend math sheet (balance − remaining-budgeted − upcoming-recurring, deduped, honest negatives), token-status budget bars (`--warn` >90% / `--danger` over), recurring shelf, category drill. Sol code review 0 blocking; D-041 → 2 mobile-blocking fixes (capture-bar clearance backdrop; the 95% bar didn't turn `--warn` — dark `--warn` == `--dom-money`, retuned) + a dark `--dom-money` bronze retune (off the `--energy` amber) + U+2212 minus. `pnpm check` 119.
- **SAR-009 — Habits satisfied-by grid (D-043).** `core/domains/habits.ts` + `HabitsLens.tsx`: grace-aware streaks (reusing `core/game/streak.ts`), a month heatmap, and the **satisfied-by refusal grid** — a rule-bearing habit shows no tick, a token-coloured Zap badge + live metric, a tap reveals the rule; rule-free habits get a real tap-tick (`setHabitCompletion` action, in-place `source:"manual"` write, refuses rule-bearing habits + no-ops unknown ids). Sol code review 0 blocking; D-041 → 1 mobile-blocking fix (the ⚡ was a raw gold emoji → token-coloured lucide Zap) + glass-box water-goalpost coherence (2000 ml) + a scoped `habitId` check + reduced-motion guard. `pnpm check` 133.
- **SAR-010 — Skills mastery lens (D-044).** `core/domains/skills.ts` + `SkillsLens.tsx`: per-skill mastery = summed session minutes (NOT `cumulativeMinutes`), a track list + lens-local milestone drill whose **mastery counter is the hero** over the curriculum (lucide ✓/▸/○) + a realistic session log. Sol code review 0 blocking; D-041 → 2 mobile-blocking fixes (dormant-card text failed AA in light → dim decoration only; 44px back-chip law → padded chip + lucide ChevronLeft) + polish (dropped the frozen `:00`, per-mode meter-rail, removed a dev-ish source enum, redistributed implausible mega-sessions). `pnpm check` 146. Retires the last placeholder.

**Recorded deferrals / follow-ups (accepted; each in its D-04x):**
- Money: the leak-strip daily AI insight; deep category-drill polish (cut line #3).
- Habits: align the Health water ring target to the 2000 ml goalpost; canonical-seed satisfied-by habit deferred (dev/judge seed carries it, the eval doesn't need it).
- Skills: `generate_roadmap` deep-tier AI + the mastery counter live-ticking against the (unbuilt) Tools Focus timer; the empty-invite state is unshootable because `seedCanonicalEntities` always creates one skill (load-bearing for the `ambiguous-skill` eval) — the invite path is unit-tested.
- Cross-lens: none of the four lenses render a per-lens Fraunces coach-read line yet — a deliberate consistency pass for later (SAR-015/019).
- Pre-existing latent risk flagged during SAR-009 planning: a tombstone-collision path in capture-undo (`core/capture/commit.ts` around the undo write) — informational, not touched.

## 3. Repository map (additions this session)

```text
core/domains/{money,habits,skills}.ts        pure framework-clean read-models (invariant #9)
components/lenses/{MoneyLens,HabitsLens,SkillsLens}.tsx   the three new lens bodies
app/(app)/today/actions.ts                    +setHabitCompletion (guarded manual-tick; mirrors setItemStatus)
core/game/streak.ts                           GRACE_DAYS lifted here (shared kernel; commit.ts imports it)
components/today/DomainSwitcher.tsx            all four selected===<domain> branches; no placeholder left
app/(app)/today/page.tsx, TodayBody.tsx       thread money/habits/skills views
components/capture/CaptureLauncher.tsx         opaque backdrop (content no longer ghosts under the capture bar)
app/globals.css                                dark --dom-money bronze + --warn caution amber; animate-refuse keyframe; Skills meter rail
scripts/seed-dev.ts                            money + habits + skills seed slices (SEED_STATE=populated/alldone)
scripts/screenshot.mjs                         money/habits/skills lens shot fns, folded into SHOTS=main
tests/{money,habits,skills}-view.test.ts       +40 keyless read-model tests (106 → 146)
.verify/screens/{money,habits,skills}-*.png    D-041 evidence (390px + desktop, Ember D+L)
```

Commands: `make doctor` · `pnpm install --frozen-lockfile` · `pnpm check` (**146 tests**) · `pnpm test:eval` (F3 gate) · `pnpm build` · `.codex/hooks/check-invariants.sh` · **`pnpm screenshots`** (needs `pnpm build` + `PORT=3111 pnpm start` up + `SEED_STATE=populated pnpm db:seed:dev` first; `SHOTS=main|money|habits|skills|empty|alldone`).

## 4. SAR-011 boundary (next ticket)

**Ticket:** `SAR-011 — Meal/receipt vision path` · **Agent:** `pipeline` (Terra) · check `docs/planning/TICKETS.md` (~line 131). The vision provider + a deterministic **fake vision adapter** already exist (SAR-002) and the `estimated-meal-photo` fixture is synthesized (SAR-007) — SAR-011 wires the photo → vision-parse → `CaptureDraft` path so a photographed meal/receipt flows into the same estimate-card capture loop, **keyless on the fake vision stack** (no real vision API). Read `docs/architecture/ARCHITECTURE.md` §2 (VisionProvider) + §5 (capture) + `docs/experience/FLOWS.md` F5 (receipt batch) before planning. Do NOT wire a real vision key; do NOT rebuild the capture pipeline — reuse the route-handler seam + estimate deck.

**HARD STOP boundary (do not do autonomously):** the outer-ring sellable wrap — `SAR-021`+ (production auth, live Vercel/Supabase deploy, Razorpay billing, real secrets). These are outward-facing / irreversible / need Satvik's accounts. Autonomous work runs SAR-011 → SAR-020 (all keyless) at most, then stops.

## 5. `.codex` skill policy

- The full policy is in `docs/handsoff/handsoff_01.md` §5 and still applies. `AGENTS.md`, the architecture, and screen/design docs override every skill default.

## 6. Resume procedure

1. Read this handoff, `AGENTS.md`, `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-011, `docs/architecture/ARCHITECTURE.md` §§2,5, and D-042/043/044.
2. Run `make doctor`; inspect `git status --short` (clean; the spine is stacked on `sar-003-schema-repository`).
3. Optionally walk the four lenses locally: `SEED_STATE=populated pnpm db:seed:dev && pnpm dev` → Today → tap Health / Money / Habits / Skills chips.
4. Write `.codex/plans/SAR-011.md` (architect), build (Terra), Sol code + D-041 design review, commit — per the standing loop.

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_07.md`. `SAR-001`–`SAR-010` are accepted/landed — **the demo-spine fan-out is complete**; all four domain lenses (Health/Money/Habits/Skills) are real and screenshot-verified (D-042/043/044). Read `AGENTS.md`, `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-011, `docs/architecture/ARCHITECTURE.md` §§2 (VisionProvider) + 5 (capture); run `make doctor`; inspect `git status --short` (spine stacked on `sar-003-schema-repository`). Then plan + build **SAR-011 (Meal/receipt vision path)** — wire photo → fake-vision-parse → the estimate-card capture loop, **keyless on the fake vision stack** (no real vision key), reusing the route-handler seam; do not rebuild the pipeline. Preserve the keyless fake stack, integer units (no float), tokens-only UI (amber only when earned), repository-bound `userId` scoping, and the no-silent-estimate invariant. HARD STOP before SAR-021 (outer-ring deploy/auth/billing).

## 7. Autonomous-session note

Satvik authorized autonomous work through his absence (recommended decisions logged, commit per ticket) with: on an API/credit error, wait until 8:10 AM IST (session refresh) then resume; on reaching the 9:00 AM IST horizon, finish the ticket in hand, write this handoff, then close — never stop mid-ticket. This session hit two transient mid-stream API stalls on the SAR-008 fix pass (recovered by re-dispatching a tighter edit-only run — no work lost); everything else ran clean.
