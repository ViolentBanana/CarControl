# Task 2 implementation report

## Status

DONE_WITH_CONCERNS

Implementation commit: `dcf35dce77f35afc15827ce9b302b77e0f4214ae`

## Files changed

- `CarControlUniApp/src/pages/control/control.vue`
  - Replaced the flat control dock with the named `remote-zone` / `remote-console` composition.
  - Kept all existing command bindings and introduced the disabled connection hint.
  - Added the 300px remote layout, 106px graphite center body, narrow/tall/short-screen rules, and safe-area-aware bounded page column.
- `CarControlUniApp/src/components/ConnectionHeader.vue`
  - Reduced title/status hierarchy and added a 48px circular log control.
  - Retained the `retry` and `openLogs` event names and status/retry behavior.
- `CarControlUniApp/src/components/VehicleHero.vue`
  - Enlarged the normal vehicle stage and artwork, retained ready/trunk glows, and raised disconnected opacity to `.72`.
- `CarControlUniApp/src/components/VehicleControlButton.vue`
  - Added the optional `secondary` prop and `control-button--secondary` modifier.
  - Added distinct red primary and graphite secondary surfaces, 48px minimum targets, 160ms press feedback, and label/icon-only disabled contrast.
  - Added explicit disabled background overrides after device inspection exposed uni-app's native white disabled-button cascade.

The committed RED test file from `9735e80` was not modified during implementation.

Excluded user/generated paths were not staged or modified by this task: `.DS_Store` and `CarControlUniApp/.hbuilderx/`.

## Test and build results

### RED confirmation before production changes

Command:

```text
npm test -- --run tests/ui-contract.test.js
```

Result: exit 1 as expected; 1 test file ran, with 1 failed / 5 passed. The intended failure was `uses the compact red-black remote composition`, because `control.vue` did not contain `remote-console`.

### Final focused UI contract

Command:

```text
npm test -- --run tests/ui-contract.test.js
```

Result: exit 0; 1 test file passed, 6 tests passed, 0 failed. Vitest printed the existing Vite CJS API deprecation warning.

### Final full suite and app build

Command:

```text
npm test -- --run && npm run build:app
```

Result: exit 0; 6 test files passed, 21 tests passed, 0 failed. The uni-app compiler reported version 5.15 (Vue 3), followed by `DONE  Build complete.`

## Android sync and visual inspection

Command:

```text
'/Applications/HBuilderX.app/Contents/MacOS/cli' launch app-android \
  --project '/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/CarControlUniApp' \
  --deviceId 3B165N0034G00000 \
  --playground standard
```

Final result: HBuilderX 5.15 compiled successfully, connected to the phone, synchronized program files successfully, and reported `应用【CarControlUniApp】已启动`.

Screenshot: `/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/.superpowers/sdd/task-2-control-screen.png`

Screenshot details: 1272x2772 PNG, SHA-256 `42bcf0b7ecd525f1b856c99c071464f371447d1ef823bf01df129eca0e58375a`.

Visual inspection confirmed:

- custom header clears the Android status bar;
- the Q60S artwork is the dominant visual anchor and remains legible while disconnected;
- the final 112px tall-screen remote lift leaves one compact gap between vehicle and controls without clipping;
- the controller stays compact, horizontal, red/graphite, and visibly disabled without a whole-control gray overlay;
- the control group clears the Android bottom navigation area.

## Self-review

- BLE service creation, connect/retry behavior, deep-link handling, busy-state calculation, result handling, and command dispatch were not changed.
- Existing prop contracts (`ready`, `disconnected`, `busy`, `command`, `status`, `showRetry`, `trunkOpen`) remain intact; only the optional `secondary` button prop was added.
- Existing emitted event names and payloads remain intact: `command` still emits `props.command.key`, while header `retry` and `openLogs` events are unchanged.
- Disabled controls remain semantically disabled and `activate()` still guards against disabled/busy dispatch.
- Narrow screens preserve the three-control horizontal layout; short screens reduce stage/gaps without reducing touch targets; tall screens move only the remote zone upward while retaining bottom safe clearance.
- Reduced-motion handling remains present for the page and newly animated status indicator.
- `git diff --check` passed; no unrelated tracked file changes are present.

