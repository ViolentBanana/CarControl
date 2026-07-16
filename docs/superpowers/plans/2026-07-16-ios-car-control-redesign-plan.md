# iOS Car Control Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current basic SwiftUI screen with a dark, vehicle-centered control surface that only enables lock, unlock, and trunk commands after the target `RM3` BLE device and writable `FFF0` characteristic are ready.

**Architecture:** Keep Core Bluetooth inside `BluetoothViewModel`, but expose one explicit `VehicleControlState` instead of making the view infer readiness from several strings and booleans. Compose the UI from focused SwiftUI views for the header, vehicle artwork, controls, and log sheet. Preserve compatibility properties and the existing URL Scheme flow so `SilentLaunchView` and external callers continue to work.

**Tech Stack:** Swift 5, SwiftUI, CoreBluetooth, UIKit haptics, SF Symbols, iOS 16+, `xcodebuild`, and a small command-line Swift state-model test harness.

## Global Constraints

- Only modify the iOS App main control experience; do not modify `CarControlWidget/`.
- Keep `MCK` for trunk, `MCF` for unlock, and `MSF` for lock.
- Treat only a peripheral whose name contains `RM3` and whose `FFF0` service exposes a writable characteristic as ready.
- Keep automatic connected-device lookup, scanning, debug logs, notification-based commands, and the `carcontrol://` URL Scheme path.
- Use a fixed dark appearance for this phase.
- Use original top-view coupe artwork without Infiniti logos or third-party vehicle images.
- Use Dynamic Type semantic styles, SF Symbols, 44×44 pt minimum targets, VoiceOver labels, and Reduce Motion support.
- Do not add third-party dependencies.
- The current workstation has Swift command-line tools but no discoverable Xcode app; pure Swift tests can run here, while simulator builds require installing/selecting Xcode before the `xcodebuild` verification steps can pass.

## File Map

- Create `CarControl/VehicleControlState.swift`: command vocabulary, BLE control state, readiness, and user-facing state text.
- Create `CarControl/VehicleControlTheme.swift`: shared colors and spacing for the main control surface.
- Create `CarControl/VehicleHeroView.swift`: top-view coupe presentation and trunk-open feedback.
- Create `CarControl/VehicleControlButton.swift`: reusable primary/secondary control button and busy state.
- Create `CarControl/DebugLogSheet.swift`: accessible bottom-sheet log presentation.
- Create `CarControl/ControlFeedback.swift`: haptic success and failure feedback.
- Modify `CarControl/BluetoothViewModel.swift`: target validation, explicit state transitions, command gating, disconnect handling, and result feedback.
- Modify `CarControl/ContentView.swift`: compose the new screen and preserve scan/log gestures.
- Modify `CarControl/SilentLaunchView.swift`: wait for `ready` before sending external commands instead of relying on a fixed one-second delay.
- Add `CarControl/Assets.xcassets/VehicleTop.imageset/`: original closed-trunk PNG asset.
- Add `CarControl/Assets.xcassets/VehicleTopTrunkOpen.imageset/`: original open-trunk PNG asset.
- Create `Tests/VehicleControlStateTests.swift`: executable pure-Swift state and command assertions.

---

### Task 1: Define the command and connection state model

**Files:**
- Create: `CarControl/VehicleControlState.swift`
- Create: `Tests/VehicleControlStateTests.swift`

**Interfaces:**
- Produces: `VehicleCommand`, `VehicleControlState`, `VehicleCommandResult`, `VehicleControlState.isReady`, `VehicleControlState.deviceName`, and `VehicleControlState.statusText`.
- Consumed by: `BluetoothViewModel`, `ContentView`, `VehicleHeroView`, and `VehicleControlButton`.

- [ ] **Step 1: Write the failing state-model test**

Create `Tests/VehicleControlStateTests.swift`:

