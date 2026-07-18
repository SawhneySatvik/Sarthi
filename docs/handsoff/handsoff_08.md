# Sarthi Handoff 08 — Vision + Onboarding landed (SAR-011, SAR-012)

| | |
|---|---|
| **Written** | 2026-07-18 |
| **Session state** | `SAR-001`–`SAR-010` accepted/landed (F3 gate met; four lenses screenshot-verified). **✅ `SAR-011` (Meal/receipt vision path, D-045)** and **✅ `SAR-012` (Onboarding + real plan creation, D-046)** LANDED. SAR-012 is the full SCREEN-ONBOARDING flow (A welcome → B core → C spine-gen → D confirm + the atomic accept write → E DETAIL → F theme → G landing on Today Day-1), built in three gated passes. `pnpm check` **192 tests** green, invariants + HARMONY clean, keyless. |
| **Resume point** | Plan + build **`SAR-013` — Voice PTT + transcript safety** (next F3→fan-out lane ticket) → then SAR-014 (coach engine + game mechanics, which also consumes the onboarding `profile_gaps` via the daily brief). Keyless on the fake stack. Per-ticket flow: architect plan → Terra build → Sol code review + `pnpm check`/invariants → D-041 screenshot design review → commit. |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/planning/TICKETS.md` are signed; D-001–D-046 are constraints. Ticket plans in `.codex/plans/SAR-0NN.md` (SAR-012's is approved). |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `948141b` on `main` is the last main commit. Branch **`sar-003-schema-repository`** carries the committed SAR-003→SAR-012 trees (stacked; **not merged to `main`**). SAR-012 = commits `7701ba7`/`9355d1b`/`a97cd3f` (P1) · `c51b599`/`283df91` (P2) · `a1236db`/`4e23fce` (P3). Working tree clean. Branch/merge posture is Satvik's call. |

## 1. Locked execution state

- **SAR-012 ships the production new-account path (D-046), keyless.** A stranger can sign up (keyless local user) → answer B1–B6 → watch the four spines draft (C, answer-derived, through the gateway with a deterministic fake) → confirm/trim the plan (D) → the ONE atomic accept write creates profile + per-domain plan arcs/items + habits + skills/milestones + money categories + Day-1 snapshots + `profile_gaps` + a deterministic Day-1 coach note, flipping `onboardingStatus:complete` → optional DETAIL (E, resolves gaps) → theme (F) → land on **Today Day-1** with the plan populated from the spine, the coach's first line, and the one-time mic hint. This is FLOWS **F1**.
- **Invariants held:** integer units (paise/minutes/ml/grams, no float); nothing writes before the D-tap; the accept write is atomic + replay-safe (in-txn status re-check → clean replay; intra-payload dup-name collapse; schema/timezone boundary guards); provider-blind keyless (spine-gen through the gateway + fake adapter); `core/` framework-import-clean; tokens-only UI (amber only when earned — D-041; the A→D onboarding hairline is the sanctioned SCREEN-ONBOARDING §1 exception, hidden post-accept); repository-bound `userId` scoping; demo path never paywalled (the demo gesture is keyless, local-mode-only, 404 otherwise).
- **Workflow:** Sol plans + reviews (code AND rendered screenshots, D-041) · Terra writes all code · Luna orchestrates. Passes 1–2 each ran plan → build → Sol code review + Sol D-041 design review → fix cycles → GATE PASS → commit. **Pass 3 was closed at Satvik's call without the final screenshot re-review loop** (two residual polish items fixed directly). New decisions: **D-045** (vision path), **D-046** (onboarding). Open decision unchanged: **D-006** (demo runtime provider).
- **External deadline:** Tue Jul 21, 5:00 PM PT.

## 2. Landed-ticket evidence (this session)

- **SAR-011 — Meal/receipt vision path (D-045).** Camera → photo preview + meal/receipt toggle → `parse-photo` → `FakeVisionProvider` → `core/capture/vision.ts` → the same estimate-card loop; any proposal with photo evidence routes to **pending** (invariant #1, re-enforced server-side; `f5-receipt` eval `wrongSilentWrites === 0`). Gated (Sol code + D-041). `pnpm check` 155.
- **SAR-012 — Onboarding (D-046), three passes:**
  - **P1** — routing gate (`app/(app)/layout.tsx` async redirect on `onboardingStatus`; `SEED_STATE=fresh`) + Phase A welcome + Phase B B1–B6 (metric-int body, min-1-domain, fast-tier fake voice-fill) + localStorage draft/resume. `core/onboarding/{contract,fill}.ts` framework-clean.
  - **P2** — Phase C spine-gen (`core/onboarding/{spine,generate}.ts`, deriveSpine answer-derived, under-18 branch, fake envelope, 8s parallel + retry, StrictMode-safe) + Phase D confirm cards (editable steppers, swipe-drop, regenerate, earned amber CTA) + **the atomic accept write** (`core/onboarding/accept.ts`) + F1 integration test. Code review found 3 HIGH (concurrency re-check, intra-payload dup-name 500, StrictMode hang) + fixes landed.
  - **P3** — Phase E DETAIL (`core/onboarding/detail.ts` + `components/onboarding/detail/*`, 5 sections resolving accept-created gaps, single-flight, integer-paise E5 recurring seeds) + Phase F theme (`ThemeStep.tsx`, real previews, persist, app-mode-aware ring) + Phase G landing (`Landing.tsx` + `components/today/TodayHintRow.tsx`) + the `seed_runs`-idempotent demo gesture (`data/seed/demo.ts` shared with `seed-dev`; `app/api/dev/seed-demo` 404 unless local).

**Recorded deferrals / follow-ups (each in D-046):**
- Daily-brief gap CONSUMPTION → SAR-014 (SAR-012 only enqueues + resolves gaps).
- Auth sign-in + authenticated demo-clone → SAR-021+ (outer ring).
- Real voice audio → SAR-013.
- **E-section voice-fill parity deferred** — the 5 DETAIL sections are chip/slider-only in v1 (optional, skippable, gap-backfilled); E5 voice-first ("rent 15000") is the highest-value follow-up.
- SAR-012 Pass-3's two polish fixes (Today section-eyebrow AA → `ink-2`; E-grid Done CTA → `min-h-11`) are `pnpm check`-green but **un-re-screenshotted** (trivial class changes).
- Carry-forward for SAR-021: the demo seed-route guard rests on `AUTH_PROVIDER` defaulting to local — the deploy checklist MUST assert `supabase`.

## 3. Repository map (additions this session)

```text
core/onboarding/{contract,fill,spine,generate,accept,detail}.ts   framework-clean onboarding logic (invariant #9)
components/onboarding/*                                             A/B steps, spine shimmer, confirm cards, DETAIL, theme, landing, welcome demo gesture
app/onboarding/*, app/api/onboarding/{fill,spine,accept,detail}    the /onboarding route + its adapters
app/api/dev/seed-demo, data/seed/demo.ts                           the shared idempotent demo seed (local-mode only)
app/(app)/layout.tsx                                               the async onboardingStatus routing gate (force-dynamic)
components/today/{TodayHintRow,TodayBody,PlanSpine}.tsx            Day-1 hint row; section eyebrows lifted to ink-2
scripts/seed-dev.ts                                               SEED_STATE=fresh + complete-profile for other states; delegates to seedDemo
scripts/screenshot.mjs                                            SHOTS=onboarding (A→G walk incl. 4-domain, retry, theme, landing)
tests/onboarding-{contract,spine,accept,detail}.test.ts          keyless onboarding tests (155 → 192)
.verify/screens/onboarding-*.png                                 D-041 evidence (390 + desktop, Ember D+L)
```

Commands: `make doctor` · `pnpm check` (**192 tests**) · `pnpm test:eval` (F3/F5) · `pnpm build` · `.codex/hooks/check-invariants.sh` · **`pnpm screenshots`** (build → `SEED_STATE=fresh pnpm db:seed:dev` → `PORT=<p> pnpm start` up → `SHOTS=onboarding BASE_URL=http://localhost:<p> node scripts/screenshot.mjs`; kill the server after; use a fresh port per pass — the DB client pins at first request).

## 4. SAR-013 boundary (next ticket)

**Ticket:** `SAR-013 — Voice PTT and transcript safety` · **Agent:** `pipeline` (Terra) · `docs/planning/TICKETS.md` ~line 156. Press-and-hold/tap-to-talk records bounded audio through `VoiceProvider` only (fake deterministic + keyless); enforce the signed 30-second Sarvam REST limit before upload; provider/network failure leaves a retryable open draft, writes no outbox/typed row; the transcript is visibly pinned before parse; text capture keeps the exact same routing/commit path. Read `docs/architecture/ARCHITECTURE.md` §§2,5 + `docs/screens/SCREEN-CAPTURE.md` §§2,7,10 + `docs/architecture/TECH-STACK.md` §3. Do NOT wire a real voice key.

**HARD STOP boundary:** the outer-ring sellable wrap — `SAR-021`+ (production auth, live Vercel/Supabase deploy, Razorpay billing, real secrets). Outward-facing / needs Satvik's accounts. Keyless work runs SAR-013 → SAR-020 at most, then stops.

## 5. Resume procedure

1. Read this handoff, `AGENTS.md`, `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-013, `docs/architecture/ARCHITECTURE.md` §§2,5, and D-045/046.
2. Run `make doctor`; inspect `git status --short` (clean; spine stacked on `sar-003-schema-repository`).
3. Optionally walk onboarding locally: `SEED_STATE=fresh pnpm db:seed:dev && pnpm dev` → `/onboarding` (A→G), or `SEED_STATE=populated …` → Today.
4. Write `.codex/plans/SAR-013.md` (architect), build (Terra), Sol code + D-041 design review, commit — per the standing loop.

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_08.md`. `SAR-001`–`SAR-012` are accepted/landed — the four domain lenses, the meal/receipt vision path (D-045), and **full onboarding** (D-046: routing gate → answer-derived spine-gen → atomic accept write → DETAIL/theme/landing → Today Day-1) are all real; `pnpm check` **192 tests** green, keyless. Read `AGENTS.md`, `.codex/GOAL`, `docs/planning/TICKETS.md` SAR-013, `docs/architecture/ARCHITECTURE.md` §§2 (VoiceProvider) + 5 (capture); run `make doctor`; inspect `git status --short` (spine stacked on `sar-003-schema-repository`). Then plan + build **SAR-013 (Voice PTT + transcript safety)** — press-and-hold audio through `VoiceProvider` only, keyless fake, the signed 30s limit, retryable-open-draft on failure, transcript pinned before parse, text path unchanged; do not wire a real voice key. Preserve the keyless fake stack, integer units (no float), tokens-only UI (amber only when earned), repository-bound `userId` scoping, and the no-silent-estimate invariant. HARD STOP before SAR-021 (outer-ring deploy/auth/billing).

## 6. Session note

This session ran with Satvik present. SAR-012 was built architect-first (plan approved) in three gated passes. Several fix passes hit transient mid-stream API stalls on large multi-file edits — recovered by re-dispatching **file-disjoint, surgical, exact-target** edit runs (the reliable anti-stall pattern; keep fix agents tight and reading-light). Pass 3's final screenshot re-review loop was **closed at Satvik's call** — the two residual polish items were fixed directly and `pnpm check` is green, but those two are not re-screenshotted. Everything else was gated normally (Sol code + D-041).
