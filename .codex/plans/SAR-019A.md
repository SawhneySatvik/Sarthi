# SAR-019A — Visual Narrative & Voice-First Refinement

**Status:** LANDED 2026-07-19 — keyless validation and targeted D-041 review passed.
**Owner:** `pipeline` / `screens` (Terra). **Reviewer:** Sol.
**Depends:** SAR-018; SAR-019 is manually accepted. **Blocks:** SAR-020.
**Hard boundary:** no work from SAR-021 or later.

## Contract

1. **Decision records.** D-047 permits a bounded Journey memory model:
   `daily_reflections` + `reflection_media`, both non-null `userId` scoped,
   never generic events or a fifth domain. D-048 changes Today to art-led,
   individually swipeable remaining-task cards. All other capture/domain
   invariants stay unchanged.
2. **Theme/default.** Add `system` as a persisted theme-mode preference. New
   and unconfigured users default to Bone + system; saved selections remain
   exact. Six explicit screenshot theme/modes keep working.
3. **Daily reflection.** One record per `(userId, localDate)`: fixed mood,
   `energyLevel` integer 1–5, nullable integer `sleepMinutes`, journal text,
   grounded summary + provider provenance. An explicit save creates/updates it;
   no XP, plan, typed-domain, or adaptation write occurs. The reflection is
   kept if a generated summary fails; the UI uses a factual deterministic
   fallback instead of inventing AI text.
4. **Media.** Up to four JPEG/PNG/WebP images attach to one reflection. Add a
   provider-blind `MediaProvider`; dev/fake uses private local files and an
   authenticated scoped read route. The production-shaped adapter is a seam
   only. Validate MIME, byte cap, checksum, count, and bound ownership server
   side; client input never carries `userId`. No web video support.
5. **Visual surfaces.**
   - Today becomes a full-bleed time-of-day hero containing title/date/earned
     stats/profile, fading into canvas. Every pending card has matched registry
     art; right swipe = Done, left = Skip, with visible keyboard/44px fallback.
   - Journey becomes a reverse-chronological day timeline with a cinematic
     cover and four equal tiles: wellness, plan progress, image gallery, and
     journal/reflection. Empty tiles are intentional, never seeded fiction.
   - Stats and all four lenses gain token/scrimmed scene bands or summary art,
     never art inside ledger/form/dense metric zones.
   - Capture is launched from a white pencil FAB. Its sheet holds text/photo/
     PTT, hint-only chips, last-activity line, and a token-driven Web Audio
     analyser orb (idle/listening/thinking + reduced-motion fallback). It still
     enters the existing transcript-confirmed F3 path.
   - Fix Tools' external clock snapshot so it remains referentially stable
     between subscription notifications.
6. **Proof.** Add focused schema/repository/media/Journey/Today/Tools tests.
   Run the validation set in `.codex/plan.md`; produce D-041 screenshots at
   Bone light/dark mobile + desktop and only targeted Ember/Moss risk samples.

## Out of scope

Video, TTS, reminders/thought persistence, real storage credentials, Supabase
implementation, auth/billing, a new coach domain, and raw-asset changes.
