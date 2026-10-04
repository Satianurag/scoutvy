# Scoutvy — Focus

## Brief
Self-authored from the user's established brief; no new product assumptions. Scoutvy is a general bounty app: people post requirements and funded rewards; scouts find online or on-location work, submit evidence, and receive approved rewards. The first ten seconds are finding a task or posting one. Feel: clear, assured, responsive. Existing name, mark, Phantom neutral dark palette, wallet authentication, Vercel/Neon API and escrow stay. Deliverable: rendered explorations and a native Expo redesign across the route inventory. No generated imagery or paid services needed.

## Current app
The original native screenshots in `../../artifacts/ui-consistency/` are the before evidence. The before render embeds the real Explore capture. Tells: uniform headings, excessive identical rounded containers, small all-caps labels, central plus among unlabelled tabs, isolated generic empty-state icon. The onboarding carousel is an explicit user preference: keep it, despite the skill's default objection.

### Keep / lose / unknown contract
- [x] Keep every route in `inventory.json`, all current back/help/retry actions and protected session guards.
- [x] Keep discovery, Online/Nearby, search, token/radius/sort filters, real map, refresh and empty/error states.
- [x] Keep posting details, location, token, amount, duration, review, escrow approval and durable recovery.
- [x] Keep acceptance, target, camera, photo review, written/link proof, submission, review, approval, rejection, dispute, cancellation and real receipts.
- [x] Keep wallet assets, actual balances, receive QR/copy, token detail and explorer links.
- [x] Keep Activity filters/paging, My bounties, reporting/blocking, all settings, data deletion, verification and push preferences.
- [x] Keep colorful original intro art, native swipe/skip/replay, connect and username.
- Lose arbitrary type sizes, repetitive icon tiles, low hierarchy between task and token, decorative load animations.
- Unknown: physical-device camera/GPS and motion feel; no invented successful results.

### Explicit navigation decision
Retain four destinations: Explore, Wallet, Activity, Profile. Add readable labels. Move the existing central Post action into the Explore header; existing empty-state posting and route remain. No name, icon, balance meaning or feature removal. The user delegated design decisions; no approval gate is needed.

## Three concepts
1. **Focus:** Scoutvy is a pocket viewfinder for open work. Object family; neutral dark; widened Archivo display; lavender actions; geometric focus brackets and inset rails. Best fit for finding and defining a task while keeping the brand.
2. **Field guide:** Scoutvy is an index of useful work. Printed family; cool white; New York serif; teal actions; numbered editorial rules. A comparison study only: light theme conflicts with the established brand.
3. **Signal:** Scoutvy is a public meeting point. Place family; saturated orange ground; SF Rounded; blue actions; large color/material fields. Distinct but too loud for escrow and repeated use.

## History
Current Scoutvy assessed as media / dark / grotesque / violet / colour-material. Focus differs in source, type and richness. Existing Still row is place / colour-field / rounded / blue / shape; Focus differs in four columns. Brand colors override generic palette rotation. Light alternatives remain research, not a new app preference.

## Tokens
Dark: ground #111111, raised #222222, raised-high #2A2A2A, ink #FFFFFF, ink-2 #B3B3B3, ink-3 #999999, rule #383838, accent #AB9FF3, on-accent #121022, positive #00C088, negative #FF756D. Light comparison: #F5F7F6, #FFFFFF, #182624, #536360, #0A7469; not shipped as an unsupported theme toggle.
Type: Scoutvy Display (Archivo wght700 wdth112, renamed static OFL instance) for screen titles and hero quantities; existing Inter Display for controls and reading. Inter is retained deliberately for readable currency figures, existing glyph coverage and a stable Android/iOS baseline; SF assets are not bundled on Android. Scale 11 / 13 / 15 / 17 / 22 / 34 / 56; display tracking -1, text tracking 0. Native safe areas and text scaling remain enabled.
Margins 20; space 4/8/12/16/20/24/32/48; radii 12 fields, 20 groups, 28 navigation, capsule primary actions. Use the shared tokens rather than per-screen guesses.

