# docs/experience/FLOWS.md — Cross-Screen Journeys

| | |
|---|---|
| **Role** | The end-to-end paths that stitch the ten screen specs into one product. Build-order truth: if a flow below can't run, the screens aren't done. |
| **Platform** | **Mobile-first installable PWA** (locked D-019/D-020): home-screen icon, briefs generate on-open (staleness check), push = post-hackathon. Desktop = responsive stretch. |
| **Notation** | `[Screen]` → hop · `(state)` · **user act** · *system act* |

---

## F1 — First run (install → Day 1)

1. Open URL → `[Landing]` → **Sign up / Log in**. New accounts use Supabase email/password, existing accounts resume their authenticated state; reset password is available from login.
2. `[Onboarding A]` **Begin** → `[B1–B6]` core (~2 min, chips/voice) → `[C]` *four spines generate (deep tier, parallel, ≤8s)* → `[D]` **edit/trim → "Looks right — start Day 1"** → *plans + profile write (first and only onboarding write)*.
3. `[E interstitial]` **Sharpen it / Later** → (later) *gaps → `profile_gap` queue* → optional **Try the 12-day demo** seed → `[F]` theme (optional) → `[G/Today]` (Day 1, hint row, coach's first line, dismissible PWA install prompt).
   **Exit criteria:** Today shows a real spine · gaps queued · zero writes before D-accept.

## F2 — The daily loop (the habit we're building)

1. **Open app** (morning) → *staleness check → morning brief generates (deep tier)* → `[Today]` dawn scene, coach line fresh.
2. **Done** on NEXT UP → *check settles, XP ticks, next item rises* → *capture bar flips to "How'd it go?" (30s)* → (optional) **hold mic** → F3.
3. Through the day: **captures** (F3) *auto-check plan items, fill quantified challenges, satisfy linked habits*.
4. Evening (≥19:00 or all-done) → `[Today]` (all-done card) → **View recap** → `[Coach]` evening recap + adaptation chips.
   **Loop invariant:** Today never shows the feed; Coach never shows buttons-first; capture is the only rich write path.

## F3 — The capture loop (canonical, cross-domain)

1. Any tab → **hold mic** on the capture bar → `[Capture sheet: Input]` (waveform) → **release**.
2. *(Parsing)* raw quote pinned → *deep tier → `CaptureDraft`* → *route-by-confidence*.
3. `[Confirm]` *explicit proposals at confidence ≥.90 tick into the "filed automatically" strip (written)* · *estimates and lower-confidence explicit proposals stack as cards*.
4. Per card: **swipe → accept/discard** · **tap → edit** · **chip → flip domain** · **long-press → why**.
5. *(Fan-out)* *entries fly to domain chips · XP rolls · (level-up bloom if earned) · fast-tier one-liner*.
6. **Done** → sheet drops → `[Today]` *matching items now checked (`via capture`), satisfied-by badges live*.
   **Trust invariant (demo-critical):** nothing estimated ever writes without a card; the latest resolved commit batch carries one five-minute Undo.

## F4 — Correction & backdate (same sheet)

- **"That lunch was closer to 600"** → F3 steps 1–2 → *matched-entry selector, then edit card: `450 → 600 kcal` + selected-entry preview* → **accept** → *in-place update, no duplicate* → `[Health lens]` meal row shows 600, confidence chip cleared to `you`.
- **"Yesterday I skipped gym"** → *card carries date pill "Yesterday"* → **accept** → *backdated `HabitLog(skipped)`* → `[Habits lens]` heatmap yesterday updates; streak logic applies grace if earned.

## F5 — Receipt batch

`[Capture: Input]` **camera → snap receipt** → *(vision parse)* → `[Confirm]` *N transaction cards + merchant/date auto-fields in the strip* → (all ≥.8) **Accept all** → *fan-out to Money* → `[Money lens]` day group shows the batch; budget bars move.

## F6 — Evening close

All items resolved → `[Today]` *spine collapses to the day-complete card (one amber pulse)* → **View recap** → `[Coach]` *evening recap; adaptations chip-listed* → **tap chip** → *Adaptation sheet (before → after → reason)* → **Keep**. Tomorrow's plan reflects it at next open.

## F7 — The weekly ritual (the compounding wow)

Sunday evening open → `[Coach]` *weekly brief card generates: 4 domain trend lines (sparklines from real rows) + one honest observation + one adjustment + the evidence footer ("based on 43 entries")* → **adjustment chip → Keep** → *next week's plan adapts* → `[Stats]` (optional) **Day-1 toggle** — the then→now delta closes the emotional loop.

## F8 — Tools loops

- **Focus:** `[Skills drill]` **"Start 50m focus →"** → `[Tools: Focus sheet]` *(skill + duration pre-set)* → **Start** → (leaves tab) *resume ribbon persists* → *(complete)* *violet pulse · `Session` files via strip pattern · Skills counter live-ticks* → **+ note?** → F3 pre-framed.
- **Meditation:** `[Tools]` **Meditation card** → *(first use)* **"Add Meditate to your habits?" consent** → breath circle → *(complete)* *`HabitLog` writes · Today item checks*.
- **Afford-it:** `[Tools]` → **"3k on shoes?"** (voice) → *deep tier over ledger → verdict + the three numbers* → **Bought it → log** → standard commit → `[Money lens]`.

## F9 — Re-entry (3+ days away)

Open → *staleness check* → `[Coach]` opens first (one-time redirect) with re-entry prose · *plan auto-lightened as a visible Adaptation (chip: Keep/Revert)* → `[Today]` lighter spine. No guilt wall, no streak funeral — grace already applied.

## F10 — Profile & theme touch-ups

`[Any tab]` **avatar** → `[Settings]` → **Theme → Moss** *(app crossfades live behind the sheet)* · **Coach's open questions (2)** → answer chips → *gap clears from brief rotation* · **weight edit** → *consequence line* → **Save & recalibrate** → `[Health lens]` targets shift.

---

## F11 — THE DEMO (shot map, <3 min, mobile frame)

Mobile frame throughout (life-app energy); narration carries the Codex + GPT-5.6 story. Seeded 12-day profile is created through the authenticated opt-in seed flow; a judge/dev recording build may expose the same action. Provider = D-006, decided at record.

| # | ~s | Shot | Screen | Narration beat |
|---|---|---|---|---|
| 1 | 0–10 | Cold open: hold mic, speak the messy dump | Capture: Input | "One sentence. Four life domains." |
| 2 | 10–25 | Quote pins → shimmer → strip ticks in, cards stack | Parsing → Confirm | "GPT parses it into typed entries — explicit values file themselves; estimates wait for me." *(model tier named)* |
| 3 | 25–45 | Swipe meal card (photo→macros), flip a mis-tagged domain, discard noise, long-press "why" | Confirm | "Vision estimated the macros; I stay in control — glass-box." |
| 4 | 45–60 | Fan-out: entries fly, XP rolls, level-up blooms | Fan-out → Today | "Four trackers, one breath. And the plan just adapted." |
| 5 | 60–80 | Today: items auto-checked, satisfied-by badge, Done on next | Today | "Plan-forward, calm. Water habit satisfied itself from Health." |
| 6 | 80–100 | Coach: daily brief + adaptation chip → before/after/reason | Coach | "The coach shows its work — and it compounds…" |
| 7 | 100–125 | **Weekly brief** card: trends, the honest observation, evidence footer | Coach | "…into this. Based on 43 real entries." |
| 8 | 125–140 | Stats Day-1 toggle flip · Skills counter ticking under a live Focus timer | Stats → Tools | "Day-streaks for habits, mastery hours for skills." |
| 9 | 140–155 | **Judge/dev Settings → authorized provider override → capture one line again** | Settings → Capture | "Provider-blind by design — same app, different model, live." |
| 10 | 155–175 | Journey scroll: photos, coach notes, milestone diamonds | Journey | "Your proof, kept." + Codex build story ("built end-to-end in Codex — session ID in the README") |
| 11 | 175–180 | Close card: wordmark + one line | — | "Sarthi. One sentence a day." |

**Recording insurance:** run on the `fake` stack for a deterministic rehearsal, flip to the live provider for the take; seed gesture resets state between takes.

---

## Build-order note

F3 is Day-1's definition of done (with Health). F2+F6 land with the coach (Day 3). F7, F8, F11 are the polish-phase gates. Every flow above appears in some screen's verify checklist — FLOWS is the integration test written as prose.
