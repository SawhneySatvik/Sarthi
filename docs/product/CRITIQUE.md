# docs/product/CRITIQUE.md — Session 1 Adversarial Doc Audit

**Audit date:** 2026-07-17
**Scope:** `docs/product/PHASES.md` → `docs/architecture/TECH-STACK.md` → `docs/experience/FLOWS.md` → `docs/product/DECISIONS.md` → `docs/product/PRD.md` → `docs/experience/DESIGN.md` → `SCREEN-*.md` → `docs/planning/PLANNING-BRIEF.md` → `docs/operations/HANDOFF.md` → `docs/product/PROJECT.md`, plus the referenced prototype spine in `docs/experience/DESIGN-PROMPTS.md`.

## Executive result

The inner demo spine is coherent, but D-026–D-029 have not been propagated through the architecture, product, screen, and prototype docs. The principal risks are: incorrect silent writes, lack of tenant isolation, and an outer-ring checkout/auth plan that cannot yet be implemented without fresh decisions. No screen tells a production user to use the dev password gate; the problem is that the production auth journey is absent.

## 1. Contradictions

| ID | Severity | Finding | Proposed resolution |
|---|---|---|---|
| C1 | **CRITICAL** | `docs/architecture/TECH-STACK.md` §6 says “v1 ships single-user”; D-026 requires real Supabase Auth and `userId` scoping for every row. | Replace §6 with the D-026 production path and make repository-scoped user context mandatory. |
| C2 | **CRITICAL** | `docs/product/PRD.md` still puts multi-user and active monetization on the roadmap and describes monetization as off in v1; D-026/D-029 put auth, a payment rail, and a Pro flag in v1. | Amend PRD scope, out-of-scope, decisions, and roadmap sections to distinguish the Phase-1 rail from the deferred full paid catalogue. |
| C3 | **HIGH** | D-023 locks **Bone**, while `docs/product/PRD.md`, `docs/screens/SCREEN-ONBOARDING.md`, `docs/screens/SCREEN-SETTINGS.md`, `docs/screens/SCREEN-LENSES.md`, and `docs/experience/DESIGN-PROMPTS.md` still name **Slate**. | Make a surgical global Slate→Bone replacement where the token system is referenced; preserve the three-theme count. |
| C4 | **HIGH** | D-019 defers push notifications, but `docs/screens/SCREEN-SETTINGS.md` offers notification modes including streak-risk notifications. | Remove the functional notification settings from v1 or relabel them as on-open brief preferences with push explicitly deferred. |
| C5 | **HIGH** | D-029 defers payment-provider choice to the Jul 18 planning session, while `docs/product/PHASES.md` requires payment activation to start Jul 17. | Select the test-mode rail provider before activation work, or formally take cut line #1 now. |
| C6 | **MEDIUM** | `docs/product/PRD.md`, `docs/operations/HANDOFF.md`, and `docs/product/PROJECT.md` retain the pre-D-026 build calendar/status; `docs/product/PHASES.md` is the amended calendar. | Mark the legacy calendars/status as superseded and point all execution planning to `docs/product/PHASES.md`. |
| C7 | **MEDIUM** | D-020 calls desktop a responsive stretch, while AGENTS.md and most screen checklists require mobile and desktop screenshots. | Define desktop as a required smoke screenshot, with mobile as the visual fidelity gate; update D-020 and the verification language consistently. |

## 2. Staleness

| ID | Severity | Finding | Proposed resolution |
|---|---|---|---|
| S1 | **HIGH** | `docs/operations/HANDOFF.md` reports 18 docs, 25 locked decisions, “planning done,” and an environment bridge; the repository has D-026–D-029 and a new sellable-ring mandate. | Refresh its state, decision count, and next-session order after the document lock. |
| S2 | **HIGH** | `docs/product/PROJECT.md` is dated Jul 15, says “scaffolding in Codex,” and treats the `/feedback` ID as already captured without describing Phase 1. | Update the status block and concise product summary after the lock; retain it as the README seed. |
| S3 | **HIGH** | `docs/architecture/TECH-STACK.md` interface sketches predate D-026: no auth-bound repository calls, billing, judge seed, or production provider override policy. | Move the signed details into `docs/architecture/ARCHITECTURE.md`, then replace stale sketches with pointers rather than duplicate them. |
| S4 | **MEDIUM** | `docs/experience/DESIGN-PROMPTS.md` is a mock-prototype guide but calls itself the Codex ticket spine without excluding its Slate names and mock-only assumptions. | Keep it as visual acceptance source, but declare `docs/planning/TICKETS.md` and `docs/architecture/ARCHITECTURE.md` authoritative for real data/auth behavior. |
| S5 | **MEDIUM** | `docs/experience/FLOWS.md` F11 still assumes a seed gesture and a developer provider flip but does not explain how either is safe for a public authenticated deployment. | Specify a judge-safe demo-seed action and restrict provider overrides to a controlled judge/development mode. |

