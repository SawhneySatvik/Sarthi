# docs/product/PHASES.md — Sarthi Phased Implementation (D-026)

> The product ships in **phases**, each ending with a formal **Sol phase-review gate** against this doc.
> Phase 0+1 land by **Jul 21, 5 PM PT**. Phases 2+ are planned in the Claude Max session (docs/planning/PLANNING-BRIEF.md)
> and built after submission. These docs are the base — later phases will extend them, never silently rewrite them.

---

## Phase 0 — THE DEMO SPINE (inner ring · uncuttable)

Everything the hackathon rubric judges. Unchanged from the original plan.

**Scope:** provider layer + `fake` stack · typed stores (4 domains) · capture pipeline (parse →
route-by-confidence → swipe → typed write + undo → XP) · Health/Money/Habits/Skills lenses · voice PTT ·
vision (meal + receipt) · three-tier coach + adaptations · game layer · Today/Coach/Stats/Journey/Tools ·
Ember/Bone/Moss themes · eval harness + A/B report · seeded dogfood data.

**Gates:** FLOWS **F3** (fake stack, keyless) → F2/F6 (coach) → F7/F8 → **F11 dry-run clean**.
**Cut lines:** none. This ring is never traded.

## Phase 1 — THE SELLABLE WRAP (outer ring · by Jul 21)

Turns the demo into a product a stranger can sign up for and pay.

| # | Slice | Definition of done |
|---|---|---|
| 1.1 | **Live deploy** | Vercel + Supabase prod; one public URL; `fake`→Gemini→GPT-5.6 env-flip works in prod |
| 1.2 | **Real auth** | Supabase Auth email/password + reset; every persistent row and repository operation bound to resolved `userId`; local password gate remains dev/CI only |
| 1.3 | **Landing + pricing** | One hero page in the house style (painterly, Premium Dark): what it is, the 60-sec loop, Free/Pro section, **₹499/year (`49900` paise)**, CTA → signup/checkout |
| 1.4 | **Billing rail — last** | `plan` column (`free`/`pro`) + Razorpay test-mode annual checkout + idempotent verified webhook flips the flag + one visible Pro affordance; Pro gates nothing in v1 |
| 1.5 | **Legal stubs** | Privacy + ToS routes (honest AI/data/storage stubs) linked from auth and pricing; data-export row already in Settings |
| 1.6 | **Judge access** | Authenticated opt-in “Try the 12-day demo” clones seed rows into that user once and remains free. **Never paywall the demo path.** |

**Gate:** a stranger can: open URL → sign up → onboard → run one real capture → see the coach react →
hit the pricing page → complete checkout (test ok) → see Pro flip. Sol phase-review passes.

**Cut lines (in order, if the slice cannot meet its acceptance without blocking a required higher-priority gate — cut top first):**
1. Razorpay checkout → payment link / waitlist email capture (plan/webhook contract stays, rail later)
2. Landing polish → single hero section + CTA only
3. Money domain → light ledger (the original D-002 release valve)
4. Generated art → gradients + grain (permanent fallback, already law)
Never cut: the F11 demo spine, auth, the live URL.

## Phase 2 — PRODUCT DEPTH (post-submission · planned in the Claude Max session)

Candidates (from the deferred list + new): **mobile bake-off decision + build** (Capacitor vs Expo/RN vs
native — D-027) · full Pro feature set (D-029) · learned estimate-memory · streaming voice · push
notifications · offline sync · theme editor · remaining Tools roster · investing/Holdings seam · social.
**Nothing here starts before Jul 21 submission.** Output of the planning session = this section rewritten
as ticket-ready specs in `docs/roadmap/`.

## Phase 3 — GROWTH & SCALE (sketch only)
Multi-region, pricing experiments, referral loops, App Store/Play releases of the bake-off winner,
observability, support tooling. Planned properly at the end of Phase 2.

---

## Work-ordered execution — Phase 0 + 1 interleaved (D-035)

| Required gate | Phase-0 spine work | Phase-1 work eligible after the gate | Evidence that unlocks the next work |
|---|---|---|---|
| Foundation → **F3** | Scaffold · provider layer + `fake` · typed schemas · capture pipeline · Health store/lens + capture sheet | Credential provisioning only | Keyless fake + SQLite/local-password F3 passes with `wrongSilentWrites = 0`. |
| F3 → fan-out | Money/Habits/Skills stores + lenses · vision (meal + receipt) · onboarding | Production auth + `userId` scoping | Each typed domain meets its fixture and flow acceptance; shared P3 lens criteria pass when both paired lenses land. |
| Fan-out → complete journeys | Voice PTT · coach/adaptations · game layer · Journey/Stats/Tools/Settings · integration | Live Vercel/Supabase deploy | F2/F4–F10 run against scoped stores; a public URL runs the authenticated loop. |
| F11-ready | Screenshot verification · eval/A/B report · F11 rehearsal · record/README evidence | Landing + pricing · legal/PWA · judge seed · billing rail last | Every relevant ticket passes its acceptance. If the billing rail cannot prove signature/replay acceptance, cut line #1 switches its CTA to waitlist. |
| Final review | F11 dry-run clean | Phase-1 stranger journey and final deploy evidence | Sol phase review passes; submit before the fixed external deadline. |
