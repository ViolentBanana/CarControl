# CarControl uni-app Multiplatform Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vue 3 uni-app port of the completed iOS vehicle-control experience, with an Android-first BLE implementation that also compiles for iOS App and WeChat Mini Program.

**Architecture:** Keep protocol constants and connection state in pure JavaScript modules, wrap every `uni.*` BLE call behind an injected service, and coordinate scanning, connection generations, write tokens, timeouts, and UI state in one vehicle controller. The page consumes only the controller and focused presentation components, so platform differences stay below the UI.

**Tech Stack:** uni-app Vue 3/Vite, JavaScript ES modules, Vue Composition API, Vitest, uni-app BLE APIs, Node.js, HBuilderX for Android device runtime and APK packaging.

## Global Constraints

- Create the new project under `CarControlUniApp/`; do not delete or modify the SwiftUI implementation except to copy its two approved PNG assets.
- Use classic uni-app Vue 3, not uni-app x, Flutter, a third-party BLE plugin, or a backend service.
- Target Android App first while keeping the same source compatible with iOS App and WeChat Mini Program.
- Match only device names containing `RM3` and service UUID `FFF0`.
- Keep exact commands: lock `MSF`, unlock `MCF`, trunk `MCK`.
- Enable commands only after the current RM3 connection exposes a writable characteristic under FFF0.
- Preserve the fixed-dark vehicle UI, closed/open trunk artwork, connection states, retries, command feedback, debug logs, and App-only `carcontrol://send?cmd=...` handling.
- Do not implement widget, accounts, cloud control, background-resident scanning, firmware updates, multi-vehicle management, or H5 BLE control.
- Add no runtime dependency beyond the official uni-app/Vue template; Vitest is development-only.

---

### Task 1: Scaffold the Vue 3 uni-app project and test harness

**Files:**
- Create: `CarControlUniApp/` from the official Vue 3/Vite preset
- Modify: `CarControlUniApp/package.json`
- Create: `CarControlUniApp/vitest.config.js`
- Create: `CarControlUniApp/tests/smoke.test.js`

**Interfaces:**
- Produces: working `npm run dev:h5`, `npm run build:h5`, `npm run build:mp-weixin`, `npm run build:app`, and `npm test` commands.

- [ ] **Step 1: Scaffold from the official preset**

```bash
npx degit dcloudio/uni-preset-vue#vite CarControlUniApp
cd CarControlUniApp
npm install
npm install --save-dev vitest
```

Keep the generated `@dcloudio/*` versions rather than hand-pinning a different release.

- [ ] **Step 2: Write the failing smoke test**

Create `tests/smoke.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../src/domain/app-meta.js'

describe('project', () => {
  it('identifies the CarControl app', () => {
    expect(APP_NAME).toBe('CarControl')
  })
})
```

Run `npm test -- --run`. Expected: FAIL because `src/domain/app-meta.js` does not exist.

- [ ] **Step 3: Add the minimal project metadata and test script**

Create `src/domain/app-meta.js`:

```js
export const APP_NAME = 'CarControl'
```

Add scripts to `package.json` without removing template scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "build:h5": "uni build -p h5",
    "build:mp-weixin": "uni build -p mp-weixin",
    "build:app": "uni build -p app"
  }
}
```

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.js'] }
})
```

- [ ] **Step 4: Verify and commit**

Run `npm test -- --run` and `npm run build:h5`. Expected: one passing test and a successful H5 build.

```bash
git add CarControlUniApp
git commit -m "feat: scaffold uni-app vehicle control project"
```

### Task 2: Implement the pure command, state, and BLE data domain

**Files:**
- Create: `CarControlUniApp/src/domain/vehicle-command.js`
- Create: `CarControlUniApp/src/domain/vehicle-control-state.js`
- Create: `CarControlUniApp/src/utils/ble-data.js`
- Create: `CarControlUniApp/tests/vehicle-domain.test.js`

**Interfaces:**
- Produces: `VehicleCommand`, `createControlState()`, `isReady(state)`, `normalizeUuid(value)`, `isTargetDevice(device)`, and `stringToArrayBuffer(value)`.

- [ ] **Step 1: Write failing domain tests**