## 3. Sellable-ring gaps

| ID | Severity | Needs a spec? | Smallest viable shape | Proposed resolution |
|---|---|---|---|---|
| G1 | **CRITICAL** | Yes | `/signup`, `/login`, and `/reset-password`; new user → onboarding; existing user → Today; legal links and auth-error states. | Add one auth-flow spec with Supabase email/password as the default pending Satvik’s call. |
| G2 | **CRITICAL** | Yes | All repository methods receive `userId`; every table has `userId`, indexes, and a unique/foreign-key policy; no caller-provided tenant filters. | Make user scope an authenticated repository capability, not optional `list(where)` data. |
| G3 | **HIGH** | Yes | One pricing route with one price, Free/Pro rows, CTA, checkout start, success/cancel, and a visible non-gating Pro affordance. | Add a pricing/checkout flow after the provider and price are chosen. |
| G4 | **CRITICAL** | Yes | Server-verified webhook: provider event id, idempotency, authenticated user mapping, `plan` update, failure/retry handling, and audit record. | Define the plan-flip contract before implementing checkout. |
| G5 | **HIGH** | Yes | New authenticated user may choose “Try the 12-day demo”; seed only that user’s typed rows, once, and remain free. | Replace hidden gesture-only seeding with an idempotent per-user seed contract. |
| G6 | **MEDIUM** | Yes | `/privacy` and `/terms` static routes, honest AI/data/storage language, linked from auth and footer. | Add legal-stub content and route requirements to the ship slice. |
| G7 | **MEDIUM** | Yes | Web manifest, icons, app name, theme color, display mode, install prompt behavior, and explicit no-offline-sync position. | Add a concise PWA manifest spec; do not imply offline queueing. |
| G8 | **HIGH** | Yes | Dev-only or judge-authorized request-scoped provider override; production defaults never change from a client control. | Specify the provider-demo gate and remove the public 7-tap security-through-obscurity assumption. |
| G9 | **MEDIUM** | Yes | A build-time import boundary check that rejects Next.js/React imports in `core/`. | Add the enforcement command to architecture and CI/eval acceptance. |

## 4. Timeline risks

| ID | Severity | Finding | Proposed resolution |
|---|---|---|
| T1 | **CRITICAL** | The Jul 17 plan asks for scaffold, fake providers, four typed schemas, the capture engine, Health lens/sheet, tests/eval, and F3 in one day while payment activation starts in parallel. This is red-risk, not an ordinary stretch. | Treat F3 as the only Day-2 exit: if it is not green by end of Jul 17, fire cut line #1 at the Jul 18 morning checkpoint and defer live billing to a payment-link/test-rail fallback. |
| T2 | **HIGH** | The outer ring has auth, deploy, landing, billing, legal, and judge seed across Jul 18–20 but lacks public-flow specs and any provider decision. | Resolve G1–G5 before ticketing; otherwise Phase 1 work cannot parallelize safely. |
| T3 | **HIGH** | Screenshot verification across all states/themes is scheduled after a very large spine, but the developer gate requires mobile and desktop evidence after screens/states. | Timebox screenshots to the F3 capture states first, then screen-level representative states; record any non-blocking desktop deviations explicitly. |

## 5. Invariant conflicts and ambiguities