## Concerns

- The final device screenshot captures the scanning/disconnected state because an RM3 connection was not established during inspection. Ready-state contrast and trunk-open glow/artwork are retained in code and covered by existing UI/domain contracts, but those two visual states were not captured on-device in this task.
- Vitest emits the repository's pre-existing Vite Node CJS deprecation warning; it does not fail the suite.

## Fix Review

### Change

- Replaced the tall-screen `.remote-zone { transform: translateY(-112px); }` rule with `.remote-zone { min-height: 302px; }` at `min-height: 800px`.
- The extra 112px is now reserved in flex layout (`190px + 112px`) instead of being applied after layout, so a visible result banner cannot consume the auto margin and cause the remote to overlap `VehicleHero`.
- Added a UI contract assertion that requires the 302px tall-screen flow reservation and rejects a `translateY` transform on `.remote-zone`.

### RED regression confirmation

Command:

```text
npm test -- --run tests/ui-contract.test.js
```

Result: exit 1 as expected before the CSS change; 1 test file ran, with 1 failed / 6 passed. The new `reserves tall-screen remote spacing in normal flow` assertion failed because the page still used `transform: translateY(-112px)`.

### Final verification

Focused UI contract command:

```text
npm test -- --run tests/ui-contract.test.js
```

Result: exit 0; 1 test file passed, 7 tests passed, 0 failed. Vitest printed the existing Vite CJS API deprecation warning.

Full suite and App build command:

```text
npm test -- --run && npm run build:app
```

Result: exit 0; 6 test files passed, 22 tests passed, 0 failed. The uni-app compiler reported version 5.15 (Vue 3), followed by `DONE  Build complete.`

### Android sync and screenshot

Command:

```text
'/Applications/HBuilderX.app/Contents/MacOS/cli' launch app-android --project '/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/CarControlUniApp' --deviceId 3B165N0034G00000 --playground standard
```

Result: exit 0; HBuilderX 5.15 compiled successfully, synchronized the phone program files successfully, and reported `应用【CarControlUniApp】已启动`.

Capture command:

```text
adb -s 3B165N0034G00000 shell screencap -p /sdcard/car-control-remote-flow-fix.png
adb -s 3B165N0034G00000 pull /sdcard/car-control-remote-flow-fix.png .superpowers/sdd/task-2-remote-flow-fix.png
```

Screenshot: `/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/.superpowers/sdd/task-2-remote-flow-fix.png`

Screenshot details: 1272x2772 PNG, SHA-256 `c43f7bf39218a78519873c87f0744ff6419dc498483f831725df61d4c266d87a`.

Visual inspection: the tall-screen vehicle, connection hint, and horizontal remote are distinct flow blocks with clear separation and bottom gesture-area clearance. The capture remains in scanning/disconnected state and does not show a result banner; the static contract and flow reservation specifically cover the banner-growth regression.

## Final Review Fixes

### Change summary

- Separated connection presentation from command availability in `control.vue`. Both `ready` and `sending` now render the header, vehicle, remote, and hidden connection hint as connected; only `ready` enables activation.
- Kept every native command button disabled during `sending`, while only the selected command receives the `busy` class and `···` content. Connected-but-disabled controls retain connected styling instead of the disconnected icon/label dim treatment.
- Added `canActivateControl({ enabled, busy })` in `vehicle-control-state.js` and used the same predicate for `VehicleControlButton.activate()` and its native `:disabled` binding. Unit tests exercise disabled, busy, and enabled/idle activation behavior.
- Added explicit `connectionPresentation(phase)` mapping. The status dot pulses only for `scanning` and `connecting`; `discovering`, `ready`, `sending`, `failure`, `disconnected`, and `unavailable` do not pulse. `ready` and `sending` both map to connected appearance.
- Removed the discontinuous `@media (min-height: 800px)` / `min-height: 302px` remote reservation. The vehicle stage is now the flexible normal-flow row, bottom-aligns capped vehicle artwork next to the intrinsic-height remote, and shrinks when the result banner is present.
- Kept `min-height: 100vh` normal flow instead of clipping fixed-height overflow. The required target sizes remain single-screen, while unusually short/landscape viewports can scroll rather than lose access to controls.
- BLE controller/service code, command values (`MSF`, `MCF`, `MCK`), event names, and emitted command-key payloads were not changed. No dependency was added.

