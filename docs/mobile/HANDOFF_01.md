# Native iOS handoff 01 — M0–M5 foundation

**Worktree:** `/Users/satviksawhney/Downloads/sarthi-mobile`
**Branch:** `mobile/expo-ios`

## Completed slices

- **M0:** Expo SDK 57 / React Native 0.86 / React 19.2.3 / Expo Router 57 is
  independently locked under `mobile/`. Metro watches the read-only parent
  source and the TypeScript aliases remain `@core/*`, `@schema/*`,
  `@contracts`, and `@providers/*`. Metro rewrites them to the local
  `sarthi -> ..` link only while bundling, which lets Hermes crawl the source
  without copying or modifying it. `node:crypto` maps to the Expo Crypto shim.
  The diagnostic route imports `parseDump`, `CaptureDraft`, `FakeLlmGateway`,
  and the canonical fake dump, then renders the validated draft with explicit
  and pending proposals. `npx expo export --clear --platform ios` produced a
  Hermes `.hbc` bundle successfully, keyless.
- **M1:** `expo-sqlite` is the local source of truth with shared SQLite schema
  contracts, applied migrations, `local-dev` identity, tenant-scoped typed
  repository writes, migration readiness, durable meta/outbox state, and
  versioned rereads. Theme persistence, six themes, typed StyleSheet tokens,
  dynamic type, reduced motion, and safe-area primitives are in the app.
- **M2:** the native capture sheet supports text, hold-to-record fake voice,
  gallery photo selection, transcript confirmation, parse/review states,
  explicit card actions, typed commit fan-out, XP and undo. Fake voice and
  vision are deterministic and never send audio or an API key. Estimates,
  corrections, low-confidence, unknown and photo proposals remain pending.
- **M3:** local-first Router shell, global capture affordance, Today tabs and
  domain surfaces, journey/coach/stats/tools/settings, local fake auth, and
  Focus/Meditation typed timer commits are wired. Afford-it and Workout Counter
  remain honest coming-soon surfaces.
- **M4:** confirmed local transactions enqueue only typed row snapshots in a
  durable user-partitioned queue. The bridge queues after commit, transport
  upserts by stable row IDs, retries non-definitive failures, tracks watermarks,
  applies LWW inbound rows, and purges only the signed-out partition. Pending
  estimate cards are never queued.
- **M5:** Supabase email/password wiring is optional-env activated, with an
  AES-encrypted Expo SQLite session store, SecureStore device-only key,
  AppState refresh and `sarthi://auth/callback`. The app sends only session
  bearer tokens to the narrow server capture adapter; no Gemini/service key is
  bundled. Local daily/weekly notification infrastructure is installed at
  startup. `expo-audio` M4A uses `audio/mp4` for live voice.

## Resolved M0 decisions

1. **Live AI:** server-side bearer-auth capture endpoints; fake remains the
   zero-secret default.
2. **Database:** `expo-sqlite` with Drizzle’s Expo driver and mobile-owned SQL
   migration ledger.
3. **Styling:** typed React Native `StyleSheet` tokens and primitives; no
   NativeWind.
4. **Recording:** `expo-audio` M4A/AAC, carried as `audio/mp4`; no deprecated
   `expo-av` recorder.

## Verification evidence

- `mobile`: `pnpm check` — passed (TypeScript, token enforcement, 16 focused
  tests covering F3 safety, repository scope/rollback, migrations, durable sync,
  lost acknowledgements, retries and two-user isolation).
- `mobile`: iOS Hermes export — passed. The resulting `.hbc` was written to
  `/private/tmp/sarthi-expo-final`.
- Root contracts touched by the bearer/audio seam: `pnpm test:core-boundary`,
  `pnpm test:providers`, and `pnpm test:capture` passed. The root canonical
  `pnpm check` cannot run in this host: its Node 26 nested-pnpm wrapper fails
  before the scripts, and root TypeScript currently includes `mobile/` without
  its native aliases. No root configuration was changed to hide that issue.

## External setup / next operator

- Install full Xcode and an iOS simulator. This host has Command Line Tools
  only, so an on-device/simulator F3 recording and the required 390-point
  screenshots could not be captured here. Run `pnpm ios` from `mobile/`, visit
  the diagnostic route, then capture each F3 state under
  `mobile/.verify/screens/`.
- For production adapters set `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`), and
  `EXPO_PUBLIC_API_BASE_URL`. Configure the server’s Supabase JWT verifier and
  live voice backend separately; fake mode is unchanged without them.
- Before TestFlight select the owned bundle identifier and Apple team, enable
  the corresponding Supabase redirect URI, validate real Gemini only after the
  keyless simulator F3 gate, then make the release build.
