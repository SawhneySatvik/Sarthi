# Sarthi Handoff 01 — Tickets Locked, Build Deferred

| | |
|---|---|
| **Written** | 2026-07-17 |
| **Session state** | Stages 0–4 complete; Stage 5 has not started by owner request. |
| **Resume point** | `SAR-001` — Scaffold and import boundary. |
| **Build authority** | `docs/architecture/ARCHITECTURE.md` and `docs/planning/TICKETS.md` are signed. |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |

## 1. What is locked

- Product scope and invariants: repository-root `AGENTS.md` and `docs/product/DECISIONS.md` through D-035.
- Architecture: `docs/architecture/ARCHITECTURE.md`; it overrides the older interface sketches where more specific.
- Execution register: `docs/planning/TICKETS.md`, with 25 Terra-owned tickets.
- Execution cadence: D-035. Start the next dependency as soon as its predecessor acceptance passes; do not wait for a day, morning, evening, or calendar checkpoint.
- External constraint: submission remains due Jul 21, 5:00 PM PT. The deadline does not alter ticket acceptance or manufacture a cut.
- Build workflow: Sol writes each ticket plan and reviews diffs; Terra writes application code; Luna remains read-only. Do not use Sol to write production code unless the D-028 two-failed-attempt escalation applies.

## 2. Do not start broad implementation

No production application code has started. Do not combine the foundation tickets or begin screen work opportunistically.

1. Open `AGENTS.md`, then `docs/architecture/ARCHITECTURE.md`, then `docs/planning/TICKETS.md`.
2. Run `make doctor` and record any environment failure before changing code.
3. Write `.codex/plan.md` for **`SAR-001` only**. Obtain Satvik’s ticket-plan sign-off.
4. Assign `SAR-001` to the `pipeline` Terra role. The worker owns only the scaffold/import-boundary work and must not revert other changes.
5. Sol reviews the resulting diff and evidence. Only then create the plan for `SAR-002`.

## 3. SAR-001 contract

| Field | Requirement |
|---|---|
| **Ticket** | `SAR-001 — Scaffold and import boundary` |
| **Agent** | `pipeline` (Terra) |
| **Size** | M |
| **Depends on** | Nothing |
| **Source docs** | `AGENTS.md` §§2–4 · `docs/architecture/ARCHITECTURE.md` §§1, 9 · `docs/architecture/TECH-STACK.md` §§2–3 |
| **Acceptance** | Create the signed App Router/TypeScript/Tailwind/Drizzle/shadcn skeleton; add `pnpm check:core-boundary` and CI wiring; add typed runtime env parsing with keyless fake/local defaults; do not bypass `core/contracts` or hardcode design values. |
| **Evidence** | Project starts, type/lint/test scripts run as configured, `check:core-boundary` rejects a deliberate forbidden-import fixture or otherwise has a focused test, and the new tree matches Architecture §1.1. |
| **Does not include** | Real provider adapters, Drizzle tables, capture behavior, screens, auth, deploy, billing, or visual polish. |

## 4. Critical gates and fallback policy

- **F3 is the first real product gate.** `SAR-001`–`SAR-007` must deliver fake LLM/voice/vision + SQLite/local-password, route-by-confidence, Health/capture sheet, typed writes, XP, and single latest-batch undo. F3 must pass keylessly with `wrongSilentWrites = 0` before fan-out begins.
- **Nothing estimated writes unconfirmed.** Auto-write requires explicit `estimated: false`, `confidenceBps >= 9000`, complete integer payload, create intent, and no unanswered clarification. Anything else is a pending card.
- **Tenant scope is a repository capability.** Auth resolves identity; `RepositoryFactory.forUser()` binds it. Callers never pass `userId`/tenant filters. Dev is fixed `local-dev` over SQLite; prod is Supabase Auth/Postgres.
- **Billing is last.** Razorpay test checkout uses only `49900` paise/INR. If signed webhook/replay acceptance cannot be proven without blocking a higher-priority required gate, enable the scoped waitlist CTA. This never gates F3/F11 or the free seeded demo.
- **Money fallback.** Apply the light-ledger fallback only after Satvik explicitly records that full Money acceptance blocks a higher-priority gate. Do not silently cut Health, Skills, or the demo spine.
- **Visual proof.** Mobile 390px is the fidelity gate; desktop is a responsive smoke screenshot. Save proof in `.verify/screens/`.