```swift
import Foundation

@main
enum VehicleControlStateTests {
    static func main() {
        precondition(VehicleCommand.trunk.rawValue == "MCK")
        precondition(VehicleCommand.unlock.rawValue == "MCF")
        precondition(VehicleCommand.lock.rawValue == "MSF")

        precondition(!VehicleControlState.disconnected.isReady)
        precondition(!VehicleControlState.scanning.isReady)
        precondition(!VehicleControlState.discoveringServices(deviceName: "RM3-01").isReady)
        precondition(VehicleControlState.ready(deviceName: "RM3-01").isReady)
        precondition(!VehicleControlState.sending(command: .lock, deviceName: "RM3-01").isReady)
        precondition(VehicleControlState.sending(command: .lock, deviceName: "RM3-01").sendingCommand == .lock)
        precondition(VehicleControlState.ready(deviceName: "RM3-01").deviceName == "RM3-01")
        precondition(VehicleControlState.failure(message: "连接失败").statusText == "连接失败")

        print("VehicleControlStateTests passed")
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
swiftc CarControl/VehicleControlState.swift Tests/VehicleControlStateTests.swift -o /tmp/VehicleControlStateTests
```

Expected: compilation fails because `CarControl/VehicleControlState.swift` and its types do not exist.

- [ ] **Step 3: Implement the state model**

Create `CarControl/VehicleControlState.swift`:

```swift
import Foundation

enum VehicleCommand: String, CaseIterable, Equatable {
    case trunk = "MCK"
    case unlock = "MCF"
    case lock = "MSF"

    var title: String {
        switch self {
        case .trunk: "尾箱"
        case .unlock: "开锁"
        case .lock: "锁车"
        }
    }

    var systemImage: String {
        switch self {
        case .trunk: "car.fill"
        case .unlock: "lock.open.fill"
        case .lock: "lock.fill"
        }
    }
}

enum VehicleControlState: Equatable {
    case bluetoothUnavailable
    case disconnected
    case scanning
    case connecting(deviceName: String)
    case discoveringServices(deviceName: String)
    case ready(deviceName: String)
    case sending(command: VehicleCommand, deviceName: String)
    case failure(message: String)

    var isReady: Bool {
        if case .ready = self { return true }
        return false
    }

    var deviceName: String? {
        switch self {
        case let .connecting(name), let .discoveringServices(name), let .ready(name), let .sending(_, name):
            return name
        default:
            return nil
        }
    }

    var sendingCommand: VehicleCommand? {
        if case let .sending(command, _) = self { return command }
        return nil
    }

    var statusText: String {
        switch self {
        case .bluetoothUnavailable: "蓝牙未开启"
        case .disconnected: "未连接目标车辆"
        case .scanning: "正在搜索 RM3"
        case .connecting: "正在连接车辆"
        case .discoveringServices: "正在初始化控制"
        case .ready: "车辆已连接"
        case let .sending(command, _): "正在发送“\(command.title)”"
        case let .failure(message): message
        }
    }
}

enum VehicleCommandResult: Equatable {
    case sent(VehicleCommand)
    case failed(VehicleCommand, message: String)
}
```

- [ ] **Step 4: Run the test and app build**

Run:

```bash
swiftc CarControl/VehicleControlState.swift Tests/VehicleControlStateTests.swift -o /tmp/VehicleControlStateTests
/tmp/VehicleControlStateTests
xcodebuild -project CarControl.xcodeproj -scheme CarControl -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

Expected: the test prints `VehicleControlStateTests passed`; the app scheme ends with `BUILD SUCCEEDED`.

- [ ] **Step 5: Commit the state model**

```bash
git add CarControl/VehicleControlState.swift Tests/VehicleControlStateTests.swift
git commit -m "feat: add vehicle control state model"
```

### Task 2: Make BLE readiness explicit and gate commands

**Files:**
- Modify: `CarControl/BluetoothViewModel.swift`
- Modify: `CarControl/SilentLaunchView.swift`

**Interfaces:**
- Consumes: `VehicleCommand` and `VehicleControlState` from Task 1.
- Produces: `controlState`, `lastCommandResult`, `connectToVehicle()`, `clearCommandResult()`, and `send(_ command: VehicleCommand)`.
- Compatibility: retain `connectionStatus`, `scanStatus`, `isConnected`, `debugLog`, `scanForDevices()`, `retrieveConnectedDevices()`, and `sendCommand(_:)`.

- [ ] **Step 1: Add state and target constants to `BluetoothViewModel`**

Add these stored properties and keep the existing compatibility properties:

```swift
@Published private(set) var controlState: VehicleControlState = .disconnected
@Published private(set) var lastCommandResult: VehicleCommandResult?