```js
import { describe, expect, it } from 'vitest'
import { VehicleCommand } from '../src/domain/vehicle-command.js'
import { createControlState, isReady } from '../src/domain/vehicle-control-state.js'
import { isTargetDevice, normalizeUuid, stringToArrayBuffer } from '../src/utils/ble-data.js'

describe('vehicle domain', () => {
  it('keeps the exact BLE commands', () => {
    expect(VehicleCommand.lock.value).toBe('MSF')
    expect(VehicleCommand.unlock.value).toBe('MCF')
    expect(VehicleCommand.trunk.value).toBe('MCK')
  })

  it('only treats ready as controllable', () => {
    expect(isReady(createControlState('disconnected'))).toBe(false)
    expect(isReady(createControlState('ready', { deviceName: 'RM3-01' }))).toBe(true)
    expect(isReady(createControlState('sending', { command: 'MSF' }))).toBe(false)
  })

  it('matches RM3 case-insensitively and normalizes FFF0', () => {
    expect(isTargetDevice({ name: 'rm3-car' })).toBe(true)
    expect(isTargetDevice({ name: 'speaker' })).toBe(false)
    expect(normalizeUuid('0000fff0-0000-1000-8000-00805f9b34fb')).toBe('FFF0')
  })

  it('encodes command text as UTF-8 bytes', () => {
    expect([...new Uint8Array(stringToArrayBuffer('MSF'))]).toEqual([77, 83, 70])
  })
})
```

Run `npm test -- --run tests/vehicle-domain.test.js`. Expected: FAIL on missing modules.

- [ ] **Step 2: Implement exact command and state values**

```js
export const VehicleCommand = Object.freeze({
  lock: Object.freeze({ key: 'lock', value: 'MSF', title: '锁车', icon: '🔒' }),
  unlock: Object.freeze({ key: 'unlock', value: 'MCF', title: '开锁', icon: '🔓' }),
  trunk: Object.freeze({ key: 'trunk', value: 'MCK', title: '尾箱', icon: '🚘' })
})

export function commandFromValue(value) {
  return Object.values(VehicleCommand).find((command) => command.value === value) ?? null
}
```

```js
export function createControlState(phase, details = {}) {
  return Object.freeze({ phase, ...details })
}

export function isReady(state) {
  return state.phase === 'ready'
}

export function statusText(state) {
  const labels = {
    unavailable: '蓝牙未开启', disconnected: '未连接目标车辆',
    scanning: '正在搜索 RM3', connecting: '正在连接车辆',
    discovering: '正在初始化控制', ready: '车辆已连接',
    sending: '正在发送指令', failure: state.message ?? '连接失败'
  }
  return labels[state.phase]
}
```

- [ ] **Step 3: Implement BLE data helpers**

```js
export function normalizeUuid(value = '') {
  const upper = value.toUpperCase()
  const match = upper.match(/^0000([0-9A-F]{4})-0000-1000-8000-00805F9B34FB$/)
  return match ? match[1] : upper
}

export function isTargetDevice(device) {
  return (device?.name ?? device?.localName ?? '').toUpperCase().includes('RM3')
}

export function stringToArrayBuffer(value) {
  return new TextEncoder().encode(value).buffer
}
```

- [ ] **Step 4: Verify and commit**

Run `npm test -- --run`. Expected: all tests pass.

```bash
git add CarControlUniApp/src/domain CarControlUniApp/src/utils CarControlUniApp/tests
git commit -m "feat: add vehicle command and BLE domain"
```

### Task 3: Wrap the uni-app BLE API behind a testable service

**Files:**
- Create: `CarControlUniApp/src/services/bluetooth-service.js`
- Create: `CarControlUniApp/tests/bluetooth-service.test.js`

**Interfaces:**
- Consumes: `stringToArrayBuffer`.
- Produces: `createBluetoothService(api)` with `open`, `getConnected`, `startScan`, `stopScan`, `connect`, `disconnect`, `getServices`, `getCharacteristics`, `write`, `onDeviceFound`, `onConnectionChange`, and `dispose`.

- [ ] **Step 1: Write a failing adapter test**

Create a fake `uni` object whose callback methods record calls, then assert:

```js
const service = createBluetoothService(fakeUni)
await service.open()
await service.write({ deviceId: 'D1', serviceId: 'FFF0', characteristicId: 'C1', value: 'MSF' })
expect(fakeUni.writeBLECharacteristicValue).toHaveBeenCalledOnce()
expect([...new Uint8Array(fakeUni.lastWrite.value)]).toEqual([77, 83, 70])
service.dispose()
expect(fakeUni.offBluetoothDeviceFound).toHaveBeenCalledOnce()
expect(fakeUni.offBLEConnectionStateChange).toHaveBeenCalledOnce()
```

Run the focused test. Expected: FAIL because the service is missing.

- [ ] **Step 2: Implement promise conversion and listener ownership**