| ID | Severity | Finding | Proposed resolution |
|---|---|---|
| I1 | **CRITICAL** | The auto-write rule is inconsistent: AGENTS.md/`docs/architecture/TECH-STACK.md` require explicit **and high-confidence** values, while `docs/screens/SCREEN-CAPTURE.md` auto-files every `estimated:false` proposal. No owner or numeric threshold exists. | Put a router-owned threshold in the capture contract; below it, even an explicit value stays pending for confirmation. |
| I2 | **CRITICAL** | “Every write is undoable” has no atomic undo model for batch commits, edits, XP, plan completion, satisfied-by side effects, or retries. `remove(id)` cannot restore an edited row. | Specify an append-only reversible commit record with a compensating transaction that restores all derived state. |
| I3 | **HIGH** | Correction/backdate flows require matching an existing entry and preventing duplicates, but the proposal contract carries neither intent nor target entry identity. | Add explicit correction/backdate intents and a match-selection/confirmation path before commit. |
| I4 | **HIGH** | `docs/screens/SCREEN-CAPTURE.md` promises an offline queue even though offline-first sync is excluded and no queue/idempotency contract exists. | Remove the persistent queue promise from v1 or define a local outbox that always re-enters confirmation and never auto-writes estimates. |
| I5 | **HIGH** | Focus auto-logs abandoned sessions at ≥50% without defining whether elapsed time is user-confirmed or how Undo affects XP/mastery. | Treat timer completion/elapsed duration as an explicit event only after the user starts the timer; define the same reversible commit path as capture. |
| I6 | **MEDIUM** | The “suggest a tool” card writes an unspecified feedback row, outside the four domain stores and without a schema or decision entry. | Make it session-only in v1 or add a deliberate typed non-domain table in a later scope decision. |
| I7 | **MEDIUM** | “Typed writes only” is weakened by `targetTable: string` and `payload: Record<string, unknown>` in the core capture sketch. | Use a discriminated proposal union validated per target table, with no generic persistence route. |

## 6. Underspecified data contracts

| ID | Severity | Finding | Proposed resolution |
|---|---|---|
| D1 | **CRITICAL** | There is no full production schema: row ids, `userId`, timestamps, ownership relations, deletion/undo metadata, and indexes are absent. | `docs/architecture/ARCHITECTURE.md` must define every Drizzle table and tenant index before schema work begins. |
| D2 | **HIGH** | Integer-unit rules are not mechanically represented: `Transaction.amount`, `Weighin.kg`, and profile weight use ambiguous names/scales; screens mix kg, kg×10, and grams. | Adopt canonical field names/scales (`amountPaise`, `waterMl`, `durationMinutes`, `weightGrams` or one documented integer scale) plus boundary conversion helpers. |
| D3 | **HIGH** | `Plan/Arc`, `Progress.stats_json`, `profile_gap`, Day-1 snapshots, evidence/photo references, and milestone events are named but not typed. | Define their row shapes, ownership, lifecycle, and derived-vs-persisted rules in the architecture pass. |
| D4 | **HIGH** | `CaptureDraft` lacks source modality/evidence references, parse version, commit idempotency key, temporal context, and question-card answer shape. | Expand the transient draft/proposal contract before fake fixtures or parser prompts are written. |
| D5 | **MEDIUM** | Coach notes, adaptations, daily/weekly staleness, and ask turns lack an idempotency/schedule contract. | Define trigger inputs, cache keys, visibility, and one active brief per scope/day. |
| D6 | **MEDIUM** | Eval lists metrics but not fixtures, denominators, a wrong-silent-write definition, baseline, or report schema. | Define deterministic fixtures and a typed A/B report with wrong-silent-write as a hard-zero metric. |

## Findings table

| Priority | Must resolve before | Finding IDs |
|---|---|---|
| **CRITICAL** | Docs lock / architecture | C1, C2, G1, G2, G4, T1, I1, I2, D1 |
| **HIGH** | Ticketing the affected slice | C3–C5, S1–S3, G3, G5, G8, T2–T3, I3–I5, D2–D4 |
| **MEDIUM** | Ticketing / polishing the affected slice | C6–C7, S4–S5, G6–G7, G9, I6–I7, D5–D6 |

## Satvik decision batches

### Batch A — trust boundary