private let targetNameFragment = "RM3"
private let serviceUUID = CBUUID(string: "FFF0")
private var pendingCommand: VehicleCommand?

var canControlVehicle: Bool { controlState.isReady }
```

Add one transition helper so strings and booleans cannot drift apart:

```swift
private func transition(to state: VehicleControlState) {
    controlState = state
    connectionStatus = state.statusText
    scanStatus = state.statusText
    switch state {
    case .discoveringServices, .ready, .sending:
        isConnected = true
    default:
        isConnected = false
    }
}
```

Add the public connection entry point used by both views:

```swift
func connectToVehicle() {
    guard centralManager.state == .poweredOn else {
        transition(to: .bluetoothUnavailable)
        return
    }

    switch controlState {
    case .scanning, .connecting, .discoveringServices, .ready, .sending:
        return
    default:
        retrieveConnectedDevices()
    }
}

func clearCommandResult() {
    lastCommandResult = nil
}
```

- [ ] **Step 2: Restrict discovery and retrieved devices to `RM3`**

In `didDiscover`, reject non-target names before assigning `discoveredPeripheral`:

```swift
guard name.localizedCaseInsensitiveContains(targetNameFragment) else {
    log("忽略非目标设备：\(name)")
    return
}

centralManager.stopScan()
isScanning = false
discoveredPeripheral = peripheral
peripheral.delegate = self
transition(to: .connecting(deviceName: name))
centralManager.connect(peripheral, options: nil)
```

In `retrieveConnectedDevices()`, select only a peripheral whose name contains `RM3`. If none exists, call `scanForDevices()` and transition to `.scanning`.

Keep the existing ten-second scan timeout, but replace its success-looking string mutation with:

```swift
self.centralManager.stopScan()
self.isScanning = false
self.transition(to: .failure(message: "未找到目标车辆"))
self.log("扫描超时，未找到 RM3")
```

- [ ] **Step 3: Drive connection, service discovery, and disconnect transitions**

Use the following transition rules:

```swift
func centralManagerDidUpdateState(_ central: CBCentralManager) {
    guard central.state == .poweredOn else {
        transition(to: .bluetoothUnavailable)
        return
    }
    retrieveConnectedDevices()
}

func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    let name = peripheral.name ?? targetNameFragment
    transition(to: .discoveringServices(deviceName: name))
    peripheral.delegate = self
    peripheral.discoverServices([serviceUUID])
}

func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    targetCharacteristic = nil
    discoveredPeripheral = nil
    pendingCommand = nil
    transition(to: .disconnected)
    if let error { log("连接断开：\(error.localizedDescription)") }
}

func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    targetCharacteristic = nil
    discoveredPeripheral = nil
    transition(to: .failure(message: "连接目标车辆失败"))
    if let error { log("连接失败：\(error.localizedDescription)") }
}
```

In characteristic discovery, transition to `.ready(deviceName:)` only after finding `.write` or `.writeWithoutResponse`. If no writable characteristic exists, transition to `.failure(message: "车辆控制模块未就绪")`.

- [ ] **Step 4: Gate typed and string commands**

Add the typed entry point and make the legacy entry point delegate to it:

```swift
func send(_ command: VehicleCommand) {
    guard case let .ready(deviceName) = controlState,
          let peripheral = discoveredPeripheral,
          let characteristic = targetCharacteristic else {
        lastCommandResult = .failed(command, message: "请先连接目标车辆")
        return
    }

    guard let data = command.rawValue.data(using: .utf8) else {
        lastCommandResult = .failed(command, message: "指令编码失败")
        return
    }

    pendingCommand = command
    transition(to: .sending(command: command, deviceName: deviceName))
    let type: CBCharacteristicWriteType = characteristic.properties.contains(.write) ? .withResponse : .withoutResponse
    peripheral.writeValue(data, for: characteristic, type: type)

    if type == .withoutResponse {
        complete(command, result: .sent(command), deviceName: deviceName)
    } else {
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self, self.pendingCommand == command else { return }
            self.complete(
                command,
                result: .failed(command, message: "车辆响应超时"),
                deviceName: deviceName
            )
        }
    }
}

