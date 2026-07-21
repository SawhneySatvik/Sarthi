# Sarthi

> सारथी — *the charioteer who steers the rider.* A voice-and-photo life coach that runs your
> whole life from one capture surface.

You speak one messy sentence — *"spent ₹340 on lunch, 2 rotis and dal, drank a bottle, 90 min of
system design, woke at 5:10"* — and Sarthi parses it into typed entries across **four life domains at
once**: **Health · Money · Habits · Skills**. Explicit values file silently; anything **estimated**
surfaces as a swipe card you confirm before it is written — *nothing estimated ever writes
unconfirmed*. Photos are read by vision to estimate meal macros or parse receipts. A three-tier coach
then **reacts** per capture, **briefs** you each morning, **reflects** each week, and **adapts** your
plan glass-box: every change shows *before → after → reason* and is revertible.

**The spine:** one capture pipeline → four typed per-domain stores → four deliberately-unalike review
lenses. A new domain is just a schema plus a lens.

---

## Live demo

**Live:** `<LIVE_URL_PLACEHOLDER>`

- **Try the demo** drops you straight into the seeded **12-day** experience — a populated Today,
  four domain lenses with real data, and the coach mid-conversation. No sign-up.
- **Start fresh** mints a private per-browser sandbox and walks you through onboarding from an empty
  slate — your own isolated space, nobody else's data.

The demo is **always free and never paywalled** — judges and first-time visitors get the full seeded
experience with no gate.

---

## Bring your own key (BYOK)

The live site runs keyless on a deterministic fake stack by default. To run **real AI captures**, open
**Settings → "Your AI key"** and paste your own **Gemini** or **OpenAI** API key.

- The key is stored **only in your browser** (localStorage) and attached per request — it is **never
  persisted to our servers, never logged**, and scrubbed from any error message.
- One key powers **all** AI: parse, photo/vision, and coach.
- Without a key, the seeded demo and the deterministic fake stack still work fully — you just don't get
  live model calls.

---

## Run it locally (keyless)

**Prerequisites:** Node ≥ 22 and pnpm 11.9 (see `packageManager` in `package.json`).

```bash
pnpm install

# Seed a populated SQLite DB (the 12-day demo). `populated` is the default state,
# so `pnpm db:seed:dev` alone also works. The script resets the local db file and
# applies migrations itself — no separate migrate step.
SEED_STATE=populated pnpm db:seed:dev

pnpm dev   # → http://localhost:3000
```

No `.env` and **no API keys** are required. The defaults are keyless: `DATABASE_PROVIDER=sqlite`, all
providers set to `fake` (`LLM_PROVIDER` / `VOICE_PROVIDER` / `VISION_PROVIDER`), and
`AUTH_PROVIDER=local-password`, which logs you in as a single local user automatically (no password
gate in dev). To customize, copy `.env.example` to `.env`.

To light up **real AI locally**, use the same **BYOK** panel above (Settings → "Your AI key") — no
server keys needed.

---

## Sample data / demo path

Seeding the `populated` state (via `pnpm db:seed:dev`, or the "Try the demo" path on the live site)
loads a hand-built **12-day** journey across all four domains:

- **Health** — logged meals with macros and water intake, feeding the Health lens rings.
- **Money** — a current-month ledger with a recurring salary credit, recurring rent and a subscription,
  categorized spend (food tracking to ~78% of budget, transport to ~95%), and an uncategorized debit.
- **Habits** — several daily habits with streak flames, a month heatmap (including grace-gapped days),
  and a "satisfied-by" habit that completes from a linked Health metric.
- **Skills** — a "System design" mastery track past the 100-hour tier with a 500-hour target, a
  five-step curriculum, and a believable session history, plus a dormant "DSA" track.
- **Coach** — a daily note, a weekly reflection, and one glass-box plan adaptation (before → after →
  reason, revertible).

Reach it by clicking **Try the demo** on the landing page, or by opening `/today` after seeding.

---

## Tech

- **Next.js** (App Router) + **TypeScript**
- **Tailwind** with a token-only design system (no hardcoded colors/radii in components)
- **Drizzle ORM** over **SQLite** (dev) → **Supabase Postgres** (prod), behind a repository layer
- **Vercel AI SDK** — provider-agnostic gateway: **Gemini / OpenAI / deterministic fake**
- **Framer Motion** for motion
- **Vercel + Supabase** for deploy

Every provider (LLM / voice / vision / DB) sits behind an interface with a deterministic `fake`
adapter, so the whole capture loop runs **keyless**. Architecture spine: **one capture pipeline → four
typed per-domain stores → four review lenses.**

> **Two model layers, never conflated.** The models the *app calls at runtime* (parse/coach/vision) are
> provider-agnostic and default to the keyless fake stack — real calls come from BYOK or env config.
> This is separate from the models used to *build* the code (see below).

---

## Deploy

Full Supabase → Vercel runbook (connection strings, env vars, smoke test):
**`docs/operations/DEPLOY-SETUP.md`**.

---

## Build story

Built for **OpenAI Build Week** — track: **Apps for your life**. Coded end-to-end with **Codex +
GPT-5.6**.

Build session reference: `<FEEDBACK_SESSION_ID_PLACEHOLDER>`
