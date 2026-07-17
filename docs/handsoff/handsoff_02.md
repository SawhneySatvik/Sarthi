# Sarthi Handoff 02 — Foundation and Fake Stack Accepted

| | |
|---|---|
| **Written** | 2026-07-17 |
| **Session state** | Stage 5 active; `SAR-001` and `SAR-002` are accepted. `SAR-003` is not planned or started. |
| **Resume point** | Plan **`SAR-003 — Dialect schema and bound repository factory`** only, then stop for Satvik’s ticket-plan sign-off. |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, and `docs/planning/TICKETS.md` are signed; D-001–D-036 are constraints. |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `56a71a2` signed contract · `cc025e5` app foundation · `e627247` project skills · `3d85e42` provider/fake stack. This handoff is committed next. |

## 1. Locked execution state

- **Product and safety:** `AGENTS.md` invariants apply without exception. Estimates never write unconfirmed; money/quantity values stay integer; typed domain writes only; `core/` remains framework/provider/DB-import clean; the free demo is never paywalled.
- **Workflow:** Sol plans and reviews; Terra writes application code; Luna stays read-only. Every ticket requires its own approved `.codex/plan.md`, then Terra implementation, then a final review gate. Do not start a later ticket opportunistically.
- **Work order:** `SAR-001` → `SAR-002` are accepted. `SAR-003` and `SAR-005` may become dependency-eligible after their own plans, but the signed handoff advances next to `SAR-003`; `SAR-004` remains blocked on both `SAR-002` and `SAR-003`.
- **External deadline:** Tue Jul 21, 5:00 PM PT. D-035 forbids elapsed-day checkpoints; only dependency and acceptance evidence advance work.
- **Open decision:** D-006 only — select Gemini or GPT-5.6 for the recorded demo after both are proven. Do not reopen auth, billing, undo, provider, or scope decisions without a new append-only D-0XX entry.

## 2. Accepted ticket evidence

### SAR-001 — Scaffold and import boundary

**Accepted outcome**

- Next.js App Router, TypeScript, Tailwind, Drizzle, and shadcn configuration are scaffolded with locked dependencies and CI.
- `app/lib/runtime.ts` provides server-only, typed runtime selector parsing. Default path is fake LLM/voice/vision, `local-password`, SQLite, waitlist billing, and judge mode off.
- `scripts/check-core-boundary.mjs` uses the TypeScript AST to reject prohibited `core/` imports: Next, React, Drizzle, Supabase, AI SDK providers, and concrete provider paths. It handles re-exports, dynamic imports, `require`, comment-interposed calls, alias traversal, and `import("next").Type`.
- The focused regression suite has safe and forbidden fixtures. No application/product behavior, DB schema, or UI exists in this ticket.

**Evidence**

- Passed: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, and `.codex/hooks/check-invariants.sh`.
- Review fixes completed: AST parsing replaced a regex bypass; type-only imports and normalized aliases are tested.

### SAR-002 — Provider ports and deterministic fake stack

**Accepted outcome**

