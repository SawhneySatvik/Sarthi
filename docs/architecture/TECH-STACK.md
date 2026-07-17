# Sarthi — Tech Stack & Architecture

| | |
|---|---|
| **Status** | Decided (this session). Constraints, not suggestions. |
| **Repo shape** | All-TypeScript, single Next.js app on Vercel |
| **Execution** | dependency and acceptance gates (F3 → F11 → Phase review); fixed external submission deadline Jul 21 |
| **Decided by** | Satvik + build session, 2026-07-15 |

> This is the *how we build it* layer under `docs/product/PRD.md` / `PROJECT-SUMMARY.md`. Everything here serves the capture loop.
> Design philosophy (from doc 3, upheld): **strict plug-and-play** — DB, LLM, and Voice each sit behind an interface, selected by env, with a deterministic `fake` adapter so the whole loop runs keyless.

---

## 0. Two model layers — don't conflate them

The hackathon's GPT-5.6 requirement is about **how the app is built**, not which model it calls at runtime. Keep these separate:

- **Build / coding layer = Codex + GPT-5.6.** The app is *written* using Codex powered by GPT-5.6 (CLI/cloud). This is the rubric's "built with Codex + GPT-5.6" + "how Codex accelerated the build" story. Capture the `/feedback` session ID from where core functionality is built.
- **App runtime layer = provider-agnostic.** The models the app *calls* (parse, coach, vision, voice) route through the AI SDK by env var. **Dev default = Gemini free tier** for cheap iteration. OpenAI (**GPT-5.6**) and Claude adapters stay wired the whole time.
- **Demo/submission model:** both GPT-5.6 and Gemini stay wired the whole time; the runtime flips to either in one env line. **Decide the demo model at record time** — GPT-5.6 (Sol parse / Luna classify) keeps "GPT-5.6 central to the app" airtight for judges if you want to lean that way.

---

## 1. Stack at a glance

| Layer | Pick | Notes |
|---|---|---|
| App shell | **Next.js (App Router) + TypeScript** | one repo, one deploy; API via route handlers / server actions |
| UI | **Tailwind + shadcn/ui (Radix) + Framer Motion + lucide-react** | Premium Dark; Framer drives the swipe deck + inline level-up |
| Coding / build tool | **Codex + GPT-5.6** (CLI/cloud) | *this* is the hackathon's GPT-5.6 requirement; capture `/feedback` session ID |
| Model gateway | **Vercel AI SDK** (`@ai-sdk/google`, `-openai`, `-anthropic`) | provider swap = one env line; Zod structured output for typed parse; tool-calling built in |
| Runtime models — dev | **Gemini free tier** (`gemini-2.5-pro` = deep, `gemini-2.5-flash` = balanced, `gemini-2.5-flash-lite` = fast) | cheap iteration; quotas remain dynamic per Google project/tier |
| Runtime models — demo | **GPT-5.6 or Gemini — both wired, decide at record time** (env-flip, no code change) | GPT-5.6 rate card: Sol $5/$30, Terra $2.50/$15, Luna $1/$6 per 1M tok |
| Structured parse | **`generateObject` + Zod** on the deep tier (Gemini dev / Sol demo) | the moat; provider-blind, no fragile JSON.parse |
| Data (dev) | **SQLite** (local file) + password auth + local storage | zero setup, keyless |
| Data (prod) | **Supabase** (Postgres + Auth + storage) | multi-user/income seam ready; same Drizzle code |
| ORM | **Drizzle** behind a repository interface | business logic never touches the driver |
| Voice (PTT) | **`VoiceProvider` interface**, env-routed; **dev default = Gemini multimodal** (free tier, handles Hinglish); Sarvam + OpenAI + Web Speech as adapters | record → transcribe → parse. TTS reply optional |
| Vision | **selected tier's multimodal** — Gemini (dev) / GPT-5.6 (demo) | meal macros + receipt read, no extra provider |
| Orchestration | **deterministic TS router + 1 deep-tier parse + 1 generic `domainCoach(spec)` + fast-tier helpers** | "agents" = domain specs in a registry (the specialize-later seam) |
| Deploy | **Vercel + Supabase** | Docker/cloud-agnostic is future scope, not v1 |
| Eval | **thin TS harness** | scores typed rows vs ground truth; one A/B report across tiers *and* providers (Gemini vs GPT-5.6) |

