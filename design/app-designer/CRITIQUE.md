# Scoutvy Focus — independent critique

Brief self-authored from the user’s existing product and brand decisions. Critic: the same independent `design_critic` agent across all rounds. Scores are aesthetic judgments, not proof of payment correctness.

| Criterion | R1 | R2 | R3 | R4 |
|---|---:|---:|---:|---:|
| Concept on the pixel | 3 | 4 | 4 | 4 |
| Not category average | 3 | 3 | 3 | 3 |
| Not skill average | 3 | 4 | 4 | 4 |
| Hierarchy | 4 | 4 | 4 | 4 |
| Typography | 4 | 4 | 4 | 4 |
| Colour | 4 | 4 | 4 | 4 |
| Richness | 3 | 3 | 3 | 3 |
| Rhythm and space | 3 | 4 | 4 | 4 |
| Craft details | 3 | 3 | 4 | 4 |
| Native fluency | 4 | 4 | 4 | 4 |
| Signature | 2 | 3 | 3 | 3 |
| Feature test | 3 | 3 | 3 | 3 |
| Fidelity (additional) | 3 | 4 | 4 | 4 |

Round 1: 4/12 at least 4. Middle animation frame omitted the selector; wallet omitted actual SOL and token alignment; posting omitted submission choice; profile flattened groups and hid lower content; focus geometry was isolated. All five corrected in round 2.

Round 2: 7/12 at least 4. Small Explore CTA collided with navigation; moving label lacked contrast; “Network fees” incorrectly described a balance; small Post had a hard clipped boundary; bottom scrolling needed evidence. All corrected in round 3. Native implementation uses a clipped duplicate label inside the animated selector so text keeps contrast throughout its movement; the overlay is configured with accessibilityElementsHidden and no-hide-descendants. UIAutomator still includes clipped visual labels; actual TalkBack traversal was not verified.

Round 3: 8/12 at least 4. No score below 3, but below the skill’s 9/12 design threshold. Critic inspected the rendered set, bottom positions, 25 native captures and six current compact captures. Remaining concrete requests: compact reward keypad, Online/Remote terminology consistency, latest Activity capture, title-case receipt/token labels, enter/erase without scrolling. These are addressed in the final native pass, to be independently rechecked in round 4.

Round 4: 8/12 at least 4; fidelity 4. Scores plateaued, with none below 3. The critic found one remaining concrete defect: the low-balance warning clipped the last keypad row at 320dp / 130% text. The final correction puts that warning in the existing caption space, preserving keypad height. New native entry/deletion captures verify the fix. Four aesthetic rounds completed; the skill’s 9/12 threshold was not reached. This is not an award-quality or pixel-perfect certification.

## Scan warnings and their disposition

- Standard storyboard has three text sizes. Intentional: the same control is repeated at three times; adding arbitrary text sizes would reduce consistency.
- Small Wallet SOL and Post submission labels are reported inside home-indicator coordinates. They are descendants of clipped scroll viewports, not painted in that area. `shots/r3-bottom` verifies that each can be scrolled fully above pinned controls.
- Pinned footer uses `data-float`; this models native fixed chrome rather than suppressing a collision in actual content. The original small Explore overlap was fixed through a real scroll viewport and bottom spacing, despite the scanner having missed it.
- Before image is an embedded native screenshot. Its DOM scan cannot audit text inside the bitmap; visual comparison is the evidence.
- The additional bottom-scroll diagnostic reports overlap FAILs on Bounty, Wallet and Profile because the scanner counts clipped scroll descendants against fixed content. Post/Profile also report safe-area warnings on clipped text; Post has a smaller visible hierarchy after its title has scrolled away. These diagnostic results are retained, not relabelled as passes. Native bottom-scroll images are the relevant visibility evidence; no clean-scan claim is made for this supplementary HTML diagnostic.
- Latest main and small mockup scans: zero FAILs. These scans apply to the HTML design studies. Android is reviewed through separate real screenshots; no claim of a native DOM scan.

## Scope limits

The restrained richness and modest selector signature remain honest 3s. Do not add decorative content or change the established brand merely to inflate a score. Full physical-device touch/haptics, iOS compilation, active camera/GPS proof and new escrow settlement were not verified in this design pass. Real existing balances, maps, history and paid receipts were used. Drafts created for review were not published.

## Completion pass after the user re-invoked App Designer

The same critic reviewed remaining source and native states, identifying five practical defects rather than restarting the four-round concept exploration: keyboard-safe forms; accurate, retryable username feedback; consistent navigation/location/filter controls; scrolling and wrapping conditional status layouts; token-sheet spacing and reduced-motion proof viewing. All five were implemented.

In the completion verification, the critic opened standard full-Gboard,320dp/font1.3 top/bottom, token-sheet and filters captures. Save is visible with standard Gboard; compact forms dismiss the keyboard on drag and reveal Save. No blocking defect was found in those captures. It then opened real offline availability-error and successful API-retry screenshots, confirming correct text, retry visibility and Save enablement. Original username was not changed. Scores remain unchanged; do not interpret this concrete-defect closure as meeting the original aesthetic threshold.

The first-user feedback margin was included in source review but could not be independently scored in a native first-user screenshot: Solflare required its recovery-phrase backup on the isolated review device. Active photo/written/dispute branches remain source-reviewed, not live-exercised in this design pass.
