# Sarthi Handoff 03 — Dialect Schema and Bound Repository Factory Accepted

| | |
|---|---|
| **Written** | 2026-07-17 |
| **Session state** | Stage 5 active; `SAR-001`, `SAR-002`, and `SAR-003` are accepted. `SAR-004` is not planned or started. |
| **Resume point** | Plan **`SAR-004 — Capture routing, typed commit, XP, and undo core`** only, then stop for Satvik’s ticket-plan sign-off. |
| **Build authority** | `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, and `docs/planning/TICKETS.md` are signed; D-001–D-037 are constraints. |
| **Provenance** | Codex `/feedback` session ID: `019f6cc9-957e-7ae3-8ffa-c54fc699eb44`. |
| **Git baseline** | `948141b` foundation/provider handoff is the last commit. The SAR-003 working tree (data/ schema+repository, core/contracts, providers/auth, migration, tests, docs) is **uncommitted on `main`** — branch + commit is Satvik’s call. |

## 1. Locked execution state

- **Product and safety:** `AGENTS.md` invariants apply without exception. Estimates never write unconfirmed; money/quantity values stay integer; typed domain writes only; `core/` remains framework/provider/DB-import clean; the free demo is never paywalled.
- **Workflow:** Sol plans and reviews; Terra writes application code; Luna stays read-only. Every ticket requires its own approved `.codex/plan.md`, then Terra implementation, then a final review gate. Do not start a later ticket opportunistically.
- **Work order:** `SAR-001` → `SAR-002` → `SAR-003` are accepted. `SAR-004` (depends on `SAR-002`+`SAR-003`) and `SAR-005` (depends on `SAR-001`+`SAR-003`) are now dependency-eligible; front-load the pipeline — **`SAR-004` is next** (AGENTS.md §4).
- **External deadline:** Tue Jul 21, 5:00 PM PT. D-035 forbids elapsed-day checkpoints; only dependency and acceptance evidence advance work.
- **New this session:** **D-037** locks the database driver line (SQLite `@libsql/client@0.17.4` / Postgres `postgres-js@3.4.9`, one async repository over both; SQLite is the migration source; no DB foreign keys in v1). Open decision unchanged: **D-006** only.

## 2. Accepted ticket evidence

### SAR-003 — Dialect schema and bound repository factory

**Accepted outcome**

- `data/schema/contract.ts` — the drizzle-free single source of truth: 22 enum unions, the 4 named Zod support shapes, and all **33** per-table `record`/`create`/`update`/`query` Zod schemas + inferred DTO types + a declarative column/index descriptor. Imports zod only (test-guarded, specifier-prefix). §4.1 kept literal (Satvik’s call — no deviation).
- `data/schema/sqlite.ts` + `data/schema/postgres.ts` — all 33 tables materialized in both dialects, identical column/unique/index sets; `userId` non-null on every table; `profiles.userId` is PK; money columns integer `*Paise` with `.nonnegative()`, `confidenceBps` `.min(0).max(10000)`; JSON columns typed to the named support shapes. A dual-dialect **parity test** proves sqlite↔postgres↔contract column/nullability agreement.
- `core/contracts/{repositories,auth,errors}.ts` — `ScopedEntityRepository` + `AppendOnlyRepository` (append-only for the 9 immutable/audit tables), the 10 typed groups covering all 33 tables once, `AuthProvider`, and a shared error taxonomy (`ProviderConfigurationError` moved to core; providers re-export it, SAR-002 tests intact). **Create/list take `Omit<…,'userId'>` — the port cannot accept a caller `userId`, SQL, or tenant filter (type-enforced + runtime-injected from the bound scope).**
- `data/repository/*` + `data/db/{sqlite,postgres}.ts` — descriptor-driven scoped repositories, executor-swap `transaction()` with all-or-nothing rollback, `RepositoryFactory.forUser()` minting a fresh per-request scope; SQLite fully wired, Postgres composition-ready (no live connection).
- `providers/auth/*` — `LocalPasswordAuthProvider` (constant-time compare → `local-dev`, no persisted users, no hashing dep) and a composition-ready `SupabaseAuthProvider` stub (throws, no live client); `app/lib/runtime.ts` additively reads `APP_PASSWORD`.
- `data/migrations/0000_lush_silk_fever.sql` — the committed SQLite migration (33 tables). Human-gated generation ran after plan sign-off; `drizzle.config` narrowed to the sqlite dialect file.

**Evidence**

- `pnpm check` (typecheck + lint + core-boundary + all suites) green — **46 tests**: 13 core-boundary, 5 providers, 25 data (schema/parity/repository/transaction/auth), 3 migrations. `pnpm build` green. `.codex/hooks/check-invariants.sh` clean. `pnpm install --frozen-lockfile` consistent.
- Tests are keyless and network-free (unset provider keys + failing `fetch` sentinel). Migration smoke applies the **committed** SQL to a throwaway libSQL DB (never drizzle-kit). The test helper uses a per-call temp file (libSQL gives each connection a private `:memory:`, which would break the transaction test) — still keyless/deterministic, cleaned up on exit.
- Two-pass Sol review: one blocking finding (port types accepted `userId`) fixed via `Omit<…,'userId'>` at the generics; re-review **ACCEPTABLE TO LAND** (BLOCKING 0). Runtime scope-wins + cross-tenant isolation proven.

**Deferred non-blocking follow-ups** (from the Sol review — none block SAR-003; fold into the relevant next ticket):

- **NB-4 →** `commits`/`adaptations` are append-only but undo must flip `status`/`undoneAt`; **SAR-004** decides a narrow `markUndone`/supersede-by-row extension — don’t silently widen the append-only port.
- **N-4 →** `ScopeContext` executor swap is not re-entrant; **SAR-004**’s CommitService must be single-flight per scope.
- **NB-5 →** move `AuthProviderName` from `app/lib/runtime.ts` to `core/contracts` (remove the `providers → app` type edge). **N-1 →** add an `AuthError` subclass instead of reusing `RepositoryError` in local-password.
- **N-2/N-3/N-6 →** `softDelete` silent-success on missing id; `list` doesn’t Zod-parse its query; no DB foreign keys (app-level integrity until SAR-021).
- **N-5 →** the unrelated `.gitignore` working-tree change (mirror-layer entries) should be committed separately, not as part of SAR-003 provenance.

**Gate / eval status:** SAR-003 satisfies Architecture **build-gate 1**. No FLOWS gate passes yet (F3 is `SAR-006`/`SAR-007`). No eval-harness number moves yet (the harness is `SAR-007`); the `tenant-isolation` mechanism is now test-covered, and its eval fixture lands with production auth (`SAR-021`).

## 3. Current repository map

```text
data/schema/contract.ts          drizzle-free source of truth (33 tables · enums · Zod support shapes · DTOs · descriptors)
data/schema/{sqlite,postgres}.ts dialect materializations (only place drizzle-orm enters the schema layer)
data/db/{sqlite,postgres}.ts     @libsql/client + postgres-js adapters
data/repository/*                 scoped/append-only base, scope+transaction, RepositoryFactory.forUser()
data/migrations/0000_*.sql (+meta) committed SQLite migration
core/contracts/*                  repositories/auth/errors interfaces (drizzle-free; type-only @/data edge)
providers/auth/*                  local-password gate + supabase stub + factory
tests/                            schema · parity · repository · transaction · auth · migrations (+ helpers/memory-db)
core/capture/                     placeholder only — SAR-004 owns routing/commit/undo
```

Useful commands: `make doctor` · `pnpm install --frozen-lockfile` · `pnpm check` · `pnpm build` · `.codex/hooks/check-invariants.sh` · `pnpm db:generate` (human-gated).

## 4. SAR-004 boundary

**Ticket:** `SAR-004 — Capture routing, typed commit, XP, and undo core` · **Agent:** `pipeline` (Terra) · **Depends:** `SAR-002`, `SAR-003`.

Read before planning: `AGENTS.md` §2 · `docs/architecture/ARCHITECTURE.md` §§5–6, 9 · `docs/product/DECISIONS.md` D-030 · `docs/experience/FLOWS.md` F3–F4 · `docs/planning/TICKETS.md` SAR-004.

Build on the SAR-003 layer: the versioned discriminated `CaptureDraft`/`Proposal` Zod contract + route policy (`core/capture/route.ts`), auto-file only `intent==='create'` + `estimated===false` + `confidenceBps>=9000` + valid integers + no open clarification, an exhaustive typed per-domain commit switch through the scoped repositories, one append-only commit batch (typed rows + snapshots + XP + plan effects + idempotency) and a five-minute latest-batch undo that reverses all recorded side effects atomically. Fold in NB-4 / N-4. Do not borrow screens, live providers, or later-ticket scope.

## 5. `.codex` skill policy

- The full policy remains in `docs/handsoff/handsoff_01.md` §5 and still applies. `gpt-taste` stays disabled; image-generation skills are visual references only.
- Read a relevant skill before use, but `AGENTS.md`, the architecture, and screen/design docs override every skill default.

## 6. Resume procedure

1. Read this handoff, `AGENTS.md`, `docs/architecture/ARCHITECTURE.md` §§5–6, and `docs/planning/TICKETS.md` SAR-004.
2. Run `make doctor`; if the restricted sandbox reports provider reachability failure, rerun with approved escalation before diagnosing the connection.
3. Inspect `git status --short` — the SAR-003 tree is uncommitted on `main`. Confirm Satvik’s branch+commit intent before continuing; do not overwrite it.
4. Write `.codex/plan.md` for **SAR-004 only**, with the full route/commit/undo contract and eval/test evidence.
5. **STOP for Satvik’s SAR-004 plan sign-off.** Only then assign the exact plan to the Terra `pipeline` role.
6. After implementation, run a read-only adversarial review against every SAR-004 acceptance item; then drive `SAR-005`/`SAR-006`/`SAR-007` toward the F3 gate.

### Exact resume prompt

> Resume Sarthi from `docs/handsoff/handsoff_03.md`. `SAR-001`–`SAR-003` are accepted; `SAR-004` is not planned. Read `AGENTS.md`, Architecture §§5–6 and 9, D-030, FLOWS F3–F4, and the SAR-004 ticket; run `make doctor`; inspect `git status --short` (the SAR-003 tree is uncommitted on `main` — confirm the branch+commit intent first); then write only the `.codex/plan.md` for SAR-004 and stop for sign-off. Preserve the keyless fake stack, the D-036/D-037 package + driver pins, the repository-bound `userId` scoping, and the no-silent-estimate invariant.
