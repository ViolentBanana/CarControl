# Q60S Control Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype-like control page with a compact red-and-black vehicle remote layout that matches the approved reference while preserving all BLE behavior.

**Architecture:** Keep controller state and BLE services unchanged. Refine the three existing presentation components and compose them in `control.vue`; the page remains responsible for layout while each component owns its own visual and interaction states.

**Tech Stack:** Vue 3, uni-app 5.15, scoped CSS, Vitest, HBuilderX Android CLI.

## Global Constraints

- Preserve lock, unlock, trunk, retry, logs, deep-link, BLE scanning, and specified-device safety behavior.
- Disabled controls retain the complete red-and-black visual hierarchy but cannot emit commands.
- Continue reserving `--status-bar-height` and `env(safe-area-inset-bottom)`.
- Minimum touch targets are 48dp on Android and 44pt on iOS.
- Do not add dependencies or change the BLE/domain layers.

---

### Task 1: Lock the approved visual structure into tests

**Files:**
- Modify: `CarControlUniApp/tests/ui-contract.test.js`

**Interfaces:**
- Consumes: Vue component source files through the existing `source(relativePath)` helper.
- Produces: Contract coverage for the remote shell, primary lock control, connection guidance, and native safe areas.

- [ ] **Step 1: Write the failing structure test**

```js
it('uses the compact red-black remote composition', () => {
  const page = source('pages/control/control.vue')
  const button = source('components/VehicleControlButton.vue')

  expect(page).toContain('remote-console')
  expect(page).toContain('primary-lock')
  expect(page).toContain('连接 RM3 后可操作')
  expect(button).toContain('control-button--secondary')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run tests/ui-contract.test.js`

Expected: FAIL because `remote-console` is absent.

- [ ] **Step 3: Keep the test failure as the implementation target**

No production change occurs in this task. The next task introduces exactly the selectors and copy asserted above.

---

### Task 2: Recompose the header, vehicle stage, and controls

**Files:**
- Modify: `CarControlUniApp/src/pages/control/control.vue`
- Modify: `CarControlUniApp/src/components/ConnectionHeader.vue`
- Modify: `CarControlUniApp/src/components/VehicleHero.vue`
- Modify: `CarControlUniApp/src/components/VehicleControlButton.vue`
- Test: `CarControlUniApp/tests/ui-contract.test.js`

**Interfaces:**
- Consumes: Existing `ready`, `disconnected`, `busy`, `command`, `status`, `showRetry`, and `trunkOpen` props.
- Produces: Existing `command`, `retry`, and `openLogs` events without signature changes.

- [ ] **Step 1: Build the controller composition in `control.vue`**

Replace the flat three-button dock with a named remote shell while retaining the original bindings:

```vue
<view class="remote-zone">
  <text v-if="!ready" class="connection-hint">连接 RM3 后可操作</text>
  <view class="remote-console" :class="{ 'is-disabled': !ready }">
    <VehicleControlButton class="side-control side-control--left" secondary :command="VehicleCommand.unlock" :enabled="ready" :busy="isBusy('unlock')" @command="sendCommand" />
    <view class="primary-lock">
      <VehicleControlButton primary :command="VehicleCommand.lock" :enabled="ready" :busy="isBusy('lock')" @command="sendCommand" />
    </view>
    <VehicleControlButton class="side-control side-control--right" secondary :command="VehicleCommand.trunk" :enabled="ready" :busy="isBusy('trunk')" @command="sendCommand" />
  </view>
</view>
```

Use CSS to make `.content` a bounded full-height column, `.remote-zone` compact, and `.remote-console` a 300px-wide composition with a 106px central vertical red/graphite body and 60px side buttons. On screens below 700px height, reduce vehicle height and gaps without reducing touch targets.

- [ ] **Step 2: Reduce and clarify the header**

Keep the title, device badge, status, retry, and logs events. Style the log control as a 48px circular icon-like button, reduce the title row's visual height, and keep the status on one calm secondary line.

- [ ] **Step 3: Make the vehicle the visual anchor**

Set the normal vehicle stage to approximately `clamp(280px, 43vh, 430px)` and the artwork to `min(72vw, 290px)` wide. Keep disconnected artwork at high enough contrast (`opacity` no lower than `.72`) and retain ready/trunk feedback glows behind the image.

- [ ] **Step 4: Implement distinct primary and secondary button surfaces**

Add the optional `secondary` prop and modifier class without changing command behavior:

```js
secondary: { type: Boolean, default: false }
```

```vue
:class="{ primary, secondary, enabled, busy, 'control-button--secondary': secondary }"
```

Primary remains red and prominent even while disabled; disabled state lowers label/icon contrast without applying whole-control opacity. Secondary buttons use graphite surfaces, 60px circles, consistent 48px minimum targets, and the same 160ms press feedback.

- [ ] **Step 5: Run focused and full verification**

Run: `npm test -- --run tests/ui-contract.test.js`

Expected: all UI contract tests PASS.

Run: `npm test -- --run && npm run build:app`

Expected: all tests PASS and uni-app reports `DONE Build complete.`

- [ ] **Step 6: Sync to the connected Android phone and inspect**

Run:

```bash
'/Applications/HBuilderX.app/Contents/MacOS/cli' launch app-android \
  --project '/Users/mooyan/Documents/idea_project/Codex/CarControl/.worktrees/uniapp-multiplatform/CarControlUniApp' \
  --deviceId 3B165N0034G00000 \
  --playground standard
```

Expected: compile, file sync, and app launch all succeed. Capture an ADB screenshot and verify status-bar clearance, vehicle prominence, compact control composition, and bottom navigation clearance.

- [ ] **Step 7: Commit the verified implementation**

```bash
git add CarControlUniApp/src/pages/control/control.vue \
  CarControlUniApp/src/components/ConnectionHeader.vue \
  CarControlUniApp/src/components/VehicleHero.vue \
  CarControlUniApp/src/components/VehicleControlButton.vue \
  CarControlUniApp/tests/ui-contract.test.js \
  docs/superpowers/plans/2026-07-20-control-screen-redesign.md
git commit -m "feat: redesign vehicle control screen"
```