> **Verified 2026-07-17 / D-036:** Gemini IDs are `gemini-2.5-pro`, `gemini-2.5-flash`, and `gemini-2.5-flash-lite`; GPT-5.6 IDs are `gpt-5.6-sol` (alias `gpt-5.6`), `gpt-5.6-terra`, and `gpt-5.6-luna`. Google free-tier quotas are dynamic per project/tier and must never be hardcoded. Pin the coherent AI SDK 7 set in the lockfile: `ai@7.0.28`, Google `4.0.16`, OpenAI `4.0.15`, and Anthropic `4.0.15`.

---

## 2. Repo layout (single Next.js app)

```
/app
  /(tabs)/today  /journey  /coach  /stats  /tools     # 5 nav tabs
  /api/*                                               # route handlers (parse, commit, brief…)
/components
  /ui                     # shadcn primitives, themed
  /capture                # capture sheet, swipe deck, fan-out
  /lenses                 # money-ledger, health-dashboard, habits-grid, skills-curriculum
/core
  /capture                # parse → route-by-confidence → confirm → write
  /coach                  # engine (per-capture / daily / weekly), registry
  /domains                # health | money | habits | skills: schema + lens projection
  /game                   # xp, levels, streaks, mastery (deterministic, frontend-fed)
/providers
  /llm                    # tier router over AI SDK (google | openai | anthropic | fake)
  /voice                  # VoiceProvider: gemini | sarvam | openai | webspeech | fake
  /vision                 # multimodal adapter (gemini | openai) + fake
  /auth                   # AuthProvider: local-password | supabase
/data
  schema.ts               # Drizzle schema (typed per-domain tables)
  repo.ts                 # authenticated, user-scoped Repository + Drizzle impl
  db.dev.ts / db.prod.ts  # SQLite vs Supabase-Postgres, env-selected
  migrations/
/eval                     # harness, fixtures, report
/lib                      # auth, env, units (paise/ml/minutes/grams)
```

**D-027 boundary enforcement:** `core/` may not import React, Next.js, route handlers, or concrete provider/DB drivers. A required `check:core-boundary` script/CI step rejects those imports; architecture code may depend only on core contracts and provider interfaces.

---

## 3. Plug-and-play core (interface sketches)

The three abstractions doc 3 asked for. Each has: interface → real adapters → `fake`. Selection by env var.

### 3a. LLM tier gateway (provider-neutral tiers)

Tiers are capability labels — `deep | balanced | fast` (the old Sol/Terra/Luna, now provider-neutral since dev defaults to Gemini). A matrix maps `(provider, tier) → model`.

```ts
// providers/llm/index.ts
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
// import { anthropic } from '@ai-sdk/anthropic';

export type Tier = 'deep' | 'balanced' | 'fast';

const MATRIX = {
  google: { deep: 'gemini-2.5-pro', balanced: 'gemini-2.5-flash', fast: 'gemini-2.5-flash-lite' },
  openai: { deep: 'gpt-5.6-sol', balanced: 'gpt-5.6-terra', fast: 'gpt-5.6-luna' },
  // Anthropic stays adapter-wired but disabled until exact runtime IDs are verified for the deployment account.
} as const;

const PROVIDER = (process.env.LLM_PROVIDER ?? 'google') as keyof typeof MATRIX; // dev default = Gemini (free)

export const model = (tier: Tier) =>
  PROVIDER === 'openai' ? openai(MATRIX.openai[tier]) : google(MATRIX.google[tier]);
```
Usage stays provider-blind: `generateObject({ model: model('deep'), schema, prompt })` for parse; `generateText({ model: model('fast'), … })` for the one-liner/classify. Flip dev→demo with `LLM_PROVIDER=openai`.

### 3b. Voice provider (PTT)
```ts
// providers/voice/index.ts
export interface VoiceProvider {
  transcribe(audio: Blob, opts?: { lang?: string }): Promise<{ text: string; confidence?: number }>;
  speak?(text: string, opts?: { voice?: string; lang?: string }): Promise<Blob>; // TTS optional
}
// adapters: GeminiVoice (multimodal transcription), WebSpeechVoice (browser, free),
//           SarvamVoice (Saaras v3 STT + Bulbul v3 TTS), OpenAIVoice, FakeVoice
// router: VOICE_PROVIDER=gemini|webspeech|sarvam|openai|fake  (dev default = gemini multimodal)
```
Dev leans on a free option; **Sarvam stays the adapter for high-accuracy code-mixed (Hinglish/Kannada) dogfooding** (₹1.5/min, free credits to start). The interface means streaming (Sarvam WebSocket / GPT Realtime) is a later adapter, not a rewrite.

