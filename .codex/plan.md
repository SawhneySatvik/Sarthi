# SAR-005 — Token Shell and Thin Today Spine

| | |
|---|---|
| **Status** | **LANDED 2026-07-18** (code) — built keyless; `pnpm check` 94 tests, build, invariants, compiled-CSS token + 6-theme verification, AA contrast, runtime smoke all green; Sol diff-review ACCEPTABLE TO LAND (0 blocking); batch fixes applied. **Open DoD before CLOSE: visual screenshot-verify at 390px + desktop** (needs a browser). Stacks on `sar-003-schema-repository`. |
| **Owner** | `screens` (Terra) · medium effort (routine, well-specified UI) |
| **Depends on** | `SAR-001` (scaffold) and `SAR-003` (bound repository factory) — both accepted. Reads SAR-004 outputs (`completionSource`, progress) but adds no capture UI. |
| **Authority** | `docs/experience/DESIGN.md` §§2–7 · `docs/experience/DESIGN-PROMPTS.md` P0, P2 · `docs/screens/SCREEN-TODAY.md` · `docs/experience/FLOWS.md` F2–F3 · `docs/planning/TICKETS.md` SAR-005 · `AGENTS.md` §2 (esp. invariant #4 tokens-only UI, #9 core import-clean) |
| **Out of scope (do NOT borrow)** | Capture sheet / swipe deck / inline level-up (SAR-006) · real lens bodies for Money/Habits/Skills (SAR-008/009/010) · the CoachEngine / daily-brief generation (SAR-014) · live commit-driven auto-check of plan items + XP roll (SAR-006) · Stats/Journey/Coach/Tools/Settings real screens (later tickets — stubs only) · production auth / Supabase (SAR-021) · the judge seed (SAR-020) · any schema/migration change · any live-provider call. |

---

## Context

SAR-005 makes the SAR-004 pipeline **visible**: the CSS-variable token system (3 themes × 2 modes), the app shell (5-tab nav + header + a static global capture bar), and a **thin Today spine** that reads the SAR-003 repositories and renders the day. It does not build the capture sheet (SAR-006) or the eval (SAR-007); together SAR-005 + SAR-006 make F3 runnable, and SAR-007 closes the gate. This is `DESIGN-PROMPTS.md` **P0** (token/shell) + **P2** (Today), and the shell half of FLOWS **F2/F3** (the capture bar is the mic entry point on every tab; Today must be able to *display* `via capture` provenance).

Invariants touched and how they stay satisfied: **#4 tokens-only UI** — every color/radius/duration/space/font is a CSS variable; `--energy` (amber) renders ONLY on XP/streak/level; P0's accept bar ("nothing hardcodes a color") is grep-enforced. **#9 core import-clean** — the Today read-model is a pure framework-clean function in `core/domains/`; all React/Next code lives in `app/` + `components/`; `pnpm check:core-boundary` stays clean. **#5 repository pattern** — the Today page reads through `UserScopedRepositories` via a new server-only composition accessor; business logic never touches the DB driver. **#1** — SAR-005 writes nothing estimated; the only optional write (Done/Skip, OQ-1) is an explicit tap → `completionSource:'manual'`, never a silent estimate. **#10** — the demo path is never paywalled (no auth wall on the local-dev scope).

**Deliverable of this planning step:** this plan only. On sign-off a todo list is created from the ordered steps and handed to Terra (`screens`). No code before sign-off.

## Current state (verified by reading the SAR-001 scaffold + SAR-003 surface)

- **Scaffold is minimal:** `app/{layout,page}.tsx`, `app/globals.css`, `app/lib/runtime.ts`; `components/` is empty (`.gitkeep`). `app/page.tsx` is a placeholder string — **all shell/Today UI is new work**.
- **Tokens are partial + wrongly structured:** `app/globals.css` holds ONE flat `:root` block = the Ember-Dark palette + radii/durations + an ad-hoc `--space-shell`. `app/layout.tsx` sets `data-theme="ember" data-mode="dark"` on `<html>`, **but nothing keys off those attributes yet** — so SAR-005's core CSS task is a *restructure* into `[data-theme][data-mode]` scoped blocks, not "add more values." Missing: Bone + Moss themes, all light modes, type-scale/font tokens, spacing tokens, easing tokens, and font loading (Inter/Fraunces/Clash-Display are wired nowhere).
- **Composition-root gap (load-bearing):** `app/lib/runtime.ts` only parses env selectors — there is **no** app-side function that goes `AuthProvider.requireUser()` → `factory.forUser(user)` → `repos`. Nothing upstream wired it. SAR-005 must add it.
- **Read surface available (SAR-003):** `RepositoryFactory.forUser(user).plans` → `arcs.list({domain?,status?})`, `items.list({arcId?,localDate?,status?})` (fields: `domain`, `kind`, `title`, `dueAt`, `localDate`, `targetValue/Unit`, `status ∈ pending|active|done|skipped|missed`, `completionSource ∈ manual|capture|tool|rule|auto` nullable, `linkedHabitId/SkillId`), `progress.list({domain?})` (`domain` incl. `'overall'`, `xp/level/streak/bestStreak/cumulativeMinutes/lastActiveDate`). `coach.notes.list({scope?,localDate?})` for the one-line brief. `LocalPasswordAuthProvider.requireUser()` → `{userId:'local-dev'}`.
- **Enum reconcile:** `SCREEN-TODAY.md` says Done/Skip write `source:'tap'`, but `completionSourceEnum` has no `'tap'` (`manual|capture|tool|rule|auto`) — map tap → **`manual`** (D-H).
- **Spec-silent, needs a plan decision (not invention):** Moss raised/line/ink values + per-theme semantic (`ok/warn/danger/scrim/ring`) values (DESIGN.md licenses "tune during screenshot-verify", §67); CSS var *names* for the type scale, fonts, spacing, easing; best-active-streak-across-domains aggregation location; the Today read-model shape. All resolved by D-A…D-F below.
- **Running-app DB:** tests use `memory-db`, but `next dev` reads a real local SQLite file. SAR-005 must apply the committed migration to a local db and seed a handful of rows to screenshot the populated states (dev-only; the real judge seed is SAR-020).

### File map (affected files, by change type)

| File | Change |
|---|---|
| `app/globals.css` | **rewrite** — 6 `[data-theme][data-mode]` token blocks + all token groups (surfaces/ink/line/energy/domain(+strong)/semantic/scrim/ring/elevation/radii/motion/spacing/type/font/easing) |
| `app/layout.tsx` | **edit** — wire `next/font`, the pre-paint theme script, render the shell |
| `app/lib/fonts.ts` | **new** — `next/font` families → `--font-*` vars (D-B) |
| `app/lib/utils.ts` | **new** — `cn()` (the `components.json` alias target) |
| `app/lib/session.ts` | **new** — server-only composition accessor: `requireUser()` → `forUser` → `repos` (D-E) |
| `core/domains/today.ts` + `core/domains/index.ts` | **new** — pure `buildTodayView` read-model + types (D-F) |
| `app/(app)/layout.tsx` + `app/(app)/today/page.tsx` | **new** — shell (nav + header + static capture bar) + Today Server Component |
| `app/(app)/{journey,coach,stats,tools}/page.tsx` | **new** — route stubs (placeholder text) |
| `components/shell/{BottomNav,LeftRail,AppHeader,CaptureBar}.tsx` · `components/today/*` · `components/ui/{Button,Card,Chip,StatPill}.tsx` · `components/dev/ThemeSwitcher.tsx` | **new** — token-driven primitives + Today parts + dev pill |
| `tests/today.test.ts` | **new** — pure read-model unit tests |
| `tests/tokens.test.*` | **new (if feasible)** — every theme-mode block defines the same variable set (no orphan) |
| `package.json` | **edit** — add `test` entry for `today.test`; add a `db:seed:dev` helper if used for verify |
| `docs/product/{DECISIONS,CHANGELOG}.md` | **edit (append-only)** — D-039 + truthful entry after evidence |

No schema/migration/provider/`core/contracts`/`data/` change. `core/` gains only the framework-clean `core/domains/today.ts`.

---

## Locked decisions for this ticket (sign these off)

**D-A · Token architecture = 6 `[data-theme][data-mode]` blocks; every style is a variable.** Rewrite `app/globals.css`: a base `:root` holding structure-invariant tokens (radii, durations, spacing, type scale, easing, font-family bindings) + six selector blocks `[data-theme="ember|bone|moss"][data-mode="light|dark"]` each redefining the color groups (surfaces `--bg-canvas/card/raised`, ink `--ink-1/2/3`, `--line`, `--energy`, `--dom-{health,money,habits,skills}(-strong)`, `--ok/--warn/--danger`, `--scrim/--ring`, `--elev-card`). Ember/Bone values from DESIGN.md §2 (Bone sets `--elev-card:none`, leaning on `--line` — a real per-theme behavior, not just color). **Moss raised/line/ink + all per-theme semantic/scrim/ring** are derived sensibly and flagged for screenshot-tuning (DESIGN.md §67 licenses this). New token groups get names: spacing `--space-1..6` (4px base, 16 gutter, 20 card-pad), type `--text-display-xl/display/title/body/caption` (size/leading pairs) + `--font-display/ui/coach`, easing `--ease-standard: cubic-bezier(0.2,0,0,1)`. Invariant #4: `--energy` referenced ONLY by XP/streak/level/Overall components; **no component contains a raw hex/rgb/px-radius/ms-duration** (grep-enforced in acceptance).

**D-B · Fonts via `next/font` (self-hosted at build → keyless).** `app/lib/fonts.ts` loads **Inter** (UI/body) + **Fraunces** (coach voice) + **Sora** (display) via `next/font/google`; `next/font` self-hosts at build time, so runtime needs no network/keys. Bound to `--font-ui/--font-coach/--font-display`; tabular numerals via `font-variant-numeric: tabular-nums` on stat clusters. **Clash Display (the spec's display face) is deferred** — Sora is its shipped fallback (DESIGN.md names Sora as the Clash fallback). Self-hosting Clash Display now is **OQ-2**.

**D-C · Theme application + temporary dev switcher (P0).** Theme+mode = `<html data-theme data-mode>`. A tiny inline pre-paint script in `layout.tsx` reads `localStorage['sarthi-theme']` and sets the attrs before first paint (no FOUC), defaulting Ember + `prefers-color-scheme` for mode. A **`"use client"` `ThemeSwitcher` pill** (floating, dev-only) cycles all 6 theme-modes and persists to `localStorage` — this satisfies P0 ("switching the pill restyles the entire shell live in all 6 theme-modes, AA-readable"). `layout.tsx` stays a Server Component; the pill + the inline script are the only client/inline surfaces. The pill relocates into Settings later (SAR-018) — it is explicitly temporary.

**D-D · App shell + navigation.** Mobile: a bottom tab bar — **Today · Journey · Coach · Stats · Tools** (lucide icons, 1.5px stroke) — with the **global capture bar docked directly above it** (mic ≥64px + text field + camera affordance), present on every tab. Desktop: a slim left icon rail + a 720px content column with the capture bar floating bottom-center. Header: screen title left, 32px avatar right → a Settings/Profile **sheet stub** (not a 6th tab). **The capture bar is static-visual only in SAR-005** — no mic/text/camera interaction (SAR-006/P1 wires it); it renders the resting state and the F2 "How'd it go?" affordance is a later flip. Journey/Coach/Stats/Tools are **route stubs** with placeholder text. Everything token-driven.

**D-E · Server-only composition accessor (the missing wire).** New `app/lib/session.ts` (with `import "server-only"`): `getSession()` composes the runtime config (`getRuntimeConfig()`) → the configured `AuthProvider` (`local-password` → `{userId:'local-dev'}`) → `createSqliteRepositoryFactory(databaseUrl).forUser(user)` → `UserScopedRepositories`, memoized per request. Returns `{user, repos}`. It NEVER exposes `userId` to client components and never accepts one from the client (SAR-003's scoping holds). `core/` is untouched; this edge lives in `app/`.

**D-F · Today read-model = pure framework-clean builder in `core/domains/today.ts` (→ D-039).** `buildTodayView(input: { items: PlanItemRecord[], progress: DomainProgressRecord[], arcs: PlanArcRecord[], coachNote: CoachNoteRecord | null, localDate: string }) : TodayView` — a **pure, deterministic, integer-safe, framework/DB-import-free** function that: groups items into `nextUp` (the single active card), `laterToday`, `completed`; computes the header cluster (`dayOfArc`/`arcLength` from the active arc, `bestActiveStreak` across domains, `overallLevel/xp` from `domain='overall'`); flags each item's `viaCapture` (`completionSource==='capture'`) and any satisfied-by display; and selects the day-state (fresh/mid-arc/all-done/nothing-planned/rest/new-user). Types exported from `core/domains/index.ts`. The Today Server Component only reads repos (D-E) + calls `buildTodayView` + renders — no logic in the component. Boundary-clean (invariant #9, `check:core-boundary`), unit-tested. Recorded as **D-039** on acceptance (the framework-clean read-model + composition-accessor pattern the mobile bake-off inherits, D-027).

**D-G · Today spine scope (thin).** SAR-005 renders, bound to real reads: the header scene (time-of-day variant + collapse-on-scroll) + the amber stat cluster; the domain switcher chip bar (All/Health/Money/Habits/Skills) swapping to **labeled placeholder lens bodies** (real lenses = SAR-008/9/10); the coach line (renders today's `coach.notes` row if one exists, else a neutral seeded line — NO coach engine); the plan spine (NEXT UP card with Done/Skip + LATER rows + COMPLETED cluster) from `plans.items`; and the **`via capture` + satisfied-by display** (read-only rendering of `completionSource`/source). Cover the SCREEN-TODAY states (fresh · mid-arc · all-done · nothing-planned · rest · new-user hint; arc-complete takeover may be a static stub). **OUT:** capture sheet/swipe deck/inline level-up, real lens bodies, coach generation, live commit-driven auto-check + XP roll.

**D-H · Done/Skip behavior — LOCKED (OQ-1 = real write).** A **real typed write** — a server action calls `repos.plans.items.update(id, { status, completionSource:'manual' })` through the D-E scope (screen doc's `'tap'` maps to enum `'manual'`), with optimistic UI + `revalidatePath`. This is an explicit tap, never an estimate (invariant #1 safe), and uses only the existing repository — NOT the commit-service auto-check path (that's SAR-006). The mutation stays server-side; the `"use client"` card only invokes the action.

**D-I · Minimal token-driven component kit (no full shadcn pull).** Add `cn()` at `app/lib/utils.ts` (the `components.json` alias target) and **hand-roll** the primitives SAR-005 needs (`Button, Card, Chip, StatPill, BottomNav/LeftRail, AppHeader, CaptureBar`) sourcing every value from tokens — rather than installing the shadcn dependency tree. Keeps the bundle lean and guarantees invariant #4. shadcn primitives are added later only where a specific screen requires one.

---

## Implementation steps (ordered — become the todo list)

1. **Token layer + fonts (D-A/D-B/D-C).** Rewrite `app/globals.css` into the base `:root` + 6 `[data-theme][data-mode]` blocks with all token groups; `app/lib/fonts.ts` (`next/font`) → `--font-*`; wire fonts + the pre-paint theme script in `layout.tsx`. `tests/tokens.test.*` (if feasible): every theme-mode block defines the same variable set (catch orphans); else rely on screenshot-verify. Grep-guard: no raw hex/px-radius/ms in components.
2. **Composition accessor + utils (D-E/D-I).** `app/lib/session.ts` (server-only), `app/lib/utils.ts` (`cn`). Bootstrap the local dev DB (apply the committed migration to a local sqlite file) so `next dev` can read; add a tiny dev seed for the verify states (dev-only; NOT the judge seed).
3. **Today read-model (D-F).** `core/domains/today.ts` + `index.ts`; `tests/today.test.ts` — grouping (NEXT UP = 1), Day N of M, best-active-streak, via-capture flag, day-state selection, integer-safe, boundary-clean. Wire into `pnpm test`.
4. **Shell + nav (D-D/D-I).** `app/(app)/layout.tsx` (bottom nav mobile / left rail desktop + header + static capture bar), the 4 route stubs, the dev `ThemeSwitcher` pill; hand-rolled `components/ui/*` + `components/shell/*`.
5. **Today screen (D-G/D-H).** `app/(app)/today/page.tsx` Server Component: read via D-E → `buildTodayView` → render header/stat-cluster/switcher/coach-line/plan-spine; Done/Skip per D-H; via-capture + satisfied-by display; the SCREEN-TODAY states via the seeded/fixture data.
6. **Screenshot-verify (DoD).** Mobile 390px + desktop, **Ember Dark + Light** at minimum, smoke the other theme-modes via the pill; the SCREEN-TODAY checklist states; save to `.verify/screens/`; fix against Premium-Dark intent + the screen doc, re-shoot.
7. **Validate + record.** `pnpm check` (typecheck/lint/core-boundary/all tests incl. `today.test`) + `pnpm build` + `check-invariants.sh`; append **D-039** + a truthful `CHANGELOG` entry after evidence; report changed files + output for Sol's diff review.

## Acceptance checklist (mirrors TICKETS SAR-005 + P0/P2 + invariant proofs)

- [x] All **6 theme-modes** selectable via `<html data-theme data-mode>`; the dev pill restyles the entire shell live, AA-readable text; **no component hardcodes a color/radius/duration** (grep clean) — invariant #4.
- [x] 5-tab shell (Today · Journey · Coach · Stats · Tools) + a **static** global capture bar present on every tab; header + avatar→Settings sheet stub; the 4 non-Today routes render stubs.
- [x] Today reads real `plans.items`/`progress`/`arcs` through the server-only accessor (D-E); **NEXT UP shows exactly one card** with Done/Skip; LATER + COMPLETED render; the header stat cluster is the only amber surface.
- [x] Domain switcher chips swap to labeled placeholder lens bodies (no real lenses); the coach line renders an existing note or a neutral seeded line (no engine).
- [x] `via capture` + satisfied-by **display** render from `completionSource`/source (read-only); Done/Skip behaves per the signed OQ-1.
- [x] The Today read-model is a **pure framework-clean** function in `core/domains/` (`check:core-boundary` clean); `core/` gains no React/Next/drizzle import.
- [x] No schema/migration/provider/`data/`/`core/contracts` change; keyless (Today renders against the local-dev SQLite scope with no provider keys).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm check:core-boundary`, `pnpm test`, `pnpm build`, `.codex/hooks/check-invariants.sh` all pass. **[ ] screenshots saved + verified at 390px + desktop — OPEN (needs a browser; Satvik runs the visual pass locally).**

## Verification (how Terra proves it, then Sol reviews)

```sh
pnpm install --frozen-lockfile     # next/font + lucide may add deps — lockfile updates expected here (unlike SAR-004)
pnpm check                         # typecheck + lint + core-boundary + all suites incl. today.test
pnpm build                         # Next build stays green (RSC + fonts)
bash .codex/hooks/check-invariants.sh
grep -rnE "#[0-9a-fA-F]{3,6}|[0-9]+ms|[0-9]+px" components app/(app) | ...   # no hardcoded style values in components (token check)
```

Screenshot-verify at 390px + desktop for the SCREEN-TODAY states (Ember Dark + Light minimum; pill-smoke the rest), saved to `.verify/screens/`. Keyless proof: the Today page renders through the `local-dev` scope against the local SQLite migration with all provider keys unset — no LLM/voice/vision call in SAR-005 (the coach line reads an existing note or a static seed).

## Open questions — RESOLVED at sign-off (2026-07-17)

- **OQ-1 (D-H) · Done/Skip write → (a) real typed write** via `plans.items.update` (`completionSource:'manual'`). Today is interactive, invariant-safe.
- **OQ-2 (D-B) · Display font → (a) Sora fallback now**; self-host Clash Display in a later polish ticket. Inter (UI) + Fraunces (coach) ship regardless.

## Handoff to Terra (`screens`)

Build only the token shell + thin Today spine. Preserve the accepted scaffold, provider ports, fake stack, schema, migrations, repository layer, and the SAR-004 capture core — **touch none of them**. `core/` gains only the framework-clean `core/domains/today.ts` (no React/Next/drizzle import — `check:core-boundary` must stay clean). Every style value is a token (invariant #4); `--energy` only on XP/streak/level. Do NOT build the capture sheet, real lenses, the coach engine, the live commit/auto-check path, or any schema/migration change. Screenshot-verify at 390px + desktop before claiming done. If the same acceptance item fails twice, stop and escalate.

---

### Post-approval sequence (after this plan is signed)
1. Fold the OQ-1/OQ-2 answers into D-H/D-B.
2. Create the TodoWrite/task list from the 7 ordered steps.
3. Build steps 1–7 in the main session (per Satvik's workflow), spawning parallel agents only where useful; screenshot-verify; then a read-only Sol diff review against this plan + TICKETS SAR-005 before SAR-006 begins.
4. `/handoff` at session end (`handsoff_05.md`).

**LANDED 2026-07-18 (code) — Sol review ACCEPTABLE TO LAND; 94 tests/build/invariants green; D-039 + CHANGELOG appended. Open DoD: visual screenshot-verify (Satvik's local pass). Next: plan SAR-006.**