```js
import { stringToArrayBuffer } from '../utils/ble-data.js'

const call = (api, method, options = {}) => new Promise((resolve, reject) => {
  api[method]({ ...options, success: resolve, fail: reject })
})

export function createBluetoothService(api = uni) {
  const foundListeners = new Set()
  const connectionListeners = new Set()
  const foundHandler = (result) => foundListeners.forEach((listener) => listener(result.devices ?? []))
  const connectionHandler = (result) => connectionListeners.forEach((listener) => listener(result))

  api.onBluetoothDeviceFound(foundHandler)
  api.onBLEConnectionStateChange(connectionHandler)

  return {
    open: () => call(api, 'openBluetoothAdapter'),
    getConnected: (services = ['FFF0']) => call(api, 'getConnectedBluetoothDevices', { services }),
    startScan: () => call(api, 'startBluetoothDevicesDiscovery', { allowDuplicatesKey: false }),
    stopScan: () => call(api, 'stopBluetoothDevicesDiscovery'),
    connect: (deviceId) => call(api, 'createBLEConnection', { deviceId, timeout: 10000 }),
    disconnect: (deviceId) => call(api, 'closeBLEConnection', { deviceId }),
    getServices: (deviceId) => call(api, 'getBLEDeviceServices', { deviceId }),
    getCharacteristics: (deviceId, serviceId) => call(api, 'getBLEDeviceCharacteristics', { deviceId, serviceId }),
    write: ({ deviceId, serviceId, characteristicId, value }) => call(api, 'writeBLECharacteristicValue', {
      deviceId, serviceId, characteristicId, value: stringToArrayBuffer(value)
    }),
    onDeviceFound(listener) { foundListeners.add(listener); return () => foundListeners.delete(listener) },
    onConnectionChange(listener) { connectionListeners.add(listener); return () => connectionListeners.delete(listener) },
    dispose() {
      api.offBluetoothDeviceFound(foundHandler)
      api.offBLEConnectionStateChange(connectionHandler)
      foundListeners.clear(); connectionListeners.clear()
    }
  }
}
```

- [ ] **Step 3: Verify and commit**

Run the focused test and full suite. Commit:

```bash
git add CarControlUniApp/src/services CarControlUniApp/tests/bluetooth-service.test.js
git commit -m "feat: add cross-platform BLE service"
```

### Task 4: Implement the vehicle controller state machine

**Files:**
- Create: `CarControlUniApp/src/composables/useVehicleController.js`
- Create: `CarControlUniApp/tests/vehicle-controller.test.js`

**Interfaces:**
- Consumes: `VehicleCommand`, state helpers, UUID/device helpers, and `createBluetoothService`.
- Produces: `createVehicleController(service, scheduler)` with reactive `state`, `logs`, `lastResult`, plus `connect`, `retry`, `sendCommand`, and `dispose`.

- [ ] **Step 1: Write failing controller scenarios**

Use a fake service and fake scheduler to assert these independent behaviors:

```js
it('ignores non-RM3 devices')
it('becomes ready only after FFF0 exposes write or writeNoResponse')
it('sends MSF once and blocks a duplicate while sending')
it('ignores stale scan and connection generations')
it('disables controls immediately after disconnect')
it('clears listeners and timers on dispose')
```

Each test must drive the fake callbacks and assert exact phase transitions and write calls. Run the focused test and confirm failure on the missing controller.

- [ ] **Step 2: Implement the controller with explicit tokens**

The controller must maintain:

```js
let scanGeneration = 0
let connectionGeneration = 0
let writeToken = null
let scanTimer = null
let resultTimer = null
let currentDevice = null
let writableCharacteristic = null
```

`connect()` opens the adapter, increments scan generation, checks connected FFF0 devices, then scans. The found-device callback accepts only RM3 and captures the current generation. Connection setup normalizes service UUIDs, searches only FFF0, and accepts only characteristics whose `properties.write` or `properties.writeNoResponse` is true.

`sendCommand(command)` must guard `state.phase === 'ready'`, assign a unique `Symbol`, transition to sending, write once, ignore stale completions, publish a two-second result, and return to ready. A three-second write timeout invalidates the current session and requires reconnect.

`dispose()` increments both generations, clears tokens/timers, stops scanning, disconnects the current device, removes service listeners, and calls `service.dispose()`.

- [ ] **Step 3: Verify and commit**

Run `npm test -- --run`. Expected: all controller races and prior tests pass.

```bash
git add CarControlUniApp/src/composables CarControlUniApp/tests/vehicle-controller.test.js
git commit -m "feat: add vehicle BLE controller"
```

### Task 5: Port the approved dark vehicle-control UI