### 3c. Auth + repository (provider- and DB-agnostic)
```ts
// providers/auth/index.ts
export interface AuthProvider {
  requireUser(): Promise<{ userId: string }>;
  signUp(input: { email: string; password: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  resetPassword(email: string): Promise<void>;
}
// local-password -> fixed { userId: 'local-dev' }; Supabase -> verified auth user.

// data/repo.ts
export interface Repository<T> {
  create(row: NewRow<T>): Promise<T>;
  byId(id: string): Promise<T | null>;
  list(query?: RepositoryQuery<T>): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}
export interface Repositories {
  forAuthenticatedUser(): Promise<UserScopedRepositories>;
}
// The scope is resolved once by AuthProvider; it is never caller-supplied as a filter.
// One Drizzle-backed implementation and schema run unchanged over SQLite (dev) and
// Postgres (prod). Every persistent row has userId and every query/write is scoped.
```

---

## 4. Capture pipeline (the moat)

`CaptureDraft` is transient and versioned. Its proposals are a Zod-validated discriminated union
over the permitted typed targets (for example `transaction`, `meal`, `water`, `workout`,
`habitLog`, and `session`), never a `targetTable: string` plus generic payload. Each proposal
carries source/evidence references, temporal context, confidence, estimate flag, and either a
create, correction, or backdate intent. The full union is frozen in `docs/architecture/ARCHITECTURE.md` before parser
or schema code lands.

Flow (built **once**, reused by every domain):
1. **Dump** — PTT / text / photo.
2. **Parse** — deep tier (`generateObject` + Zod) → `CaptureDraft`, each `Proposal` domain-tagged, estimates filled where needed.
3. **Route by confidence** — the capture router owns `AUTO_WRITE_CONFIDENCE = 0.90`. Only explicit proposals (`estimated:false`) at or above it become `status:'auto'` and write silently. Every estimate and every lower-confidence explicit proposal becomes `status:'pending'` and surfaces as a card.
4. **Confirm** — right = accept (write), left = discard, tap = edit, long-press = "why this number", chip flip = override domain.
5. **Write** — each accepted proposal → user-scoped `repo.create` into its **own typed table**. Nothing generic persists. A batch writes its append-only commit record, rows, XP, and plan/satisfied-by effects atomically.
6. **React** — fast-tier one-liner + any deep-tier adaptation; inline level-up fires in the fan-out.

**Safeguard (locked):** nothing estimated writes unconfirmed; only the latest commit batch is undoable for five minutes through one atomic compensating commit; ask-don't-invent on ambiguity. A provider/offline failure keeps a retryable draft in the open sheet; v1 has no persistent offline outbox.

---

## 5. Coach / agent engine + the specialize-later seam

One engine. "Specialized agents" = configuration, not separate orchestrations.

```ts
interface DomainSpec {
  domain: Domain;
  tables: string[];
  parseHints: string;      // injected into the deep-tier parse system prompt
  coachSpec: string;       // generic domainCoach(spec) reads this for daily/weekly briefs
  tools?: ToolName[];      // subset the coach may call (award_xp, adapt_next, log_hours…)
}
const REGISTRY: Record<Domain, DomainSpec> = { health, money, habits, skills };
```
- **Router** is a deterministic switch over typed proposals — no LangChain/CrewAI.
- **Coach tiers:** per-capture line = **fast tier**; daily + weekly briefs = **deep tier**.
- **Seam:** to "promote" a domain to a truly bespoke agent later, split its `DomainSpec` into its own module with extra tools. Zero change to the pipeline.

---

## 6. Auth & data path

- **Dev/CI fake track:** local SQLite + `LocalPasswordAuthProvider`, which resolves the fixed `local-dev` identity. Fake LLM/voice/vision, the password gate, and the full F3 path remain keyless with no Supabase dependency.
- **Prod track:** `SupabaseAuthProvider` supports email/password signup, sign-in, and reset; Supabase Postgres/storage runs through the same Drizzle schema and repository implementation.
- **Tenant boundary:** `AuthProvider` resolves the identity, then the repository binds it. Every persistent row has `userId`; reads, writes, deletes, exports, seed cloning, and undo are scoped by the bound identity. Business callers never pass user filters.
- **Phase-1 account path:** new account → onboarding → optional authenticated demo seed; returning account → Today. The production auth surface is specified in `docs/screens/SCREEN-AUTH.md`.

