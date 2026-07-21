# Run Sarthi native on an iPhone

This guide runs the Expo / React Native app from the isolated mobile worktree:

```text
/Users/satviksawhney/Downloads/sarthi-mobile
```

The Expo project itself is `mobile/`. Do not run mobile commands from the web
repository or from the top-level Sarthi checkout.

## Choose the correct iPhone route

Use an **iOS development build**. It is a signed copy of Sarthi that contains
Expo's developer tooling and loads the JavaScript bundle from your computer.
This is the supported route for this SDK 57 application and its native modules
(`expo-sqlite`, `expo-audio`, secure storage, notifications).

Do **not** use Expo Go for this app. Expo Go on physical iPhone cannot load the
SDK 57 project during the current SDK transition. Expo describes development
builds as the intended route for production-grade apps:

- [Expo: development build introduction](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo: iPhone development-build setup](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&mode=development-build&platform=ios)

The first installation is an iOS build. Afterwards, ordinary TypeScript/UI
changes are rendered on the phone through Fast Refresh; rebuild only when a
native dependency, app config, entitlement, or plugin changes.

## What you need

1. An iPhone on iOS 16 or newer, with **Developer Mode** enabled.
2. An active Apple Developer Program membership to create/install an EAS iPhone
   development build.
3. An Expo account.
4. Node 22+ and pnpm installed on the development computer.
5. Either the phone and computer on the same network, or access to Expo Tunnel.

The app can be rendered and tested with the deterministic fake stack. Gemini,
Supabase, and a server are not required for the first phone run.

## 1. Start from the isolated branch

```bash
cd /Users/satviksawhney/Downloads/sarthi-mobile
git branch --show-current
# Expected: mobile/expo-ios

cd mobile
pnpm install
pnpm check
```

`pnpm check` must pass before creating a device build. It runs TypeScript,
mobile token enforcement, and focused F3/repository/sync tests.

## 2. Give iOS an owned bundle identifier

`mobile/app.json` currently has the placeholder identifier:

```json
"ios": { "bundleIdentifier": "com.sarthi.mobile" }
```

Before an EAS device build, change it to an identifier owned by your Apple
Developer team, for example `com.yourcompany.sarthi`. This identifier must be
unique in Apple's developer portal and must stay stable once TestFlight users
install the app.

## 3. Add the development-build client and EAS configuration

Run these commands from `sarthi-mobile/mobile`:

```bash
npx expo install expo-dev-client
npm install --global eas-cli
eas login
eas build:configure
```

`eas build:configure` creates `eas.json`. Keep a device development profile;
the minimal shape is:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

Commit the resulting `mobile/package.json`, `mobile/pnpm-lock.yaml`, and
`mobile/eas.json` on `mobile/expo-ios`. Never place them in the web app.

## 4. Register your iPhone and build it in the cloud

First-time device registration and build:

```bash
eas device:create
eas build --platform ios --profile development
```

EAS prompts for the Apple team, signing credentials, and device registration.
When the build succeeds, open the EAS install link/QR code on the iPhone and
install the Sarthi development build. Then enable Developer Mode when iOS asks:

```text
Settings → Privacy & Security → Developer Mode → restart → Turn On
```

The official EAS guide covers the same device-build and installation flow:

- [Create an iOS device development build](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)

## 5. Render Sarthi on the phone

Back in `sarthi-mobile/mobile`, start the JavaScript server:

```bash
npx expo start --dev-client --tunnel
```

`--tunnel` is the most reliable first run because it works when the phone and
computer are not on the same LAN. Once it works, `npx expo start --dev-client`
is faster on a shared, VPN-free local network.

Open the installed **Sarthi** app on the phone. From its development launcher,
select the server shown by the command. If needed, scan the terminal QR code
with the phone camera and choose **Open in Sarthi**.

You should see the native local-first shell. Saving a TypeScript/UI change in
`mobile/src/` should refresh the page without reinstalling the app.

## 6. First on-device acceptance check — keyless F3

No environment variables are necessary for this check.

1. Open Sarthi and tap the global capture affordance.
2. Hold the voice control, release it, and confirm the fake transcript.
3. Wait for the deterministic fake parse to show the proposal deck.
4. Confirm that explicit, high-confidence entries are auto-filed only where
   shown, while estimated/unknown/photo items remain review cards.
5. Accept one Health proposal; verify the Today/Health surface says it came
   from capture and XP changes only after the accepted typed write.
6. Use Undo within five minutes; verify the typed entry and XP effect revert.
7. Force-close and reopen Sarthi; the accepted local SQLite entry must still be
   present.

For the M0 seam check, open the diagnostic route in the development build. It
renders the canonical fake `CaptureDraft` directly from shared `core/` and
`providers/`, with no network call or secret.

## Optional: live Supabase and server-backed capture

The fake path is deliberate and should pass before enabling live providers. To
test live auth/sync/server capture, supply only public client configuration in
your shell or an uncommitted `mobile/.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
EXPO_PUBLIC_API_BASE_URL=https://<your-api-host>
```

Restart Metro with `--clear` after changing public environment variables:

```bash
npx expo start --dev-client --tunnel --clear
```

Never put a Gemini key, Supabase service-role key, or any server secret in
`EXPO_PUBLIC_*`. The mobile app sends a Supabase session bearer to the narrow
capture API; the server owns live Gemini/voice credentials. SQLite remains the
local source of truth while offline.

## Local Xcode alternative

If full Xcode is installed, the phone is connected by USB, trusted, and
Developer Mode is enabled, a local native build is possible:

```bash
cd /Users/satviksawhney/Downloads/sarthi-mobile/mobile
npx expo run:ios --device
```

Select the connected iPhone and the correct Apple team. This machine currently
has only Xcode Command Line Tools, so use the EAS route until full Xcode is
installed. Expo documents the `--device` local-build option in its
[development-build migration guide](https://docs.expo.dev/develop/development-builds/expo-go-to-dev-build/).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| QR opens Expo Go | Use the installed Sarthi development build; do not open the QR in Expo Go. |
| The app cannot find Metro | Start with `npx expo start --dev-client --tunnel`; leave the terminal running and disable VPN/LAN isolation if using LAN mode. |
| EAS rejects signing | Confirm the bundle identifier is owned by the selected Apple team, then rerun `eas device:create`. |
| The installed app will not open a dev server | Enable iPhone Developer Mode, reinstall the current development build, and run `npx expo start --dev-client --clear`. |
| Microphone capture is denied | iOS Settings → Sarthi → Microphone. The fake text path can still be used while permission is denied. |
| Native config/plugin changed | Re-run `eas build --platform ios --profile development`, install the new build, then restart Metro. |
| JS/type issue | Run `pnpm check`; for bundle diagnosis run `npx expo export --clear --platform ios`. |

## When this becomes TestFlight

Keep development builds for iteration. For TestFlight, create a separate
production profile in `eas.json`, set the final owned bundle identifier,
validate the server-backed flow after the keyless F3 gate, and submit the
signed release through App Store Connect. Do not treat an Expo Go session as a
TestFlight-quality native verification.