func sendCommand(_ command: String) {
    guard let typedCommand = VehicleCommand(rawValue: command) else {
        log("拒绝未知指令：\(command)")
        return
    }
    send(typedCommand)
}

private func complete(_ command: VehicleCommand, result: VehicleCommandResult, deviceName: String) {
    pendingCommand = nil
    lastCommandResult = result
    transition(to: .ready(deviceName: deviceName))
}
```

After publishing `lastCommandResult`, keep it visible for two seconds and then clear it only if it still describes the same command:

```swift
DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
    guard let self else { return }
    guard self.lastCommandResult == result else { return }
    self.clearCommandResult()
}
```

Update `didWriteValueFor` so `.withResponse` writes complete the pending command with `.sent` or `.failed` and return to `.ready`.

- [ ] **Step 5: Replace the fixed delay in `SilentLaunchView`**

Use the typed command and react to readiness:

```swift
@State private var pendingVehicleCommand: VehicleCommand?

.onAppear {
    pendingVehicleCommand = VehicleCommand(rawValue: command)
    bluetoothVM.connectToVehicle()
    sendWhenReady()
    AppDelegate.pendingCommand = nil
}
.onChange(of: bluetoothVM.controlState) { _ in
    sendWhenReady()
}
```

Implement:

```swift
private func sendWhenReady() {
    guard !isSent,
          bluetoothVM.controlState.isReady,
          let pendingVehicleCommand else { return }
    bluetoothVM.send(pendingVehicleCommand)
    isSent = true
}
```

- [ ] **Step 6: Build and commit**

Run:

```bash
xcodebuild -project CarControl.xcodeproj -scheme CarControl -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

Expected: `BUILD SUCCEEDED` with no changes under `CarControlWidget/`.

```bash
git add CarControl/BluetoothViewModel.swift CarControl/SilentLaunchView.swift
git commit -m "feat: gate controls on target BLE readiness"
```

### Task 3: Add the original vehicle artwork and hero component

**Files:**
- Create: `CarControl/VehicleControlTheme.swift`
- Create: `CarControl/VehicleHeroView.swift`
- Create: `CarControl/Assets.xcassets/VehicleTop.imageset/Contents.json`
- Create: `CarControl/Assets.xcassets/VehicleTop.imageset/vehicle-top.png`
- Create: `CarControl/Assets.xcassets/VehicleTopTrunkOpen.imageset/Contents.json`
- Create: `CarControl/Assets.xcassets/VehicleTopTrunkOpen.imageset/vehicle-top-trunk-open.png`

**Interfaces:**
- Consumes: `VehicleControlState` and `VehicleCommandResult`.
- Produces: `VehicleControlTheme` tokens and `VehicleHeroView(state:lastResult:)`.

- [ ] **Step 1: Generate and inspect original artwork**

Use the image-generation workflow to create two transparent-background PNGs with the same camera, scale, silver paint, lighting, and canvas dimensions:

```text
Asset 1: an original top-down silver two-door sports coupe, low and wide proportions inspired by modern Japanese grand tourers, no logos, no text, closed trunk, realistic studio lighting, isolated transparent background.

Asset 2: exactly the same original top-down coupe and camera, with the rear trunk visibly raised, no logos, no text, isolated transparent background.
```

