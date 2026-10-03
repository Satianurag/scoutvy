This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Scoutvy architecture and user constraints

- Product direction updated explicitly by the user on 2026-10-03: Scoutvy is a general bounty app for online and on-location tasks. Posters define their own requirements and choose supported submission methods. Do not force every bounty into photography or physical-world verification; the earlier downloaded PRD is superseded on this point. Preserve existing photo/GPS bounties while adding real written submissions without invented location or media metadata.
- Visual direction: Phantom's neutral dark hierarchy, not purple-tinted surfaces everywhere. Reference samples use #111111 background, #222222 cards, #2A2A2A raised surfaces; lavender accents mark actions/selection, with semantic success/warning/destructive colors. Use shared theme tokens.
- Onboarding refinement: colorful original SVG artwork belongs inside the existing dark design system; do not reinterpret colorful as a different app theme. Native intro uses shared buttons/fonts, optional swipe scenes, remembered skip and Help replay. Keep sign-in fee/private-key rows out of the wallet connection screen; signing details belong behind Help. The earlier light browser concept is superseded by the native implementation. Preserve authentication, session recovery and existing device data during visual review.

- Onboarding completion comes from the authenticated profile username, not a device-local finished flag. After username creation, Expo Router protected routes take the user into Explore. Keep legacy ready/location/tier links as redirects. UI consistency evidence and explicitly unverified states are recorded in design/ui-consistency/review.json.

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
- Android app links for scoutvy.vercel.app were verified on 2026-10-03 against the installed development signing certificate. Production signing needs its own certificate fingerprint in assetlinks.json. A verified association is not proof that Solflare's reputation/security warning is cleared; the latest wallet handoff was interrupted by Solflare's backup prompt.
- Live verification on 2026-10-03: real public-API wallet sign-in, escrow funding, cancellation/full refund, acceptance, written submission, protection and full payout passed with separate Devnet wallets. The original Android bounty `a9fa06ae-0dab-40a4-b338-f3a9d4333d68` also paid successfully through Solflare: signature `3dVDccxoqeK8EKWxkDiS9bFsavbAJ82KR1J4JJBwL8C96TZ7VbmMippR3NfkUyyMK1sghy6KRnSMmw4B67sBbbmR`, finalized slot 507024863, accepted scout balance 0 → 1 Devnet USDC. Scoutvy resumed with Reward paid and its Activity event. Signatures, balances and screenshots are in the sibling `scoutvy-ui-audit/refinement/evidence.json`. Business-event push delivery and tap-to-review were verified. Recheck chain before retrying any payment.
- Android UID 10230 lost network access in the background while Solflare was foreground. Prepare the confirmed blockhash immediately before wallet handoff, under the shared operation lock; keep the pre-sign age checks, durable lifetime write, and known-signature preservation. Do not reintroduce an RPC request inside the wallet session or bypass Android background policy. Unknown attempts require chain reconciliation before another approval. Offline cold start and retry were verified without losing the saved sign-in.
- Devnet escrow upgrade on 2026-10-03: the user supplied the matching authority, stored privately in ignored `credentials/scoutvy-devnet-authority.json` (owner-only permissions). Public authority `31fSC7cHE1EyGkDLNCshWgfFgzzBEc4yCTfkLGfyHJq2` and program `BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn` are unchanged. Upgrade signature `27pXSkwW9qHvttNYTBJR8q7TgxYj8T4BoYMuubG7pEJ3iZgGVQJGyUYrmHEzmdjj18cozg1Q7i2SUeeD5cDGj6MJ` finalized in slot 507034240. Deployed code matches local SHA-256 `847eae1a92ad7fe96a242c6111ceeac8f8724b6835fe578278deb0458978bceb`; trailing allocation bytes are zero. Claims can now run until the bounty deadline; existing active claims keep their prior expiry. Local full settlement checks passed. Rollback binary/metadata are under ignored `escrow/target/upgrade-backup/`. Use an explicit buffer and CLI TPU transport for uploads; bulk public-RPC uploads hit rate limits. Keep `escrow/` excluded from Vercel uploads.
- The production API serving Devnet has `SCOUTVY_LONG_CLAIMS_ENABLED=true` after that verified upgrade. Live bounty `d3b51147-e9f1-46e8-821a-142d4cab3f7d` accepted a 21,484-second written claim, released it, and refunded the full 1 USDC; all transactions finalized and both previous paid receipts remained accessible. Evidence is under `long_claim_upgrade_validation` in the sibling audit JSON. Android release build 9 displays the real written-bounty deadline in the shared confirmation; photo submissions retain the API's up-to-one-hour window. Never claim physical photo/GPS testing from these written-bounty checks.
- The local Android release APK uses the existing debug signing key for device verification, not a store production key. `app:assembleRelease` succeeded with two workers and a 1024m Gradle metaspace limit. Install updates with data preserved; never wipe the emulator/wallet to solve a handoff issue. Wallet failures log only sanitized stage/code/category, never raw SDK authorization logs.
- Report moderation uses the existing database and an operator-only CLI: from server/, run `npm run moderate -- list`, then `npm run moderate -- review <report-id> <dismiss|hide|restore> "reason"` with the authorized DATABASE_URL in the process environment. Decisions are audited; hiding removes discovery/new acceptance but preserves existing participants' proof and settlement access. Never expose this CLI's operations through an unauthenticated app endpoint or change escrow state as a moderation action.

