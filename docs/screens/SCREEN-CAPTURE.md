# docs/screens/SCREEN-CAPTURE.md — The Capture Sheet

| | |
|---|---|
| **Role** | The moat. One input → many typed entries. Every other screen exists around this one. |
| **Entry points** | Global capture bar (every tab) · seed chips · Today's "how'd it go?" nudge · Habits/lens quick-log |
| **Form** | Bottom sheet sliding over the current tab (never a page navigation) |
| **Inherits** | `docs/experience/DESIGN.md` — tokens, type, motion, don'ts |

---

## 0. The one-sentence spec

Hold the mic, say your messy sentence, release → shimmer → explicit values file themselves into a quiet strip while estimated values stack as swipeable cards → swipe/edit/flip → entries fly to their domains, XP rolls, the coach says one line.

## 1. Sheet anatomy (shared chrome across all states)

```
┌─────────────────────────────────────┐
│  ─── grabber ───            ✕ close │  ← drag-to-dismiss handle
│                                     │
│  [ STATE BODY — see §2–§5 ]         │
│                                     │
│  coach strip (post-commit only)     │  ← Fraunces, one line, --ink-2
└─────────────────────────────────────┘
```

- Sheet: `--bg-raised`, radius `--r-card` top corners, slides up at `--t-slow`; backdrop = `--scrim` over the tab beneath (the tab stays visible, dimmed — capture feels *over* your life, not instead of it).
- Height: input state ≈ 62% viewport; confirm state grows to ≈ 88%; never fullscreen (the grabber + peeking tab preserve context).
- Dismiss: swipe grabber down or ✕. If pending cards exist → inline confirm chip: "Discard 3 unreviewed?" (Keep / Discard) — never a modal.

## 2. State A — INPUT

Layout, top → bottom:

1. **Prompt line** (title type, `--ink-1`): contextual, time-aware — "What happened?" default; "Morning — how did you wake?" before 9am; after a Done/Skip on Today: "How'd it go?"
2. **Hero — the Capture Orb** (replaces the plain mic, D-024). A ~140px **audio-reactive point-cloud sphere**: an icosphere of 4–6k particles displaced by simplex noise in a vertex shader.
   - **Idle:** near-still — low noise amplitude, slow drift, particles in `--ink-2` at low alpha with a faint `--ink-1` core. It breathes; it does not perform (calm at rest).
   - **Hold-to-talk:** Web Audio API analyser (mic stream) drives shader uniforms — RMS → noise amplitude, band energy → noise speed — so the orb ripples and swells *with the voice*; particles brighten toward `--ink-1`, a soft bloom (never amber — amber stays earned). Haptic tick on press/release. Release = submit; slide-up-to-cancel while holding.
   - **Handoff:** on release the orb contracts and settles into a slow "thinking" rotation, then collapses upward into the pinned quote as State B's shimmer takes over — the orb IS the capture identity across states.
   - **Implementation:** Three.js `Points` + custom shader (`uTime, uAmp, uSpeed`), additive blending, DPR capped at 2, render paused when the sheet is closed. **Fallbacks:** `prefers-reduced-motion` / no-WebGL / low battery → static layered-gradient orb with a gentle scale pulse; the persistent capture **bar** uses a small static orb glyph (gradient + grain), never live WebGL. Keyboard/text path unaffected.
3. **Flanks:** keyboard toggle (left) · camera (right), 44px icon buttons, `--ink-2`.
   - Keyboard mode: mic shrinks to a trailing icon inside a full-width text field (`--r-input`), autofocus, sheet lifts above keyboard; submit = send icon or Enter.
   - Camera: opens system camera/picker → photo thumbnails append into the input as chips (photo-only capture is valid — no text required).
4. **Seed chips row** (horizontal scroll, `--r-chip`, `--bg-card`): `log a meal` · `add expense` · `did a session` · `skipped something` · `weigh-in` · `receipt`. Tap = pre-frames the parse (sets a parse hint + keyboard placeholder, e.g. *"2 rotis, dal, a coke…"*). Chips are hints, not modes — the parse still accepts any mix.
5. **Micro-history line** (`--ink-3`, caption): "Last: lunch ₹340 · 2:10pm" — one line, tap = opens that entry. Kills the "did it save?" doubt.

Empty-input submit → gentle shake of the field, no error text.

## 3. State B — PARSING (shimmer)

- Input collapses upward; **2–3 skeleton cards** appear with the diagonal shimmer sheen (DESIGN §5.2). Never a spinner, never a progress bar.
- The raw utterance stays pinned at top in quotes (`--ink-2`, Fraunces) — the user sees what the model heard; STT errors are caught *here*, tap the quote to edit-and-reparse.
- Budget: if parse > 6s, shimmer cards gain a caption "still thinking…"; > 15s → error state E1 (§7).

## 4. State C — CONFIRM (the deck)

Two zones, unmistakably different (Principle 5):

### 4a. "Filed automatically" strip (explicit values)
- Quiet horizontal strip of micro-rows above the deck: `✓ ₹340 · Food` · `✓ 500ml water` · `✓ 90min · System Design`. Each ticks in with 40ms stagger, `--ok` check, `--ink-2` text, domain-hued left tick.
- Every row is tappable → inline edit (undo lives here too: swipe row left = undo write). Quiet ≠ hidden.

### 4b. The estimate deck (Tinder stack)
- Card stack, top card full, next two peeking beneath at 96%/92% scale. Card = `--bg-card`, radius `--r-card`, one shadow.
- **Card anatomy:**
  - **Domain chip** (top-left, domain hue, `--r-chip`) — **tap to flip domain**: chip expands into a 4-chip row (Health/Money/Habits/Skills), pick one, payload re-targets. Model decides, user overrides.