1. **Silent auto-write threshold**
   - **`estimated:false` and proposal confidence ≥0.90 (recommended):** maximizes trust; everything else gets a card.
   - `estimated:false` and confidence ≥0.80: lower-friction, higher silent-write risk.
   - No auto-writes: safest, but breaks the explicit-values speed promise.

2. **Undo contract**
   - **Batch + row undo for 5 minutes, using a compensating commit record (recommended):** reverses typed row plus XP, plan, and satisfied-by side effects atomically.
   - Session-only undo: simplest, but weaker recovery after dismissal/reload.
   - One undo per individual row only: lower implementation cost, but awkward for multi-domain capture.

3. **Offline capture in v1**
   - **No persistent offline queue (recommended):** show retry while retaining the draft in the open sheet; stays within the no-offline-sync scope.
   - Local outbox that reopens confirmation on reconnect: more resilient, adds idempotency/outbox work.
   - Full offline queue/sync: out of Phase 0/1 scope.

### Batch B — sellable rail

1. **Phase-1 auth method**
   - **Supabase email/password + reset (recommended):** deterministic demo path and no email-link delivery dependency.
   - Magic link only: less password UI, but adds delivery/configuration risk.
   - Both: better UX, unnecessary scope for this deadline.

2. **Checkout rail and price**
   - **One Stripe test-mode checkout at a single launch price (recommended):** fastest fully testable webhook rail if activation is available.
   - Razorpay test-mode at a single INR price: India-first, but depends on activation readiness.
   - Payment-link/waitlist fallback now: immediately fires cut line #1; preserves auth/pricing/judge path.

3. **Judge/demo seed access**
   - **Authenticated “Try the 12-day demo” choice after signup (recommended):** clones typed seed rows only into that user, once, with all demo paths free.
   - Seed every new user automatically: fastest but risks overwriting the new-user experience.
   - Private gesture only: insufficient for stranger/judge access.

## Stage 2 resolution record — 2026-07-17

All findings are resolved by an explicit decision or source-doc amendment; none are accepted as-is.

| Findings | Resolution landing |
|---|---|
| I1, I2, I4, I5, D2 | D-030; `docs/architecture/TECH-STACK.md`, `docs/screens/SCREEN-CAPTURE.md`, `docs/screens/SCREEN-TOOLS.md`, `docs/screens/SCREEN-LENSES.md`, and `docs/experience/FLOWS.md` now specify ≥.90 routing, latest-batch five-minute compensating undo, no offline outbox, timer semantics, and canonical integers. |
| C1, G1, G2, D1 | D-031; `docs/architecture/TECH-STACK.md` and `docs/screens/SCREEN-AUTH.md` preserve local SQLite/password/fake dev while making production Supabase Auth and repository-bound `userId` scope mandatory. |
| C5, G3, G4, T2 | D-032; `docs/product/PHASES.md`, `docs/screens/SCREEN-PRICING.md`, and `docs/architecture/TECH-STACK.md` specify Razorpay test mode, ₹499/year (`49900` paise), the webhook/plan gate, last-ticket sequencing, and the Jul 20 fallback. |
| G5, S5 | D-033; `docs/screens/SCREEN-ONBOARDING.md`, `docs/screens/SCREEN-PRICING.md`, `docs/screens/SCREEN-SETTINGS.md`, and `docs/experience/FLOWS.md` define authenticated opt-in, idempotent, free judge seed access. |
| C7, T3 | D-034; `docs/experience/DESIGN.md` and screen checklists establish mobile fidelity plus required desktop smoke screenshots. |
| C2–C4, C6, S1–S4 | `docs/product/PRD.md`, `docs/product/PROJECT.md`, `docs/operations/HANDOFF.md`, `docs/experience/DESIGN-PROMPTS.md`, and the screen specs now carry the Phase-1 ring, Bone themes, current calendar authority, and on-open rather than push notification policy. |
| G6–G9, I3, I6–I7, D3–D6 | `docs/screens/SCREEN-AUTH.md`, `docs/screens/SCREEN-PRICING.md`, `docs/architecture/TECH-STACK.md`, `docs/experience/FLOWS.md`, and `docs/screens/SCREEN-TOOLS.md` now set the legal/PWA/provider/core-boundary/correction/no-generic-persistence requirements; their complete schema and execution contracts are mandatory Stage-3 architecture gates. |
