# Sarthi Native iOS — M0–M5 build plan

## Constraints held throughout

- This worktree owns only `mobile/`; shared `core/`, `data/schema`, and `providers/` are read-only contracts.
- Device SQLite is authoritative; Supabase is a sync target.
- The keyless fake stack is the initial path. Estimated proposals remain pending until accepted, and all persisted units are integers.
- React Native components consume semantic theme tokens only. Amber remains reserved for earned XP, streak, and level states.

## M0 — prove the seam

1. Scaffold Expo SDK 57 with Expo Router (RN 0.86; Expo-managed Hermes).
2. Configure TypeScript/Babel/Metro aliases and watch folders for `@core/*`, `@contracts`, and `@schema/*` without changing shared source.
3. Add the native fake LLM binding and an on-device diagnostic route that calls `parseDump` with the canonical utterance and renders the validated `CaptureDraft`.
4. Use `expo-sqlite` + Drizzle as the device database direction; use stable NativeWind v4 only if needed after the theme seam is stable. AI SDK provider calls stay server-side; mobile's online path will be a fetch adapter.
5. Gate: run the iOS simulator keylessly and visibly render the canonical draft.

## M1 — local source of truth and themes

1. Implement the SQLite repository adapter for the existing repository ports, scoped by local/future Supabase user ID.
2. Implement the six token themes, provider, persistence, accessibility-aware motion preference, and token-only checks.
3. Gate: create a typed Health record locally and read it via the shared domain read-model.

## M2 — F3 capture loop

1. Build the native capture sheet: text first, PTT/transcript confirmation, fake parse, explicit strip, estimate swipe deck, accept/discard/edit/why, typed commit, XP, undo.
2. Add gesture, haptic, reduced-motion, and accessibility button equivalents.
3. Gate: F3 completes on iOS simulator, keyless, using Health; then exercise the online Gemini adapter separately when configured.

## M3 — product surface

1. Build Today/arc, all four lenses, Journey, Stats, Tools, Settings, onboarding, and their offline read models.
2. Use native-safe timers and stable screen contracts; defer any screen currently changing on web only until its data contract is stable.
3. Gate: all screens function from local data at 390pt iPhone width with screenshot verification.

## M4 — durable sync

1. Add per-user SQLite mutation queue, idempotency keys, reconnection replay, inbound watermarks, and sign-out isolation/purge.
2. Gate: offline capture reaches Supabase exactly once after reconnect; cross-account replay is refused.

## M5 — production finish

1. Bind Supabase auth using SecureStore, add opt-in notifications, safe-area/haptics/motion polish, app icon and splash.
2. Produce a TestFlight-ready development/release build configuration.
3. Gate: full offline and online capture loop installs and runs on an iPhone/TestFlight build.

## M0 decisions recorded

- Expo SDK 57 / Expo Router 57 / React Native 0.86. Hermes is supplied by Expo/RN; do not add an independent Hermes package.
- `expo-sqlite` + `drizzle-orm/expo-sqlite` for the local DB.
- NativeWind v4 may be used for token class ergonomics, but token values live in the typed theme object and no component gets raw visual literals.
- AI SDK calls remain on server routes for online use. The M0/F3 fake adapter runs entirely on the device with no keys.
