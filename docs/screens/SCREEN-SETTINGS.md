# docs/screens/SCREEN-SETTINGS.md — Settings / Profile

| | |
|---|---|
| **Role** | Everything configurable, behind the header avatar (locked D-016 — not a sixth tab). Home of the theme switcher (D-013), the editable profile, voice & coach preferences, data controls, and the developer/provider section that demos the plug-and-play story live. |
| **Form** | Full-height sheet over the current tab (capture-sheet pattern); sections as a grouped list, sub-screens push within the sheet |
| **Inherits** | `docs/experience/DESIGN.md` — this screen is deliberately the most conventional in the app: quiet, listy, zero cleverness |

---

## 0. The one-sentence spec

A calm grouped list — you, your look, your coach, your data — where every onboarding answer is editable and the AI's remaining questions are visible.

## 1. Anatomy

```
┌─────────────────────────────────────┐
│  ── grabber ──                    ✕ │
│  [avatar]  Satvik                   │  ← identity header
│  Day 12 · L4 · joined Jul 15        │     (caption, --ink-3)
├─────────────────────────────────────┤
│  APPEARANCE                         │
│   Theme            Ember        ▸   │
│   Mode             System       ▸   │
├─────────────────────────────────────┤
│  PROFILE                            │
│   Your details                  ▸   │  ← every onboarding answer
│   Coach's open questions (3)    ▸   │  ← the profile_gap queue
│   Units            Metric      ⇄    │
├─────────────────────────────────────┤
│  CAPTURE & VOICE                    │
│   Mic              Hold to talk ⇄   │
│   Spoken replies   Off          ⇄   │
├─────────────────────────────────────┤
│  COACH                              │
│   Morning brief    7:00 AM      ▸   │
│   Weekly brief     Sun evening  ▸   │
│   On-open briefs   Morning + weekly ▸ │
├─────────────────────────────────────┤
│  DATA                               │
│   Export my data                ▸   │
│   Danger zone                   ▸   │
├─────────────────────────────────────┤
│  DEVELOPER  (collapsed by default)  │
│   AI provider      Gemini       ▸   │
│   Voice provider   Gemini       ▸   │
│   Seed demo data                ▸   │
├─────────────────────────────────────┤
│   Sarthi v1.0 · about · sign out    │
└─────────────────────────────────────┘
```

Rows: 52px, `--ink-1` label, value in `--ink-2` right, chevron or inline toggle (⇄). Section headers in caption caps, `--ink-3`. No icons per row — the quietest screen in the app.

## 2. Appearance (the D-013 surface)

- **Theme →** the switcher sub-screen: three **live preview cards** (Ember · Bone · Moss), each a miniature Today rendered with real tokens (header scene placeholder + stat cluster + one row). Tap = applies instantly app-wide (`data-theme` swap, `--t-base` crossfade — no reload). Current theme ringed in `--ring`.
- **Mode:** `Light · Dark · System` segmented control; applies with the same crossfade. Preview cards render in the active mode.
- Persist: `localStorage` (dev) → Supabase profile (prod). This sub-screen is the onboarding Phase-F component reused 1:1.

## 3. Profile

- **Your details →** every onboarding answer as editable rows, grouped by the same phases (Core: name, birthdate, body, day shape, time budget · Detail: food pattern, screen time, focus, career, money picture). Number rows reuse the onboarding steppers; body row keeps the metric⇄imperial toggle (storage stays integer-metric). Edits that affect targets show a one-line consequence before saving: *"Updating weight recalibrates your kcal target."* → `Save & recalibrate`.
- **Coach's open questions (n) →** the live `profile_gap` queue as answerable rows (chips inline, same surfaces as onboarding). Answering removes it here *and* from the daily-brief rotation. Empty state: *"Nothing pending — I know what I need for now."* (Fraunces).
- **Units:** Metric ⇄ Imperial — display-only conversion.

## 4. Capture & Voice

- **Mic:** `Hold to talk ⇄ Tap to talk` (the a11y alternative from SCREEN-CAPTURE §8).
- **Spoken replies (TTS):** Off by default (capture default #3); On = coach one-liners and brief openers play aloud.
- (Language for STT rides the provider's auto-detect in v1; an explicit language picker is roadmap.)

## 5. Coach

- **Morning brief time:** time picker (default 7:00, snapped to wake time from B4 if set).
- **Weekly brief:** day/evening picker (default Sunday — Coach default #2).
- **On-open briefs:** `Morning + weekly` (default) · `Weekly only` · `Off`. This controls in-app freshness behavior only; push and streak-risk notifications are post-hackathon.

## 6. Data

- **Export my data →** one tap generates a JSON bundle (all typed tables + profile + coach notes) — the DB-agnostic story doubles as user respect.
- **Danger zone →** red-tinted sub-screen: `Clear today's entries` (undoable 5 min) · `Reset arc` (confirm phrase) · `Delete everything` (typed confirm; dev = wipes SQLite, prod = Supabase cascade). Each states exactly what it touches.

## 7. Developer (the plug-and-play demo surface)

Available only in development builds or a separately configured judge environment — never exposed by a production gesture:

- **AI provider:** `Gemini · GPT-5.6 · Claude · Fake` — flips `LLM_PROVIDER` at runtime for this session; a caption shows the active tier map ("deep = gemini-2.5-pro · fast = gemini-2.5-flash-lite"). **This is the demo moment for judges: swap providers mid-demo, capture again, same app.**
- **Voice provider:** `Gemini · Sarvam · OpenAI · Web Speech · Fake`.
- **Seed demo data:** invokes the same authenticated, idempotent 12-day seed action used after onboarding.
- Public production builds omit this section entirely. Judge builds enable it through an environment allowlist and authenticated session, not a 7-tap.

## 8. Footer

Version · `About` (one screen: what Sarthi is + the house-style credit) · `Sign out` (prod only; dev shows `Local mode`).

## 9. States

| State | Behavior |
|---|---|
| Gaps answered to zero | Profile row badge count disappears; queue shows the Fraunces empty line |
| Theme applied | sheet stays open, app behind crossfades — instant feedback |
| Consequence edit declined | field reverts, no save |
| Export (prod, large) | progress row inline, file downloads/share-sheet |
| Delete-everything done | app returns to onboarding Phase A |

## 10. Responsive & a11y

Desktop: sheet becomes a centered 560px panel; sections in one column (no settings-app two-pane — not enough settings to justify it). All toggles keyboard-operable; theme preview cards have text labels ("Ember — warm dark"); consequence lines announced before save. AA in all six theme-modes (this screen is where all six are most visible — it's the tuning ground).

## 11. Data contract

Reads/writes `Profile` (edits → target recalcs via the domain specs) · `profile_gap` queue · theme/mode + prefs (`localStorage` → Supabase profile) · authorized session-scoped provider overrides (dev/judge env only) · export = repository-scoped serializer · danger ops = repository-scoped deletes with undo where stated.

## 12. Defaults (vetoable)

1. Developer section is available only in dev or an explicitly configured judge environment; public production has no gesture to reveal it.
2. Provider flip is session-scoped (env default returns on reload).
3. On-open briefs default to `Morning + weekly`; push notifications remain deferred.
4. Export = JSON bundle v1 (CSV per-table roadmap).
5. Morning brief default 7:00 or wake-time snap.

## 13. Screenshot-verify checklist

Main sheet · theme switcher (3 previews × both modes) · mode crossfade mid-frame · profile details + consequence line · gap queue (3 items / empty) · TTS + mic toggles · danger zone + typed confirm · developer section + provider flip caption · about — 390px + desktop, **all three themes both modes** (this is the tuning screen).
