# Deploy setup — Supabase → Vercel (your runbook)

> Your action checklist for tonight's live deploy. Deploy DB = **Supabase Postgres**. Real captures = **BYOK** (testers paste their own key) so **you supply no API keys**. First deploy runs keyless on the **fake stack** to prove the pipeline, then we layer BYOK + per-browser sandboxes on.
> **Commands in §2 you run in YOUR terminal** — `drizzle-kit` is blocked for the agents by a safety hook, so schema/seed is your hands.

## ⚠️ Gotcha #0 — SSL (this bites first)
Supabase requires TLS and the Postgres driver won't enable it from a bare URL. **Append `?sslmode=require` to EVERY connection string** below (both the terminal commands and the Vercel env var).

---

## 1. Supabase — create the project + grab TWO strings
Supabase's connection strings are **not interchangeable**. From Dashboard → Project → **Connect**:

| Label | Port | Used for | Notes |
|---|---|---|---|
| **A — Direct / Session** | **5432** | schema apply + seed (DDL) — the §2 commands | Prefer the **Session pooler** host (`...pooler.supabase.com:5432`), IPv4-safe. Raw Direct is IPv6-only on free tier. |
| **B — Transaction pooler** | **6543** | the **Vercel runtime** | `...pooler.supabase.com:6543`. Serverless-safe. |

Set + save your DB password (it's embedded in both). Fill the real password in, not the `[YOUR-PASSWORD]` placeholder.

---

## 2. Provision schema + seed — **run these in your terminal** (uses string A, `:5432`)
```bash
# 1. Materialize the full schema (35 tables incl. profiles.timezone). Accept the create prompt.
DB_URL="postgresql://…SESSION…:5432/postgres?sslmode=require" pnpm db:push:postgres

# 2. Seed the demo data (under userId "local-dev"). Self-verifies profiles.timezone exists; fails loudly if not.
DB_URL="postgresql://…SESSION…:5432/postgres?sslmode=require" pnpm db:seed:postgres
```
Optional manual check the timezone column landed:
```sql
select column_name from information_schema.columns where table_name='profiles' and column_name='timezone';
```

---

## 3. Vercel — project + env vars + deploy
1. **Add New → Project → import this repo.** Framework auto-detects **Next.js**. *(Tell me your production-branch choice — `ui/enhancement` is fine to start; I commit code, not docs, and push before deploy.)*
2. **Settings → Environment Variables** (all server-only, NO `NEXT_PUBLIC_`). For the **first de-risk deploy** (keyless, single-tenant to prove the pipeline):
```
DATABASE_PROVIDER = postgres
DB_URL            = postgresql://…TRANSACTION-POOLER…:6543/postgres?sslmode=require
LLM_PROVIDER      = fake
VOICE_PROVIDER    = fake
VISION_PROVIDER   = fake
AUTH_PROVIDER     = local-password
APP_PASSWORD      = <pick a login password>
BILLING_MODE      = waitlist
JUDGE_MODE        = false
# DB_AUTH_TOKEN   = (leave UNSET — libSQL/Turso only)
```
3. **Deploy** (default Node runtime — no edge routes).

---

## 4. Live smoke (this is our proof the DB round-trip works)
Open the deployed URL, pass the `APP_PASSWORD` gate, then check **`/today`** and **`/coach`** render. If `/coach` renders, the Postgres dialect round-trip is healthy (it reads jsonb + booleans back) and the seed is visible.

---

## 5. Then I take over (second pass)
Once the fake-stack deploy is proven live, I flip the real experience on: swap `AUTH_PROVIDER` to the **per-browser sandbox** (each visitor isolated, "Try the demo" → seeded data), turn on **BYOK** (testers paste their own Gemini/OpenAI key — all AI calls), and verify F3 + the demo spine + a day-rollover walk on the live URL. Then README → you record.

---

## 6. One decision I need before the *real-capture* demo (not blocking the de-risk deploy)
**Photo/receipt capture won't persist on Vercel** — object storage is unwired (serverless FS is read-only), so the vision path can *parse* a photo (with a BYOK key) but can't *store* the image. Options, pick when we get there:
- **(a) Voice-only live demo** — the canonical F3 dump is voice; photo capture shown locally, not on the live URL. Zero extra work. **(recommended for tonight)**
- **(b) Wire Supabase Storage** for media — makes photo capture fully live, but it's extra build time tonight.

## Fallback rail
If Postgres apply/connect fails on your Supabase instance in a way we can't quickly clear, I switch to a hosted libSQL/Turso path so we still ship *a* live deploy. (Caveat found during prep: the default libSQL client isn't serverless-safe as-is; the fallback needs its web entrypoint — so Postgres staying healthy is the smooth path.) I'll flag that call the moment it comes up.