**Files:**
- Replace: `CarControlUniApp/src/pages/index/index.vue` with `src/pages/control/control.vue`
- Create: `CarControlUniApp/src/components/ConnectionHeader.vue`
- Create: `CarControlUniApp/src/components/VehicleHero.vue`
- Create: `CarControlUniApp/src/components/VehicleControlButton.vue`
- Create: `CarControlUniApp/src/components/DebugLogPanel.vue`
- Modify: `CarControlUniApp/src/pages.json`
- Copy: iOS vehicle PNGs to `CarControlUniApp/src/static/vehicle/`

**Interfaces:**
- Consumes: `createVehicleController` and the two approved PNG assets.
- Produces: responsive control page with visible status, retry, logs, three command buttons, and trunk-sent artwork.

- [ ] **Step 1: Copy assets and write component contract tests**

Copy the exact committed files from `CarControl/Assets.xcassets/VehicleTop*.imageset/`. Add source-level tests that mount or parse components to assert the visible labels `Q60S 控制`, `RM3`, `锁车`, `开锁`, `尾箱`, `日志`, and `重新扫描`, and verify each command button emits its command key.

- [ ] **Step 2: Implement focused components**

Use only `view`, `text`, `image`, `scroll-view`, and `button`. Apply these tokens in page-scoped CSS:

```css
--bg: #090b0e;
--surface: #13161b;
--control: #1f2229;
--ink: #ffffff;
--muted: rgba(255, 255, 255, 0.72);
--accent: #ed2926;
--ready: #40d184;
```

Default command diameters are 112px primary and 76px secondary, with minimum 44px targets. Use responsive media queries and a vertical fallback below 340px or when text scaling makes the horizontal dock overflow. Do not compress label text.

- [ ] **Step 3: Compose the page and lifecycle**

In `control.vue`, create the service/controller on page load, call `connect()`, dispose on unload, and route button commands through `sendCommand(VehicleCommand[key])`. Show the trunk-open image only when `lastResult.command === 'trunk' && lastResult.ok` and label it “尾箱指令已发送”.

On App platforms only, inspect launch/show arguments for `carcontrol://send?cmd=...`, parse through `commandFromValue`, wait for ready, and send once. Exclude the handler from `MP-WEIXIN` with conditional compilation.

- [ ] **Step 4: Verify and commit**

Run tests plus `npm run build:h5` and `npm run build:mp-weixin`. Inspect the H5 page at narrow and normal phone widths; H5 must show “当前平台不支持蓝牙控制” rather than claiming BLE works.

```bash
git add CarControlUniApp/src
git commit -m "feat: port vehicle control interface to uni-app"
```

### Task 6: Configure platforms and produce the Android handoff

**Files:**
- Modify: `CarControlUniApp/src/manifest.json`
- Modify: `CarControlUniApp/src/pages.json`
- Create: `CarControlUniApp/README.md`

**Interfaces:**
- Produces: valid App, H5, and WeChat build outputs plus exact Android device/APK instructions.

- [ ] **Step 1: Configure App identity, permissions, and scheme**

Set app name `CarControl`, version `1.0.0`, version code `100`, Android package `com.chen.carcontrol`, URL scheme `carcontrol`, iOS deployment target 12+, Bluetooth privacy copy, and Android Bluetooth/location permissions needed across Android versions. Keep DCloud AppID empty until HBuilderX assigns one; do not commit signing keys or account identifiers.

- [ ] **Step 2: Build every CLI target**

```bash
npm test -- --run
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

Expected: tests pass and `dist/build/h5`, `dist/build/mp-weixin`, and the App WGT resource output are produced. The uni CLI cannot create an APK; record this accurately.

- [ ] **Step 3: Verify Android tooling and document the final APK step**

Confirm `adb devices -l`. If HBuilderX is absent, document:

1. Install the small standard HBuilderX build.
2. Open the CLI project root.
3. Connect Android with USB debugging.
4. Run to the phone using the standard base for live BLE testing.
5. After the RM3 flow passes, use HBuilderX cloud packaging to produce an APK.

Do not claim APK success until an actual `.apk` exists and `adb install -r <path>` succeeds.

- [ ] **Step 4: Execute the eight-step RM3 acceptance test**

On the Android phone verify Bluetooth-off, RM3-only discovery, FFF0 readiness, exact `MSF`/`MCF`/`MCK` writes, duplicate prevention, disconnect/reconnect, and logs. Record device/Android version and observed results.

- [ ] **Step 5: Commit documentation and final verification fixes**

```bash
git add CarControlUniApp/src/manifest.json CarControlUniApp/src/pages.json CarControlUniApp/README.md
git commit -m "docs: add Android build and RM3 verification guide"
```
