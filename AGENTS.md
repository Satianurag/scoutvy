This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Scoutvy architecture and user constraints

- Keep Vercel for API/business logic, Neon Postgres for application data, and Expo/React Native for the mobile client. Preserve wallet-based authentication and Solana escrow.
- Use Google/Firebase only for Android FCM push delivery through Expo Push. Do not introduce Firestore, Firebase Auth, Google hosting, or another backend without a concrete need and user agreement.
- Stay within free-tier limits. Do not enable billing, upgrade plans, or provision paid services without explicit approval. Prefer local Android builds to preserve EAS cloud-build quotas. Free-tier limits are not production reliability guarantees; report any resulting limitations.
- Use Context7 MCP for documentation and verify compatibility with installed versions. Prefer current stable, compatible releases; do not install beta releases or upgrade working dependencies solely because a newer version exists.
- Prefer already-authenticated CLIs. Vercel holds server environment configuration, including the Neon connection. Never print secrets or store them in tracked files; private push keys belong only in ignored credentials/ and the intended credential service.
- Keep design references from Mobbin, a consistent Phantom-inspired UI, real maps/data/actions, reusable components, and concise UI copy. Do not add mock success states. Keep validation focused; avoid unnecessary tests and token usage.
- Approved infrastructure IDs: EAS fake6476a/scoutvy (3e910787-15e3-4e47-8781-ac6818f04cc3); Firebase scoutvy-push-6476a; Android com.scoutvy.app; Vercel scoutvy.vercel.app. Verify current remote state before changing resources.
- Notification recovery uses an authenticated daily Vercel cron (03:00 UTC) within Hobby scheduling limits; events also attempt delivery immediately. This is a daily fallback, not a minute-level delivery guarantee. Avoid sensitive bounty titles/locations/photos in push copy.
- Google billing was disabled and Vercel was Hobby when verified on 2026-10-03. Do not assume future usage or plan state; recheck before provisioning. Commercial launch requires revisiting Vercel Hobby's non-commercial restriction.
- Neon project late-pond-56496456 (scoutvy), organization org-withered-pine-37521895, was verified on the Free plan on 2026-10-03. Neon CLI is authenticated. Vercel production Secret values cannot be pulled in plaintext; use the authorized Neon CLI when database access is needed, without logging connection strings.
- Android registration and one real Expo Push → FCM notification were verified on emulator-5554 on 2026-10-03. The daily recovery route is /api/profile?action=push-maintenance (CRON_SECRET required), sharing an existing function to stay within Vercel Hobby's 12-function limit. Device delivery verification does not imply the paid bounty/settlement happy path was exercised.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