### TDD evidence

Initial focused RED command:

```text
npm test -- --run tests/vehicle-domain.test.js tests/ui-contract.test.js
```

Result: exit 1 as expected; 2 test files ran, with 8 failed / 10 passed. Failures covered the absent disabled/busy activation predicate, missing sending/connection presentation mapping, incorrect pulse phases, the 302px tall-screen breakpoint, and missing production bindings.

Short-viewport review RED command:

```text
npm test -- --run tests/ui-contract.test.js
```

Result: exit 1 as expected; 1 test file ran, with 1 failed / 8 passed. The new reachability contract rejected fixed `100vh` containers with hidden overflow.

Final focused command:

```text
npm test -- --run tests/vehicle-domain.test.js tests/ui-contract.test.js
```

Result: exit 0; 2 test files passed, 18 tests passed, 0 failed. Vitest printed the repository's existing Vite CJS API deprecation warning.

### Responsive layout evidence

- At an 812px iPhone viewport with representative 44px status and 34px Home Indicator safe areas, the fixed vertical budget with a visible result banner is approximately 443px: 106px safe-area-aware page padding + 96px header + 56px banner + about 185px remote. This leaves approximately 369px for the flexible vehicle stage; without the banner it leaves approximately 425px. No breakpoint or transformed element changes that flow.
- On the connected tall Android device, the vehicle artwork caps at 430px and bottom-aligns within the remaining flexible stage, keeping the car and controller adjacent while surplus height stays in the semantic vehicle stage above the artwork.
- At smaller heights, the short-screen rule keeps the 48px minimum button targets and reduces artwork/margins. If fixed chrome eventually exceeds the viewport, `min-height` normal flow expands and remains scrollable instead of clipping controls.

### Final verification

Full suite command:

```text
npm test -- --run
```

Result: exit 0; 6 test files passed, 29 tests passed, 0 failed.

App release build command:

```text
npm run build:app
```

Result: exit 0; uni-app compiler 5.15 (Vue 3) reported `DONE  Build complete.`

Android sync command:

```text
'/Applications/HBuilderX.app/Contents/MacOS/cli' launch app-android --project '/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/CarControlUniApp' --deviceId 3B165N0034G00000 --playground standard
```

Result: HBuilderX 5.15 compiled successfully, connected to device `3B165N0034G00000`, synchronized program files successfully, and reported `应用【CarControlUniApp】已启动`.

Updated screenshot: `/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/.superpowers/sdd/task-2-final-review-fixes.png`

Screenshot evidence: 1272x2772 PNG; SHA-256 `71e2d29360138bf5abc917c8ea2884b7e7e4be972d7d9f60c9a52d06b9b7a746`. Visual inspection confirms status-bar clearance, bottom gesture-area clearance, a full single-screen composition, and a compact car-to-remote relationship without the former remote-zone dead space.

`git diff --check` passed before final staging.

### Final review outcome and concerns

- Independent spec review found no remaining spec deviations.
- Independent standards review's short-viewport clipping finding was fixed and regression-tested. Its suggestions to dim all sending-disabled buttons and inline the predicate were not applied because the final-review requirements explicitly require only the current button to look busy and explicitly require a production helper shared by the guard and tests.
- The physical screenshot remains in the scanning state because no RM3 vehicle was available. Sending/ready presentation and disabled activation are covered by the shared production-state unit tests and UI binding contracts, but those connected states were not captured on-device.
- No physical iPhone was available; 812px behavior was verified from the exact normal-flow height budget above rather than on iOS hardware.
- Vitest continues to emit the pre-existing Vite Node CJS deprecation warning; it does not fail the suite.
