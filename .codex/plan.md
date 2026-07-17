# SAR-003 — Dialect Schema and Bound Repository Factory

| | |
|---|---|
| **Status** | Accepted after two-pass Sol review on 2026-07-17 (46 tests + build + invariants green; one blocking finding fixed) |
| **Owner** | `pipeline` (Terra) · high effort (moat) |
| **Depends on** | `SAR-001` (accepted). `SAR-002` accepted but not a dependency. |
| **Authority** | `AGENTS.md` §2 · `docs/architecture/ARCHITECTURE.md` §§3–4, 9 (§1.1 layout) · `docs/product/DECISIONS.md` D-030–D-033, D-036 · `docs/planning/TICKETS.md` SAR-003 · `docs/handsoff/handsoff_02.md` §4 |
| **Out of scope (do NOT borrow)** | `CaptureDraft`/`Proposal` Zod contract, route-by-confidence, commit/undo service, XP, capture dispatchers (SAR-004) · screens/onboarding/auth UI (SAR-005/012/021) · a live Supabase client, Postgres migration/connection, cross-user tenant-isolation eval (SAR-021) · billing checkout/webhook logic (SAR-025) · any real voice/vision/LLM change. |

---

## Context

SAR-001 (scaffold + AST core-boundary) and SAR-002 (provider ports + keyless fake stack) are accepted. `data/` is still an empty skeleton (`data/schema`, `data/repository`, `data/db`, `data/migrations` each hold only a `.gitkeep`). SAR-003 is Architecture **build gate 1** — *"Before schema code: implement the dialect schema contract, migrations, scoped repository factory, and `check:core-boundary` exactly here"* (ARCHITECTURE §9.1). Nothing downstream (SAR-004 capture/commit, SAR-005 Today spine, F3) can persist a typed row until this layer exists. This ticket builds the typed persistence floor and the user-scoping mechanism that guarantees invariants 1/2/5/6 (no silent estimate writes, integer units, repository pattern, typed-per-domain writes) are structurally enforceable — without touching the keyless fake stack that already works.

**Deliverable of this planning step:** this plan only. On sign-off it is persisted verbatim to `.codex/plan.md`, a todo list is created, and the ticket is handed to Terra (`pipeline`). No code is written before sign-off.

## Current state (verified by scout)

- **`data/` is empty** — no schema/repository/db/migration files exist; all are `.gitkeep` placeholders. Everything here is built from scratch.
- **Tooling present:** `drizzle-orm@0.44.7`, `drizzle-kit@0.31.8`, `tsx@4.20.6`, `zod@4.1.13`. `drizzle.config.ts` exists (`dialect:"sqlite"`, `schema:"./data/schema/*.ts"`, `out:"./data/migrations"`, `url: DB_URL ?? "file:./sarthi.dev.db"`). `pnpm-lock.yaml` present.
- **No SQLite/Postgres runtime driver installed** (`better-sqlite3`/`@libsql/client`/`postgres` absent — only optional peer ranges in the lockfile). No `db:*` scripts. No `.sql` migrations. No password-hashing lib.
- **Runtime selectors exist** in `app/lib/runtime.ts` (`server-only`): `DATABASE_PROVIDER∈{sqlite,postgres}` default `sqlite`; `AUTH_PROVIDER∈{local-password,supabase}` default `local-password`; `DB_URL` default `file:./sarthi.dev.db`. It does **not** read `APP_PASSWORD` yet (that key lives only in `.env.example`).
- **Contracts:** `core/contracts/` has only `providers.ts` + `index.ts`. `AuthProvider`, `RepositoryFactory`, `UserScopedRepositories`, `ScopedEntityRepository`, `AuthenticatedUser`, and every per-domain repo interface exist **only as spec** in ARCHITECTURE §3 — SAR-003 authors them all.
- **`providers/auth/` does not exist.** `core/domains`, `core/capture` are placeholders (SAR-004 owns them).
- **Boundary / hooks (`.codex/hooks/`):** `check-core-boundary.mjs` scans **only `core/`** and forbids the `drizzle-orm` specifier there — **including `import type`** (the boundary test has a `drizzle` forbidden fixture). `guard-writes.sh:30` **denies `drizzle-kit generate|migrate|push`** (migration generation is human-gated). `check-invariants.sh` greps `core data providers` for money fields typed `number|float` unless the line contains `paise`. **No hook enforces `userId`** — that is proven only by tests SAR-003 writes.
- **`pnpm check`** = `typecheck` (`tsc --noEmit`, checks `data/` + `tests/`) → `lint` → `check:core-boundary` → `test`. `test` = `test:core-boundary` (`node --test`) + `test:providers` (`tsx --test`). CI runs `install --frozen-lockfile` → `check` → `build` with the fake stack pinned; CI never runs drizzle-kit. Generated `data/migrations/*.sql` is **not** gitignored (only `*.db`/`*.sqlite`), so migrations are committed and CI applies them.