Inspect both images at original resolution. Reject mismatched body geometry, non-transparent backgrounds, visible badges, extra shadows outside the canvas, or inconsistent camera angles. Save accepted images under the exact paths above.

- [ ] **Step 2: Add asset catalogs**

Use this `Contents.json` for each image set, changing only the filename:

```json
{
  "images" : [
    { "filename" : "vehicle-top.png", "idiom" : "universal", "scale" : "1x" },
    { "idiom" : "universal", "scale" : "2x" },
    { "idiom" : "universal", "scale" : "3x" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
```

- [ ] **Step 3: Add theme tokens**

Create `VehicleControlTheme.swift`:

```swift
import SwiftUI

enum VehicleControlTheme {
    static let background = Color(red: 0.035, green: 0.043, blue: 0.055)
    static let elevated = Color(red: 0.075, green: 0.086, blue: 0.105)
    static let control = Color(red: 0.12, green: 0.13, blue: 0.16)
    static let primaryText = Color.white
    static let secondaryText = Color.white.opacity(0.68)
    static let accent = Color(red: 0.93, green: 0.16, blue: 0.15)
    static let ready = Color(red: 0.25, green: 0.82, blue: 0.52)
}
```

- [ ] **Step 4: Implement `VehicleHeroView`**

Create a view with this public shape:

```swift
struct VehicleHeroView: View {
    let state: VehicleControlState
    let lastResult: VehicleCommandResult?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var showsOpenTrunk: Bool {
        lastResult == .sent(.trunk)
    }

    var body: some View {
        ZStack {
            if state.isReady {
                Ellipse()
                    .fill(VehicleControlTheme.ready.opacity(0.12))
                    .frame(width: 220, height: 280)
                    .blur(radius: 28)
            }

            Image(showsOpenTrunk ? "VehicleTopTrunkOpen" : "VehicleTop")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 230, maxHeight: 310)
                .opacity(state == .disconnected ? 0.42 : 1)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.22), value: showsOpenTrunk)

            if showsOpenTrunk {
                Ellipse()
                    .fill(VehicleControlTheme.accent.opacity(0.5))
                    .frame(width: 150, height: 64)
                    .blur(radius: 18)
                    .offset(y: 118)
                    .transition(.opacity)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 300)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(showsOpenTrunk ? "车辆俯视图，尾箱指令已发送" : "车辆俯视图")
    }
}
```

Keep the feedback truthful: the artwork means “trunk command sent” unless the BLE protocol later provides confirmed vehicle state.

- [ ] **Step 5: Build and commit**

Run the app build and inspect the hero in an iPhone 16 simulator and an iPhone SE-sized simulator. Expected: no clipping, logo, unsafe-area overlap, or light background fringe.

```bash
git add CarControl/VehicleControlTheme.swift CarControl/VehicleHeroView.swift CarControl/Assets.xcassets/VehicleTop.imageset CarControl/Assets.xcassets/VehicleTopTrunkOpen.imageset
git commit -m "feat: add original vehicle hero artwork"
```

### Task 4: Build accessible controls and feedback

**Files:**
- Create: `CarControl/VehicleControlButton.swift`
- Create: `CarControl/ControlFeedback.swift`
- Delete: `CarControl/BluetoothControlButton.swift`

**Interfaces:**
- Consumes: `VehicleCommand` and `VehicleControlState`.
- Produces: `VehicleControlButton(command:style:isEnabled:isBusy:action:)` and `ControlFeedback.success()` / `ControlFeedback.failure()`.

- [ ] **Step 1: Implement haptics**

Create `ControlFeedback.swift`:

```swift
import UIKit

enum ControlFeedback {
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func failure() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
}
```

- [ ] **Step 2: Implement primary and secondary button styles**

Create `VehicleControlButton.swift` with:

```swift
import SwiftUI

struct VehicleControlButton: View {
    enum Style { case primary, secondary }

    let command: VehicleCommand
    let style: Style
    let isEnabled: Bool
    let isBusy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                if isBusy {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: command.systemImage)
                        .font(style == .primary ? .title2 : .headline)
                }
                Text(command.title)
                    .font(style == .primary ? .headline : .subheadline.weight(.semibold))
            }
            .foregroundStyle(isEnabled ? VehicleControlTheme.primaryText : VehicleControlTheme.secondaryText)
            .frame(width: style == .primary ? 112 : 76, height: style == .primary ? 112 : 76)
            .background(style == .primary && isEnabled ? VehicleControlTheme.accent : VehicleControlTheme.control)
            .clipShape(Circle())
        }
        .buttonStyle(PressScaleButtonStyle())
        .disabled(!isEnabled || isBusy)
        .accessibilityLabel(command.title)
        .accessibilityHint(isEnabled ? "发送车辆控制指令" : "连接 RM3 后可用")
    }
}

private struct PressScaleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .brightness(configuration.isPressed ? -0.06 : 0)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}
```

- [ ] **Step 3: Remove the obsolete button**

Delete `BluetoothControlButton.swift` after `ContentView` no longer references it. Do not keep two competing button vocabularies.

- [ ] **Step 4: Build and commit**

Run `xcodebuild` and inspect default, disabled, busy, and pressed states through previews or temporary constant inputs. Expected: every target is at least 44×44 pt, labels remain readable, and Reduce Motion removes scale movement.

```bash
git add CarControl/VehicleControlButton.swift CarControl/ControlFeedback.swift CarControl/BluetoothControlButton.swift
git commit -m "feat: add vehicle control buttons and feedback"
```

### Task 5: Compose the main screen and log sheet

**Files:**
- Modify: `CarControl/ContentView.swift`
- Create: `CarControl/DebugLogSheet.swift`

**Interfaces:**
- Consumes: all state and view interfaces from Tasks 1–4.
- Produces: the final iOS main control experience.

- [ ] **Step 1: Implement the log sheet**

Create `DebugLogSheet.swift`:

```swift
import SwiftUI

struct DebugLogSheet: View {
    let lines: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if lines.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "wave.3.right")
                                .font(.title2)
                            Text("暂无连接日志")
                                .font(.headline)
                        }
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 180)
                    } else {
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding()
            }
            .background(VehicleControlTheme.background)
            .navigationTitle("连接日志")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
```

- [ ] **Step 2: Replace `ContentView` with focused composition**

Use a `ZStack` background and a safe-area-aware `VStack`:

```swift
struct ContentView: View {
    @EnvironmentObject private var bluetoothVM: BluetoothViewModel
    @State private var showsLog = false

    var body: some View {
        ZStack {
            VehicleControlTheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                VehicleHeroView(state: bluetoothVM.controlState, lastResult: bluetoothVM.lastCommandResult)
                Spacer(minLength: 12)
                controls
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showsLog) {
            DebugLogSheet(lines: bluetoothVM.debugLog)
                .presentationDetents([.medium, .large])
        }
        .onAppear {
            bluetoothVM.connectToVehicle()
            installCommandObserver()
        }
        .onTapGesture(count: 2) { showsLog.toggle() }
        .onTapGesture {
            guard !bluetoothVM.controlState.isReady else { return }
            bluetoothVM.connectToVehicle()
        }
        .onChange(of: bluetoothVM.lastCommandResult) { result in
            guard let result else { return }
            switch result {
            case .sent: ControlFeedback.success()
            case .failed: ControlFeedback.failure()
            }
        }
    }
}
```

Implement `header` with the title “Q60S 控制”, `RM3`, a green ready indicator only for `.ready`, the current `statusText`, a log button, and a visible “重新扫描” button when disconnected or failed.

- [ ] **Step 3: Compose the three controls**

Implement the control dock with the primary lock button centered and the secondary buttons flanking it:

```swift
private var controls: some View {
    HStack(alignment: .center, spacing: 24) {
        commandButton(.unlock, style: .secondary)
        commandButton(.lock, style: .primary)
        commandButton(.trunk, style: .secondary)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 18)
}

private func commandButton(_ command: VehicleCommand, style: VehicleControlButton.Style) -> some View {
    return VehicleControlButton(
        command: command,
        style: style,
        isEnabled: bluetoothVM.controlState.isReady,
        isBusy: bluetoothVM.controlState.sendingCommand == command
    ) {
        bluetoothVM.send(command)
    }
}
```

- [ ] **Step 4: Keep one notification observer lifecycle**

Replace the unmanaged `NotificationCenter.addObserver` closure with SwiftUI `.onReceive`:

```swift
.onReceive(NotificationCenter.default.publisher(for: .bluetoothCommand)) { notification in
    guard let rawCommand = notification.object as? String else { return }
    bluetoothVM.sendCommand(rawCommand)
}
```

This avoids installing duplicate observers every time the view appears.

- [ ] **Step 5: Build, inspect, and commit**

Run:

```bash
xcodebuild -project CarControl.xcodeproj -scheme CarControl -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
git diff --check
```

Expected: `BUILD SUCCEEDED`; no whitespace errors; no changes under `CarControlWidget/`.

Inspect disconnected, scanning, ready, sending, failure, log-open, and trunk-sent states. Verify the header stays inside the Dynamic Island/notch safe area and controls remain above the home indicator.

```bash
git add CarControl/ContentView.swift CarControl/DebugLogSheet.swift
git commit -m "feat: redesign iOS vehicle control screen"
```

### Task 6: Regression and accessibility verification

**Files:**
- Modify only files from Tasks 1–5 if verification reveals a defect.

**Interfaces:**
- Verifies: BLE gating, three command mappings, external command behavior, responsive layout, accessibility, and widget isolation.

- [ ] **Step 1: Run the pure state tests**

```bash
swiftc CarControl/VehicleControlState.swift Tests/VehicleControlStateTests.swift -o /tmp/VehicleControlStateTests
/tmp/VehicleControlStateTests
```

Expected: `VehicleControlStateTests passed`.

- [ ] **Step 2: Build both app configurations**

```bash
xcodebuild -project CarControl.xcodeproj -scheme CarControl -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
xcodebuild -project CarControl.xcodeproj -scheme CarControl -configuration Release -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

Expected: both commands end with `BUILD SUCCEEDED`.

- [ ] **Step 3: Verify BLE behavior on physical iPhone**

Use the target hardware and check this exact sequence:

1. Bluetooth off → “蓝牙未开启”; all three controls unavailable.
2. Bluetooth on with no RM3 → scan starts; non-RM3 devices never enable controls.
3. RM3 discovered → connecting and initialization states appear once each.
4. Writable FFF0 characteristic discovered → ready indicator appears; controls enable.
5. Tap lock, unlock, and trunk once → logs contain exactly `MSF`, `MCF`, and `MCK` respectively.
6. Rapidly tap one control while sending → only one write occurs.
7. Disconnect RM3 → controls disable immediately and reconnect is offered.
8. Open `carcontrol://send?cmd=MSF` → command waits for readiness and sends once.

- [ ] **Step 4: Verify layout and accessibility**

Check an iPhone 16-class simulator and the smallest supported iPhone simulator:

- Default text and one larger Accessibility text size do not clip the title, state, or button labels.
- VoiceOver announces button names and the disabled hint.
- Reduce Motion removes scale and vehicle transition motion.
- Log sheet opens from the visible button and double-tap gesture.
- Every control has a minimum 44×44 pt hit target.

- [ ] **Step 5: Verify scope and working tree**

```bash
git diff HEAD~5 -- CarControlWidget
git status --short
git diff --check
```

Expected: no widget diff, no uncommitted implementation files, and no whitespace errors.

- [ ] **Step 6: Commit any concrete verification fixes**

If verification required edits, stage only those files and commit:

```bash
git add CarControl
git commit -m "fix: harden vehicle control interactions"
```

If no edits were required, do not create an empty commit.