- **Confidence dot** (top-right): `--ok` ≥.9 · `--warn` .5–.89 · `--danger` <.5, with % on long-press. The router alone decides auto-write at ≥.90; the dot is explanatory, not a second policy.
  - **Body:** the estimate in Display type — "≈ 450 kcal" — with the parsed item beneath in body ("2 rotis + dal"). Meal photo (if any) full-bleed top under scrim.
  - **Footer:** `estimated` tag + tiny "why?" affordance.
- **Gestures** (buttons mirrored below the deck for a11y — ✕ · ✎ · ✓):
  - **Swipe right / ✓** = accept → writes to typed table, card tosses right.
  - **Swipe left / ✕** = discard → tosses left, nothing persists.
  - **Tap / ✎** = edit-in-place: number becomes a stepper/field, category a chip row; save = accept.
  - **Long-press = "why this number"** (glass-box): card flips; back face in Fraunces — "2 rotis ≈ 200 kcal, dal bowl ≈ 250 · source: estimate · confidence 74%". Tap flips back.
- Deck counter: "2 of 5" caption. Under-deck **Accept all** appears only when every remaining card is ≥ .8 confidence.

## 5. State D — FAN-OUT (commit)

1. Last card resolved → strip + deck compress; each accepted entry **flies toward its domain chip** in a summary row (Health ×2 · Money ×1 · Skills ×1), shrinking into it (DESIGN §5.4).
2. **XP counter rolls** (+40 XP, amber, tabular). **Level-up** (if earned): amber bloom ≤900ms inline, never modal.
3. **Coach one-liner** fades in (Fraunces, fast tier): *"Solid lunch under budget — water's ahead of pace. Gym at 6 still on?"*
4. Resting footer: `Done` (dismiss) · `+ Add more` (back to input, sheet stays up).

Sheet auto-dismisses after 4s of no interaction *only if* no level-up fired.

## 6. Edge paths (same sheet, same deck — no special screens)

| Path | Behavior |
|---|---|
| **Receipt snap** | photo → vision parse → N transaction cards stacked; strip shows merchant/date auto-fields; **Accept all** rule applies |
| **Recurring** ("rent 15000") | transaction card + a second **Make recurring?** card (cadence chips: monthly/weekly) — accepting creates `RecurringRule` |
| **Backdate** ("yesterday I skipped gym") | card carries a date pill ("Yesterday", tappable → date picker); writes with that date; HabitLog `status: skipped` |
| **Correction** ("that lunch was closer to 600") | **Edit card** — shows old→new ("450 → 600 kcal") and the matched entry preview; accept = updates in place, **no duplicate** |
| **Ambiguity** (ask-don't-invent) | card renders as a **question card**: "Which skill was the 90 min?" + chips (DSA / System Design / + new) — no phantom entries, ever |
| **Photo-only** | vision proposes; deck as normal |
| **Mixed everything** | one utterance can produce any mix of the above in one deck |

## 7. Error & empty states

- **E1 Parse failed / timeout:** raw quote stays, one line — "Couldn't parse that. Retry, or file it as a note?" → `Retry` / `Save as note` (writes a CoachNote, nothing typed).
- **E2 STT low confidence:** quote renders with `--warn` underline on uncertain words; tap-to-correct before parse commits.
- **E3 Offline / provider down:** the current draft remains visible in the open sheet with `Retry` / `Copy text`; nothing is persisted or queued for later automatic filing.
- **E4 Nothing extractable** ("hello?"): coach replies in-strip ("Tell me what happened — a meal, a spend, a session…") — no empty deck.

## 8. Responsive & a11y

- **Desktop:** sheet becomes a centered 520px panel; deck gestures work with pointer drag; keyboard: ←/→ discard/accept, Enter edit, `?` why, Esc dismiss (DESIGN §9).
- Buttons under the deck are the primary path for motor-impaired users; hold-to-talk has a tap-to-toggle alternative (Settings: "tap to talk").
- Waveform + shimmer respect `prefers-reduced-motion`.
- All card text meets AA on `--bg-card` in all 6 theme-modes.

## 9. Data contract (what this screen reads/writes)

- Reads: `CaptureDraft { raw, proposals[] }` from `parse_dump`.
- Writes: `commit_entry(proposal)` per acceptance → typed tables; the resolved batch atomically records row ids/snapshots, XP, and plan/satisfied-by effects in the append-only `commits` record.
- Undo: only the latest commit batch is undoable for five minutes; one compensating commit restores every affected typed and derived row. There is no undo-history UI in v1.
- Auto-accept rule (route-by-confidence): only `estimated:false` **and** `confidence ≥ .90` → strip; every estimate or lower-confidence explicit proposal → deck. **No estimated value ever writes without a card.**
- Coach line: fast tier, fired once per commit batch with the batch summary.

## 10. Defaults set here (vetoable)

1. **Sheet-over-tab** (not fullscreen page) — context preservation is the calm.
2. **Accept-all gated at ≥.8** confidence on all remaining cards.
3. **TTS reply off by default** — coach line is text; a speaker toggle on the strip plays it (Settings can default it on).
4. **Auto-dismiss 4s** after fan-out (unless level-up).
5. Seed chips are the fixed six above for v1 (personalized chips = roadmap).

## 11. Screenshot-verify checklist (F3 gate)

Input (idle · holding · keyboard · photo-chip) · shimmer · confirm (strip-only · deck-only · both · question card · edit card · receipt batch) · why-flip · domain-flip · fan-out · level-up · E1–E4 — each at 390px + desktop, Ember Dark + Ember Light minimum.