## 5. Uploaded `.codex` skill policy

The skills below are available in `.codex/skills/`. Read a relevant `SKILL.md` before using it, but the Sarthi docs and `AGENTS.md` always win where they conflict.

| Skill | Use on Sarthi | Guardrail |
|---|---|---|
| `design-taste-frontend` | Selective preflight for the public landing and visual review. | It is not a dashboard/multi-step app-screen spec; Sarthi’s tokens, Inter UI type, Fraunces coach voice, and restrained motion override it. |
| `gpt-taste` | Disabled by default. | Its mandatory GSAP, random layout, banned-font, oversized-spacing, and Awwwards rules conflict with the signed mobile product/design contract. Consider only isolated, compatible landing-page ideas after explicit review. |
| `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `redesign-existing-projects` | Reference/audit tools only. | Do not replace Ember/Bone/Moss, painterly Premium Dark, token discipline, or the four screen/lens contracts. |
| `brandkit` | Use when creating or normalizing actual brand assets. | Follow `docs/experience/ASSETS.md`; no new brand system without a decision entry. |
| `image-to-code` | Use only for user-provided/reference screenshots. | Screens remain implementations of the screen specs, not pixel-traced substitutes for contracts. |
| `imagegen-frontend-mobile` | Generate mobile visual references only when asked. | It produces images, not UI code; match the Sarthi token palette and use the spec as source of truth. |
| `imagegen-frontend-web` | Generate public landing-section references only when asked. | It produces one image per section; use only for the landing, not the app shell. |
| `full-output-enforcement` | Apply when a ticket genuinely needs exhaustive generated output. | It does not override ticket scope, phased delivery, or the requirement to use `apply_patch` for edits. |

## 6. Required reading by upcoming ticket

| Ticket | Read before planning |
|---|---|
| `SAR-001` | `AGENTS.md` · `docs/architecture/ARCHITECTURE.md` §§1, 9 · `docs/planning/TICKETS.md` |
| `SAR-002` | Architecture §§2, 2.1 · `docs/architecture/TECH-STACK.md` §§1, 3 · runtime verification notes in Architecture §2 |
| `SAR-003` | Architecture §§3–4, 9 · D-030–D-033 |
| `SAR-004`–`SAR-007` | Architecture §§5, 8–9 · `docs/screens/SCREEN-CAPTURE.md` · FLOWS F3 · Health lens contract |
| Any `screens` ticket | `docs/experience/DESIGN.md`, its named `docs/screens/SCREEN-*.md`, and the linked flow before writing a component |
| Any `ship` ticket | Architecture §7, auth/pricing screen contract, D-031–D-033, and the corresponding Phase-1 ticket acceptance |

## 7. Current documentation inventory

- `docs/product/PHASES.md` — two rings, work-ordered gates, and cut lines.
- `docs/planning/TICKETS.md` — locked execution register and per-ticket acceptance evidence.
- `docs/architecture/ARCHITECTURE.md` — signed module graph, providers, schema, capture/undo, auth/billing/seed, and eval contracts.
- `docs/product/CHANGELOG.md` — provenance, architecture/tickets locks, and four Codex acceleration moments.
- `docs/operations/HANDOFF.md` — broad operating handoff; this file is the precise Session 1 resume note.

## 8. Resume prompt

Use this exact session opener when returning:

> Resume Sarthi from `docs/handsoff/handsoff_01.md`. Stages 0–4 are locked; build is deferred before `SAR-001`. Read `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, and `docs/planning/TICKETS.md`; run `make doctor`; then produce only the `.codex/plan.md` for `SAR-001` and stop for sign-off. Apply the `.codex` skill policy in the handoff; Sarthi’s locked design and architecture docs override skill defaults.

## 9. Open decisions

- D-006 only: choose the runtime provider for the recorded demo after both Gemini and GPT-5.6 adapters are proven.
- Do not reopen product, auth, billing, undo, or work-order decisions without a new append-only D-0XX entry.