- Provider ports now live in `core/contracts/providers.ts` and are re-exported through `core/contracts/index.ts`: `LlmGateway`, `VoiceProvider`, `VisionProvider`, request/result contracts, provider selectors, and `Tier`.
- `providers/llm/matrix.ts` is immutable and exposes only the verified matrix:
  - Google: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`.
  - OpenAI: `gpt-5.6-sol` (`gpt-5.6` alias inventory), `gpt-5.6-terra`, `gpt-5.6-luna`.
  - Fake: deterministic IDs for deep/balanced/fast.
  - Anthropic: explicitly disabled, no guessed model ID.
- `providers/llm/ai-sdk.ts` contains the Google/OpenAI adapter. `providers/llm/index.ts`, `providers/voice/index.ts`, and `providers/vision/index.ts` select only explicit factories; unsupported/deferred providers throw clear configuration errors and never fall back silently.
- `providers/fake/` supplies versioned canonical capture, coach, brief, meal-photo, receipt, and transcription fixtures. Fake LLM/voice/vision are deterministic, schema-validating, API-key-free, and network-free.
- **Safety repair:** the canonical phrase “drank a bottle” now has `estimated: true`, `confidenceBps: 6000`, and `millilitres: null`. It cannot become an invented 1L silent write; `tests/providers.test.ts` asserts it fails explicit auto-write eligibility.

**D-036 package alignment**

- Exact runtime packages are locked: `ai@7.0.28`, `@ai-sdk/google@4.0.16`, `@ai-sdk/openai@4.0.15`, and `@ai-sdk/anthropic@4.0.15`.
- This replaces the incompatible OpenAI 2.x package pin while preserving every runtime model ID. `generateObject` remains available on AI SDK 7 for the locked capture path, though its future migration is `generateText` plus `Output.object`.
- `tsx@4.20.6` is the focused TypeScript test runner.

**Evidence**

- Passed: `pnpm install --frozen-lockfile`, `pnpm check` (13 core-boundary + 5 provider tests), `pnpm build`, and `.codex/hooks/check-invariants.sh`.
- Fake-stack tests use a failing `fetch` sentinel and unset provider keys. They cover deterministic object/text/voice/vision output, schema validation failure, disabled Anthropic, exact model IDs, and Google/OpenAI factory construction without a live request.
- In this restricted sandbox, `tsx` needs approved escalation for its local IPC socket. That is an execution-sandbox limitation, not a network or source failure. The final escalated test run passed.

## 3. Current repository map

```text
app/lib/runtime.ts              parsed server-only runtime configuration
core/contracts/providers.ts     portable provider interfaces and request/result types
providers/llm/                  matrix, AI SDK adapter, LLM factory
providers/voice/                fake-only factory until a later adapter ticket
providers/vision/               fake-only factory until a later adapter ticket
providers/fake/                 versioned keyless fixtures and fake adapters
scripts/check-core-boundary.mjs AST enforcement for the core import boundary
tests/core-boundary.test.mjs    boundary regression suite
tests/providers.test.ts         deterministic provider/fake-stack suite
data/                           placeholders only — SAR-003 owns schemas/repositories
core/capture/                   placeholder only — SAR-004 owns routing/commit/undo
```

Useful commands:

```sh
make doctor
pnpm install --frozen-lockfile
pnpm check
pnpm build
.codex/hooks/check-invariants.sh
```

Use the necessary approved escalation when the sandbox blocks a tool’s local worker/IPC process. Never use a live key or network call to validate the F3 fake stack.

## 4. SAR-003 boundary

**Ticket:** `SAR-003 — Dialect schema and bound repository factory` · **Agent:** `pipeline` (Terra) · **Depends:** `SAR-001` only, but do not build before its standalone plan is approved.

Read before planning:

- `AGENTS.md` §2
- `docs/architecture/ARCHITECTURE.md` §§3–4, 9
- `docs/product/DECISIONS.md` D-030–D-033 and D-036
- `docs/planning/TICKETS.md` SAR-003

Required SAR-003 acceptance:

1. Implement the signed SQLite and Postgres Drizzle declarations, constraints, indexes, migrations, and Zod support shapes; every persistent user row has non-null `userId`.
2. Implement `RepositoryFactory.forUser()` and concrete typed repositories; callers never pass a `userId`, arbitrary SQL, or a tenant filter.
3. Implement `LocalPasswordAuthProvider` returning `local-dev` and SQLite wiring so dev/CI never requires Supabase.
4. Provide transaction/rollback behavior and SQLite migration smoke coverage; leave the equivalent Postgres composition path ready.

Do not borrow capture routing, generic persistence, a live Supabase client, screens, or a local auth UI from later tickets. The full signed table contract in Architecture §4 is the source of truth; no table may be silently omitted or generalized.

## 5. `.codex` skill policy

- The full policy remains in `docs/handsoff/handsoff_01.md` §5 and still applies.
- `gpt-taste` is disabled by default; its GSAP, random layout, fonts, and spacing rules conflict with signed Sarthi product UI.
- The image-generation skills create visual references only and are not relevant to SAR-003.
- Read a relevant skill before use, but `AGENTS.md`, the architecture, and screen/design docs override every skill default.

## 6. Resume procedure

1. Read this handoff, `AGENTS.md`, `docs/architecture/ARCHITECTURE.md` §§3–4, and `docs/planning/TICKETS.md` SAR-003.
2. Run `make doctor`; if the restricted sandbox reports provider reachability failure, rerun with approved escalation before diagnosing the user’s connection.
3. Inspect `git status --short` and the committed history; do not overwrite work outside SAR-003.
4. Write `.codex/plan.md` for **SAR-003 only**, with the full table/repository/auth boundary and migration/test evidence.
5. **STOP for Satvik’s SAR-003 plan sign-off.** Only then assign the exact plan to the Terra `pipeline` role.
6. After implementation, run a read-only adversarial review against every SAR-003 acceptance item before accepting it or planning SAR-004.

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_02.md`. `SAR-001` and `SAR-002` are accepted; `SAR-003` is not planned. Read `AGENTS.md`, Architecture §§3–4, D-030–D-033/D-036, and the SAR-003 ticket; run `make doctor`; then write only the `.codex/plan.md` for SAR-003 and stop for sign-off. Preserve the keyless fake stack, the D-036 package pins, and the no-silent-estimate invariant.