---

## Locked decisions for this ticket (sign these off)

**D-A · SQLite driver = `@libsql/client` (drizzle-orm/libsql).** The repository interface is fully **async** (`create():Promise`, `transaction<T>(work:()=>Promise<T>):Promise<T>`), and prod/Postgres uses async `postgres-js`. `@libsql/client` gives **async transactions**, so one async repository implementation runs cleanly over both dialects (invariant 5); it matches the existing `file:./sarthi.dev.db` URL and is Turso-ready. *Alternatives considered:* `better-sqlite3` is **synchronous** — its `db.transaction(cb)` cannot `await`, forcing a hand-rolled BEGIN/COMMIT facade under an async interface (awkward, and diverges from the Postgres path); `node:sqlite` is experimental + sync. Adds deps `@libsql/client` (dev/CI SQLite + tests) and `postgres` (Postgres composition-ready, not exercised in CI). Exact versions are verified by **docs-verifier** against drizzle-orm@0.44.7 + Node 22 **before install**; `pnpm-lock.yaml` is regenerated and committed (else `--frozen-lockfile` CI fails).

**D-B · Contract-ownership = ARCHITECTURE §4.1 as signed (Satvik's call, 2026-07-17).** `data/schema/contract.ts` is the single source of truth: it exports the enum unions, the named Zod support shapes (`DomainStatsSnapshot`, `PlanRule`, `CoachEvidence`, `CommitRowSnapshot`), every per-table record/create/update/query Zod schema + inferred DTO type, and a **declarative** column/index descriptor. It stays **drizzle- and framework-free** (Zod/TS only) — the Drizzle materialization lives *solely* in `sqlite.ts`/`postgres.ts`, which import the descriptor + enums from `contract.ts`. `core/contracts/repositories.ts` imports the DTO **types** via `import type … from "@/data/schema/contract"` — permitted by the boundary scanner (`@/data` is not on its denylist), and because `contract.ts` carries no drizzle/framework import this pulls nothing forbidden into core's build graph. **Guard (this ticket's added invariant):** a focused test asserts `data/schema/contract.ts` imports neither `drizzle-orm` nor any framework/provider module — so the `core → @/data` type edge stays benign and D-027 extraction keeps `contract.ts` movable alongside `core`. No D-037 needed: §4.1 is honored as written; the only nominal cost (a core→`@/data` type-only edge) is contained by the drizzle-free-contract guard.

**D-C · Repository shape = shared generic scoped base + typed per-domain wrappers.** A single `ScopedEntityRepository<TRecord,TCreate,TUpdate,TQuery>` base is bound at construction to (one Drizzle table, its core Zod schemas, the authenticated `userId`, the current executor). The per-domain groups (`ProfileRepository`, `MoneyRepositories`, … `BillingRepository`) are assembled from these bindings. This is **not** a generic runtime store — every repo is bound to exactly one typed table with typed inputs (invariant 6 intact); the genericity is code reuse in `data/`, which the `core`-only invariant hook does not police. `forUser()` returns a **fresh per-request scope** (no shared singleton), so executor swapping during a transaction is contained.

**D-D · transaction/rollback.** The scope holds a mutable *current executor* (base `db` or an active `tx`). `transaction(work)` calls `db.transaction(async (tx) => { setExecutor(tx); try { return await work(); } finally { setExecutor(db); } })` — every repo call inside `work` reads the tx executor; a throw rolls the whole batch back (async, supported by `@libsql/client`). This is the primitive SAR-004's CommitService will wrap.

**D-E · Auth = local constant-time gate, Supabase composition-ready stub.** `LocalPasswordAuthProvider.signIn/requireUser` does a **constant-time compare** (`node:crypto.timingSafeEqual`) of the submitted password against `APP_PASSWORD` and returns fixed `{ userId:'local-dev', email:null, mode:'local' }`. **No users are persisted → no password-hashing dependency.** `SupabaseAuthProvider` is a composition-ready port that throws `ProviderConfigurationError` ("not implemented until SAR-021") — mirroring SAR-002's non-fake voice/vision, never a silent fallback, no live client. `app/lib/runtime.ts` is touched **additively** to parse `APP_PASSWORD` (new optional field; existing selectors untouched).

**D-F · Dialect + isolation depth (prevent false "omission" findings).** *SQLite:* full schema, generated+committed migration, migration smoke, and transaction/rollback tests land **now**. *Postgres:* declarations compile clean (`tsc`) and the `postgres-js` adapter + composition root are wired and type-check, but **live PG migration/connection is deferred to SAR-021** (no Postgres in CI). SAR-003 proves the **scoping mechanism** (userId injected server-side; no method accepts caller `userId`/SQL/tenant filter) for the single `local-dev` user; the cross-user `tenant-isolation` eval fixture is SAR-021's, once real auth lands (per TICKETS SAR-003 "Moves"). **Migration generation is human-gated** — the `db:generate/db:migrate` *scripts are added*, but running `drizzle-kit generate` is a HITL step taken only after this plan is signed.

---

## Implementation steps (ordered — become the todo list)

1. **Verify + install the DB layer.** docs-verifier confirms exact pinned versions of `@libsql/client` and `postgres` compatible with `drizzle-orm@0.44.7` + Node 22 (TECH-STACK §1 "verify before wiring"). Install with exact pins; regenerate and commit `pnpm-lock.yaml`. Add `db:generate`/`db:migrate` scripts (definitions only — execution stays human-gated). No Anthropic/live-key/network additions.

2. **Author the shared contract source of truth in `data/schema/contract.ts` (D-B — drizzle-free).** Enum unions (plan, direction, cadence, status, scope, domain, kind, …); the four named Zod support shapes; every per-table **record / create / update / query** Zod schema + inferred DTO type; the declarative column/index descriptor consumed by both dialects. Money/quantity fields are integer and named `*Paise`/`*Grams`/`*Millilitres`/`*Minutes`; `confidenceBps ∈ 0..10000`; `estimated` boolean; nullable = unknown. **This file imports Zod/TS only — no `drizzle-orm`, no framework/provider import.**

3. **Author core contracts (interfaces only).**
   - `core/contracts/repositories.ts` — `AuthenticatedUser`, `ScopedEntityRepository`, the per-domain repository interfaces, `UserScopedRepositories` (incl. `transaction<T>`), `RepositoryFactory` — exactly the ARCHITECTURE §3 signatures, with record/create/update/query **types imported `import type … from "@/data/schema/contract"`** (D-B). No `drizzle-orm` specifier in core.
   - `core/contracts/auth.ts` — the `AuthProvider` interface (§3).
   - `core/contracts/errors.ts` — typed errors (e.g. `RepositoryError`, reuse/extend `ProviderConfigurationError`).
   - Extend `core/contracts/index.ts` to re-export all of the above. **Confirm `pnpm check:core-boundary` stays clean** (no `drizzle-orm` specifier reaches core, `import type` included).

4. **Materialize the Drizzle schema (both dialects, every signed table).** `data/schema/sqlite.ts` (`sqliteTable`) and `data/schema/postgres.ts` (`pgTable`) import the descriptor + enums from `data/schema/contract.ts` (step 2) and declare the **full** §4 table set with identical names/columns/unique-constraints/indexes: profiles + onboarding (§4.2), money (§4.3), health (§4.4), habits + skills (§4.5), plan/progress/coach/evidence (§4.6), commit/undo + billing + waitlist (§4.7). UUID-text ids; `profiles.userId` is PK; **every persistent row has non-null `userId`**; immutable/audit tables carry only `id,userId,createdAt`. No money float; no omitted or generalized table. These two files are the *only* place `drizzle-orm` is imported in the schema layer. Add compile-time assertions (in `data/`, where drizzle imports are legal) that each Drizzle row type structurally matches its `contract.ts` record DTO.

5. **DB adapters + repository factory.**
   - `data/db/sqlite.ts` — `@libsql/client` `createClient({ url })` + `drizzle(client,{schema})`. `data/db/postgres.ts` — `postgres(url,{ prepare:false })` + `drizzle(...)` (composition-ready). Each returns a typed handle over its dialect schema.
   - `data/repository/` — the shared `ScopedEntityRepository` base (D-C), the current-executor scope + `transaction` (D-D), the per-domain group assembly, and `RepositoryFactory.forUser(user)` returning a fresh `UserScopedRepositories`. Written dialect-parameterized over `{db, schema}` using only the drizzle core API (`eq/and/insert().values()/update().set().where()/select().from().where()`), which is uniform across dialects. **Fallback if generic typing over both dialects proves too costly:** a shared abstract base + two thin dialect-bound concrete factories that reuse identical query logic — never two divergent implementations (invariant 5 holds either way).
   - SQLite composition is fully wired; the Postgres composition root is constructed and type-checks (no live connection).

6. **Auth provider layer (D-E).** `providers/auth/local-password.ts` (constant-time `APP_PASSWORD` gate → `local-dev`), `providers/auth/supabase.ts` (throws `ProviderConfigurationError`), `providers/auth/index.ts` factory `createAuthProvider(name)`. Export from `providers/index.ts`. Additively wire `APP_PASSWORD` into `app/lib/runtime.ts`.

7. **Generate the migration (HITL).** After sign-off, run `pnpm db:generate` (human-gated — `guard-writes` denies `drizzle-kit generate`) to emit `data/migrations/0000_*.sql` + meta for the SQLite dialect; commit the SQL.

8. **Prove it — keyless, network-free tests** (`tests/*.test.ts`, `node:test`+`node:assert/strict` via `tsx --test`, mirroring `tests/providers.test.ts`: save/override `globalThis.fetch` to throw; delete-then-restore `process.env`).
   - `tests/schema.test.ts` — enumerate every table and assert a **non-null `userId`** column (the only guarantee for acceptance item 1); assert money columns are integer + `*Paise`-named; assert unique constraints/indexes from §4 exist; **assert `data/schema/contract.ts` imports neither `drizzle-orm` nor any framework/provider module** (D-B drizzle-free-contract guard).
   - `tests/repository.test.ts` — against a fresh `@libsql/client` **`:memory:`** DB (the real runtime driver, not a second engine): create/byId/list/update/softDelete are auto-scoped to `local-dev`; **no method accepts a caller `userId`/SQL/tenant filter** (type + runtime assertion); a second constructed scope for a different userId cannot see the first's rows (mechanism proof).
   - `tests/transaction.test.ts` — `transaction(work)` commits all-or-nothing; a throw mid-`work` rolls back every row (no partial writes).
   - `tests/migrations.test.ts` — apply the **committed** `data/migrations/*.sql` to a fresh `:memory:` DB and assert the expected tables/columns/constraints materialize. Must **not** shell out to drizzle-kit.
   - `tests/auth.test.ts` — correct `APP_PASSWORD` → `local-dev`; wrong password rejects; keyless (no Supabase, no network).
   - Add `test:data` + `test:migrations` scripts and chain them into `test` so `pnpm check` runs them.

9. **Validate + record.** Run the full verification below. Add a truthful `docs/product/CHANGELOG.md` entry only after evidence exists. Report every changed file, each command's output, the resolved driver versions, and any blocked acceptance item for Sol's diff review.

---

## Acceptance checklist (mirrors TICKETS SAR-003 + invariant proofs)

- [x] All signed **SQLite and Postgres** Drizzle declarations/constraints/indexes present (§4, every table, none omitted/generalized); Zod support shapes present; **every persistent row has non-null `userId`** (test-enumerated).
- [x] `RepositoryFactory.forUser()` + concrete typed repositories exist; **no repository method accepts caller-supplied `userId`, arbitrary SQL, or a tenant filter** (test-asserted).
- [x] `LocalPasswordAuthProvider` returns `local-dev` with SQLite wiring; **dev/CI never requires Supabase**; Supabase port is composition-ready and throws clearly.
- [x] **Transactional commit/rollback** works and **SQLite migration smoke** passes against committed SQL; Postgres path type-checks and is composition-ready.
- [x] Keyless + network-free: repository/auth/migration tests pass with provider keys unset and a failing `fetch` sentinel.
- [x] `core/` stays boundary-clean — **no `drizzle-orm` import (incl. `import type`) in `core/`**; core's only `@/data` edge is a **type-only** import from the drizzle-free `data/schema/contract.ts` (D-B), and a test asserts that contract stays drizzle/framework-free.
- [x] Money columns integer + `*Paise`-named (invariant-hook clean); no monetary float anywhere.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm check:core-boundary`, `pnpm test`, `pnpm build`, and `.codex/hooks/check-invariants.sh` all pass.

## Verification (how Terra proves it, then Sol reviews)

```sh
pnpm install --frozen-lockfile              # lockfile committed with the new pinned drivers
pnpm check                                  # typecheck + lint + core-boundary + all tests (incl. test:data, test:migrations)
pnpm build                                  # Next build stays green
bash .codex/hooks/check-invariants.sh      # money/paise + no-ai-sdk-in-data + tokens-only pass
tsx --test tests/migrations.test.ts         # committed migration SQL applies to :memory: and yields the tables
```

Keyless proof: tests run with `GOOGLE_API_KEY`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` unset and `globalThis.fetch` overridden to throw. No live DB, no Supabase, no network. Escalate only for a sandbox-local worker/IPC socket, never for a network/key call.

## Handoff to Terra

Implement only this schema/repository/auth boundary. You are not alone in the repo — preserve the accepted scaffold, provider ports, and fake stack; never revert unrelated files. Do **not** implement capture routing, the CaptureDraft/Proposal contract, commit/undo, XP, screens, a live Supabase client, a Postgres migration/connection, or billing logic. The §4 table contract is the source of truth: no table silently omitted or generalized. If the same acceptance item fails twice, stop and escalate (deep/Sol) rather than loosening a constraint. Report changed files + validation output for the read-only diff review that precedes SAR-004.

---

### Post-approval sequence (after this plan is signed)
1. Persist this file **verbatim** to `.codex/plan.md` (replacing the accepted SAR-002 plan) — a planning doc, not application code.
2. Create the TodoWrite list from the ordered implementation steps.
3. Hand steps 1–9 to Terra (`pipeline`); Sol diff-reviews against this plan + TICKETS before SAR-004 begins.
4. `/handoff` at session end (`handsoff_03.md`).