---

## 7. Deployment

- **Judges/demo:** Vercel (app + API) + Supabase (Postgres/Auth/storage) → one live URL. Fallback: local + Loom if a live deploy risks the timeline.
- **Env-selected providers** everywhere (`LLM_PROVIDER`, `VOICE_PROVIDER`, `DB_URL`) so the same build runs local-keyless (`fake`), Gemini-dev, or GPT-5.6-demo without a code change.
- **Cloud-agnostic (Docker/K8s):** explicitly future scope. Don't build it in the window.
- **PWA:** installable only in v1. `manifest.webmanifest` declares `name: Sarthi`, `short_name: Sarthi`, `start_url: /`, `scope: /`, `display: standalone`, Ember-default theme/background colors, and 192px/512px maskable icons. The install prompt appears after authenticated Today; background sync/offline outbox and push notifications are deferred, and briefs refresh on open.
- **Billing:** pricing is ₹499/year (`49900` paise), annual only. Razorpay test-mode checkout is last in Phase 1; its plan/webhook contract belongs in `docs/architecture/ARCHITECTURE.md`. The free experience stays complete in v1.

---

## 8. Eval harness (thin, TS)

Score against ground-truth typed rows the system produced (not string match):
parse accuracy · domain-tag/routing accuracy · **wrong-silent-write count (hard zero)** · estimate error · adaptation sanity (deep-tier-as-judge + hand labels) · state match · latency p50/p95 · cost/turn across tiers **and** providers (Gemini vs GPT-5.6) → **one typed A/B report**. Fixtures, denominators, and the report shape are frozen in `docs/architecture/ARCHITECTURE.md` before eval code.

---

## 9. Touch & feel (hands into the UI-prompt phase)

Synthesis of the PRD design system, build-oriented:

- **Premium Dark.** Canvas `#0C0B0A`, card `#17130E`, line `#2A241C`, ink `#F4EFE4` / `#A79E8E`. Cards lifted a hair, never pure grey.
- **Domain colors (calm, not neon):** Health `#7FB08C` sage · Money `#D8A24A` honey · Habits `#8189CF` indigo · Skills `#A97FC9` violet. **One energy accent** = amber `#E8913E`, reserved for XP/streak only.
- **Imagery is the soul.** Calm, painterly, solitary-figure scenes, full-bleed under a scrim with bold display type. **Pre-generated** (GPT Image + Nano Banana) as static assets; **painterly gradient/texture placeholders at build time** so layout never blocks on art.
- **Type split:** heavy display for big numbers, warm humanist for the coach's voice, tabular for stats.
- **Motion (Framer):** Tinder-style swipe deck for estimate cards; a brief, earned level-up bloom in the fan-out. Calm at rest — shimmer, not spinner, during parse.
- **Signature interactions:** global capture bar above the nav (mic + text + camera); Zomato/Swiggy-style domain switcher on Today (`All · Health · Money · Habits · Skills`) that swaps Today's body to the selected lens.
- **Lenses are deliberately unalike:** Money = ledger · Health = dashboard/rings · Habits = streak grid · Skills = curriculum + hours.

---

## 10. Decided this session · open · next

**Decided (vetoable if you disagree):** all-TS Next.js on Vercel · AI SDK gateway · **Codex + GPT-5.6 = coding/build layer** · **runtime provider-agnostic, Gemini free tier as dev default, OpenAI/Claude adapters kept** · Drizzle + authenticated repository · SQLite-dev/local-password / Supabase-prod/Auth · PTT-only voice behind `VoiceProvider` · one coach engine + domain registry seam · Tailwind + shadcn + Framer · deterministic `fake` stack · **dev voice default = Gemini multimodal** · Razorpay test-mode rail at ₹499/year with no v1 feature gate · **demo runtime = both providers wired, decided at record time**.

**Credits status (not a stack decision):** 1,250 Codex credits in hand + a $100 grant request raised — enough runway to build; GPT-5.6/Codex is not a blocker.

**Open (single remaining call):** which provider the *submitted demo* runs on — both GPT-5.6 and Gemini stay wired; decide at record time.

**Next:** scaffold in Codex per the approved work order (provider layer + `fake` stack + typed schemas), then build the capture pipeline with Health as the first store/lens — *then* prompt-design the UI screens.
