# Sarthi

> सारथी — *the charioteer who steers the rider.* A voice-and-photo life coach that runs your whole life from one capture surface.
> OpenAI Build Week · Track: **Apps for your life** · Coded with Codex + GPT-5.6.

---

## What it is

You dump one messy sentence — *"spent ₹340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10"* — and Sarthi parses it into structured entries across **four life domains at once**: a Money transaction, a Health meal (with estimated macros) + water, a Skills session, a Habit log. Each estimated entry is a card you confirm with a **swipe** before anything is written; photos are read by vision to estimate macros or parse receipts. The coach reads it back, **adapts** your day, and **explains why**.

Health / Money / Habits run as day-based **challenge arcs** (33/66/99); Skills run as hour-based **mastery tracks**.

## The moat

**One utterance → many structured entries across domains, in one shot.** Plan-and-gamify apps make you tap into four separate trackers and hand you a static plan. Sarthi collapses the trackers into one sentence and re-plans around your real day. Underneath: **one ephemeral parse-and-confirm pipeline, four per-domain typed stores, four deliberately-unalike review lenses.** A new domain is a schema + a lens — the pipeline is built once.

**60-second demo:** one spoken dump → a swipe-deck files entries across 3–4 domains → the coach adapts → the weekly brief shows the coaching compounding.

## The four domains

| Domain | Mode | What the AI does |
|---|---|---|
| **Health** | daily arc | estimate kcal/macros/burn from text or photo; adapt workouts |
| **Money** | arc + ledger | parse receipts, categorize, detect recurring, flag leaks |
| **Habits** | daily arc | behavior design — ramp targets, habit stacking, satisfied-by links |
| **Skills** | mastery (hours) | generate a roadmap for anything; log hours; checkpoint |

## How it's built vs how it runs — two model layers

- **Built with Codex + GPT-5.6.** The app is coded end-to-end using Codex powered by GPT-5.6 (`/feedback` session ID captured). This is the hackathon's "central to GPT-5.6" story.
- **Runtime is model-agnostic.** The models the app *calls* (parse, coach, vision, voice) route through the Vercel AI SDK by env var, with provider-neutral capability tiers (`deep`/`balanced`/`fast`). Dev runs on **Gemini's free tier** for cheap iteration; **GPT-5.6 and Claude** are wired as swappable adapters; the demo flips to either in one env line.

## Stack

All-TypeScript **Next.js (App Router)** on **Vercel** · **Vercel AI SDK** gateway (OpenAI / Google / Anthropic + `fake`) · **Drizzle** over **SQLite (dev) → Supabase Postgres (prod)** · **PTT voice** behind a `VoiceProvider` interface (Gemini multimodal default; Sarvam / OpenAI / Web Speech adapters) · **Tailwind + shadcn/ui + Framer Motion**, Premium Dark. Every provider (LLM / voice / vision / DB) sits behind an interface with a deterministic `fake` adapter, so the whole loop runs keyless.

## Status (2026-07-17)

The D-026 two-ring contract is current: Phase 0 is the uncuttable F3→F11 demo spine; Phase 1 adds Supabase Auth, a public landing/pricing path, a Razorpay test-mode rail, legal stubs, and opt-in judge seed access without paywalling free v1. The work-gated execution order and cut lines live in `docs/product/PHASES.md` and `docs/planning/TICKETS.md`. The remaining demo call is D-006: runtime provider at record time.

## Docs

- **`docs/product/PRD.md`** — full product spec (v2.1, de-staled). The deep reference.
- **`docs/architecture/TECH-STACK.md`** — architecture, folder layout, provider interfaces, capture pipeline, touch-and-feel.
- **`docs/product/DECISIONS.md`** — append-only decision log (constraints, not suggestions).
- **`docs/product/PROJECT.md`** — this file.
- **`docs/product/PHASES.md`** — current work order, two rings, gates, and cut lines.
- **`docs/screens/SCREEN-AUTH.md` / `docs/screens/SCREEN-PRICING.md`** — Phase-1 public auth and checkout flows.

## Hackathon — GPT-5.6 + Codex (for the README + video narration)

- **Codex** coded the whole system: capture pipeline, per-domain stores, four lenses, coach tiers, Next.js console, eval harness. Log 3–4 "Codex accelerated X" moments; keep the `/feedback` session ID.
- **GPT-5.6** — the deep tier does the parse (the moat) and the daily/weekly coaching; the fast tier does the per-capture line + domain classify (the cost story); vision estimates meal macros and reads receipts. The demo can run entirely on GPT-5.6.
- **Model-agnostic by design** — the same build runs on Gemini (dev) or GPT-5.6/Claude (demo) with no code change, demonstrated in the eval A/B report.

## Setup

_TBD once scaffolded._ Target: `pnpm install` → set `.env` (`LLM_PROVIDER`, `VOICE_PROVIDER`, `DB_URL`, keys) → `pnpm dev`. Dev/CI run keyless on fake LLM/voice/vision + SQLite + the local password identity; Supabase Auth/Postgres are production-only. Sample dogfood data is cloned only through the authenticated demo-seed action.