## Richness
Original open-corner focus frame, with two inset planes and one lavender focal mark; no map-like fake geography. This is a brand illustration, never task evidence. Actual maps, coin marks, existing SVG onboarding and profile identities carry the rest. Flat task content separated by space and rules; containers reserved for actionable objects and settings.

## Signature storyboard
Trigger: switch Online / Nearby. At 0 ms, the focus selection rests under the current label; at ~120 ms the solid inset rail moves toward the other mode; at ~320 ms it settles with a damped spring. One selection haptic. Data comes from the existing query and permission states, never the animation. Reduced motion snaps selection immediately. No repeated ambient loops or fake progress.

## Category default refused
Do not turn work discovery into a wallet dashboard, rank tasks by fabricated popularity, add three stat tiles, or use a purple gradient. Phantom provides the neutral color hierarchy, not Scoutvy's information architecture. Mobbin Phantom references: https://mobbin.com/screens/56ce0e29-049e-4549-9cb0-ea23e0baca73 and https://mobbin.com/screens/c8f09680-22fc-48f4-9788-925b8b22cee5. Their actual images were inspected: neutral surfaces, restrained lavender controls, strong balance hierarchy.

## Content
Exact existing route labels are captured in inventory.json before layout work. Dynamic wallet, reward, title, instructions, dates and permissions keep their current API sources. Mockups use only observed states: empty Explore, 18 USDC, the already-paid 1 USDC bounty, BraveScout1056, and blank posting fields. They never imply an open bounty or completion that did not occur.

## Verification contract
Checked keep items mean the routes, data sources and handlers are retained in source, not that every possible state was transacted again. `inventory.json` records per-route visual coverage and gaps. No server, escrow, session, wallet-operation or recovery-storage logic was changed. Native evidence is in `../../artifacts/focus-native/`. The final native implementation retains existing grouped Profile settings and original illustrations; HTML screens are direction studies rather than exact native screenshots.

## Documentation compatibility
Context7 was used for Expo fonts and Reanimated springs/reduced motion, and React Native useWindowDimensions. Installed versions: Expo 57.0.26, React Native 0.86.3, Reanimated 4.5.1. Expo 57 font documentation checked. React Native Context7 returned current 0.87 docs; the used hook was also verified against the installed 0.86.3 declaration and implementation. No dependency upgrades.

## Final native refinement
Compact reward entry shares caption space with validation so all 48pt keypad targets remain available at 320dp / 130% type. Activity filters stay on one horizontal line; work type says Online consistently; paid receipts use semantic green and sentence-case metadata. Buttons retain existing navigation/actions, while state selection and press feedback respect reduced motion. Android release build, lint and typecheck passed. The final critique remains 8/12 criteria at 4+, below the skill’s 9/12 threshold; see CRITIQUE.md for scores and the supplementary bottom-scroll scan limitations.

## Completion refinement

App Designer was re-invoked from the user’s existing brief. Focus remains the chosen direction; no further theme replacement or new product assumptions. A shared KeyboardForm keeps actions in the scrollable keyboard viewport. UsernameFeedback separates availability checks from saves, supports real retry and wrapping, and is reused for creation/editing. Header hit areas, map action shape, labels, status wrapping, token detail hierarchy and reduced-motion image presentation now use the same system. All backend/session/escrow modules remain unchanged.

Additional Mobbin Phantom references visually inspected for token sheets and control hierarchy: https://mobbin.com/screens/8b5b5d4b-f629-4ac2-9d24-52e1e07cdb8b , https://mobbin.com/screens/98de6d3d-23ed-4b27-9ed4-9f1d8ab016b5 , https://mobbin.com/screens/192ffc0c-8748-40bb-bd2b-92699c24d3cc , https://mobbin.com/screens/d1e9b056-98fc-4a66-a090-60e46c10304a , https://mobbin.com/screens/c250ba7e-3599-4711-9f11-8db5320038a5 . Context7 React Native keyboard/accessibility documentation and installed0.86.3 source were checked; Expo57 documentation and llms.txt were read. No dependency upgrades.

Final completion screenshots: `shots/completion-sheet.png`. Specific runtime coverage, motion-recording limits and fresh-wallet dependency are recorded in `verification.json`.