- Account deletion now removes the real users row, username, sessions, SGT links, push registrations/outbox, block preferences and data requests. Reporter identity/text is cleared while moderation audit remains. Shared bounties, claims, submissions and transaction receipts remain linked by wallet address, including unfinished escrows; deletion never cancels or settles them. Explain this before confirmation. Financial foreign keys are replaced by account-existence triggers using FOR SHARE; the atomic deletion function uses FOR UPDATE. Apply server/db/account-deletion.sql after the base/UI migrations. Never re-add cascading or restrictive user FKs to financial history.
- Live account deletion on 2026-10-03 used only the dedicated integration wallet 3Tmb8gW1G6oAmvCf6ZFFD57DsbRvwFhCbA5x8j7hK7hW: two old sessions revoked, a new sign-in had no username, both existing paid receipts and evidence hashes unchanged. The user's Android wallet/account was not deleted. Evidence: sibling scoutvy-ui-audit/refinement/account-deletion.json. Local draft cleanup serializes writes and invalidates old background saves; financial transaction recovery markers are intentionally kept for reconciliation.
- My Bounties gives terminal chain-backed status precedence over stale proof status. A saved proof without attestation is Confirmation pending, not In review. Keep this distinction in future UI changes.

- Android signing/branding on 2026-10-03: use `npm run android:device-build` for the existing debug-signed emulator, preserving its data; use `npm run android:distribution-build` for separately signed ARM64 Devnet APK/AAB candidates. Both builds passed, APK/AAB upload certificates matched, and release manifest excludes overlay/legacy storage permissions. Signing is generated through `plugins/with-scoutvy-android.js`, never by persistent edits to generated android/. Direct release builds cannot silently use debug signing unless explicitly in device mode. The private upload keystore and root credentials.json are ignored, owner-only, and must be backed up together outside Git; no external backup or EAS-hosted keystore is claimed. Public upload SHA-256 is D0:B6:2E:62:10:9B:98:13:F8:4A:F5:21:A3:22:4F:4B:31:29:F2:03:E3:66:47:F5:0D:E7:5B:86:E9:B9:21:9E. Keep it distinct from the escrow authority. Asset links retain the current debug certificate for Devnet verification; replace development associations with the actual Play app-signing certificate before public distribution. The signed candidate has not been installed over the existing app or submitted to a store.
- Launcher and notification icons now use Scoutvy's existing mark; wallet identity icon is served at https://scoutvy.vercel.app/scoutvy-icon.png. Domain association is verified for the installed emulator app; Solflare reputation clearance remains unverified. EAS profiles read local Android credentials; the production profile name does not switch the client off Devnet. iOS icon configuration was updated but has not been compiled or release-verified on this host.

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
