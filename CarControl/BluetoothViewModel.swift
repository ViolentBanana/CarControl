import CoreBluetooth
import Foundation

class BluetoothViewModel: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    @Published var connectionStatus: String = "未连接"
    @Published var isConnected: Bool = false
    @Published var discoveredPeripheral: CBPeripheral?
    @Published var targetCharacteristic: CBCharacteristic?
    @Published var debugLog: [String] = []
    @Published var scanStatus: String = ""
    @Published private(set) var controlState: VehicleControlState = .disconnected
    @Published private(set) var lastCommandResult: VehicleCommandResult?

    private var isScanning = false
    private var centralManager: CBCentralManager!
    private static let targetNameFragment = "RM3"
    private let serviceUUID = CBUUID(string: "FFF0")
    private var pendingCommand: VehicleCommand?
    private var scanGeneration = 0

    var canControlVehicle: Bool { controlState.isReady }

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
        log("💡 BluetoothViewModel 初始化")
    }

    static func isTargetDeviceName(_ name: String?) -> Bool {
        guard let name else { return false }
        return name.localizedCaseInsensitiveContains(targetNameFragment)
    }

    static func shouldHandleScanTimeout(
        scheduledGeneration: Int,
        currentGeneration: Int,
        isScanning: Bool
    ) -> Bool {
        isScanning && scheduledGeneration == currentGeneration
    }

    static func shouldCompleteCommand(
        _ command: VehicleCommand,
        pendingCommand: VehicleCommand?,
        controlState: VehicleControlState,
        bluetoothPoweredOn: Bool
    ) -> Bool {
        guard bluetoothPoweredOn,
              pendingCommand == command,
              case let .sending(sendingCommand, _) = controlState else { return false }
        return sendingCommand == command
    }

    func log(_ message: String) {
        print(message)
        DispatchQueue.main.async {
            self.debugLog.append(message)
        }
    }

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

    private func stopScanning() {
        centralManager?.stopScan()
        isScanning = false
        scanGeneration += 1
    }

    private func markBluetoothUnavailable() {
        stopScanning()
        pendingCommand = nil
        transition(to: .bluetoothUnavailable)
    }

    func connectToVehicle() {
        guard centralManager.state == .poweredOn else {
            markBluetoothUnavailable()
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

    private func publish(_ result: VehicleCommandResult) {
        lastCommandResult = result

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self else { return }
            guard self.lastCommandResult == result else { return }
            self.clearCommandResult()
        }
    }

    // MARK: 蓝牙扫描

    func scanForDevices() {
        guard !isConnected else {
            log("⚠️ 已连接设备，跳过扫描")
            return
        }

        guard !isScanning else {
            log("⚠️ 已在扫描中，跳过重复扫描")
            return
        }

        guard centralManager.state == .poweredOn else {
            markBluetoothUnavailable()
            log("❌ 蓝牙未开启，无法扫描")
            return
        }

        debugLog.removeAll()
        isScanning = true
        scanGeneration += 1
        let scheduledGeneration = scanGeneration
        transition(to: .scanning)
        centralManager.scanForPeripherals(withServices: nil, options: nil)
        log("🔍 开始扫描设备...")

        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self,
                  Self.shouldHandleScanTimeout(
                      scheduledGeneration: scheduledGeneration,
                      currentGeneration: self.scanGeneration,
                      isScanning: self.isScanning
                  ) else { return }
            self.stopScanning()
            self.transition(to: .failure(message: "未找到目标车辆"))
            self.log("扫描超时，未找到 \(Self.targetNameFragment)")
        }
    }

    // MARK: 获取已连接设备

    func retrieveConnectedDevices() {
        guard centralManager.state == .poweredOn else {
            markBluetoothUnavailable()
            log("❌ 蓝牙未开启，无法获取已连接设备")
            return
        }

        let connectedPeripherals = centralManager.retrieveConnectedPeripherals(withServices: [serviceUUID])
        guard let peripheral = connectedPeripherals.first(where: { Self.isTargetDeviceName($0.name) }) else {
            log("❌ 没有找到已连接的 \(Self.targetNameFragment)")
            scanForDevices()
            return
        }

        let name = peripheral.name ?? Self.targetNameFragment
        log("✅ 已连接目标设备：\(name)")
        discoveredPeripheral = peripheral
        peripheral.delegate = self
        transition(to: .connecting(deviceName: name))
        centralManager.connect(peripheral, options: nil)
    }

    // MARK: CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn else {
            markBluetoothUnavailable()
            return
        }

        retrieveConnectedDevices()
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let name = peripheral.name ?? "未知设备"
        guard Self.isTargetDeviceName(peripheral.name) else {
            log("忽略非目标设备：\(name)")
            return
        }

        debugLog.removeAll()
        log("✅ 找到目标设备：\(name)，开始连接...")
        stopScanning()
        discoveredPeripheral = peripheral
        peripheral.delegate = self
        transition(to: .connecting(deviceName: name))
        centralManager.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        let name = peripheral.name ?? Self.targetNameFragment
        transition(to: .discoveringServices(deviceName: name))
        log("✅ 已连接设备：\(name)")
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

    // MARK: CBPeripheralDelegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            log("服务发现失败：\(error.localizedDescription)")
            transition(to: .failure(message: "车辆控制模块未就绪"))
            return
        }

        guard let service = peripheral.services?.first(where: { $0.uuid == serviceUUID }) else {
            log("未发现 FFF0 服务")
            transition(to: .failure(message: "车辆控制模块未就绪"))
            return
        }

        log("🔍 发现目标服务 UUID: \(service.uuid.uuidString)")
        peripheral.discoverCharacteristics(nil, for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard service.uuid == serviceUUID else {
            log("忽略非目标服务：\(service.uuid.uuidString)")
            return
        }

        if let error {
            log("特征发现失败：\(error.localizedDescription)")
            transition(to: .failure(message: "车辆控制模块未就绪"))
            return
        }

        guard let characteristic = service.characteristics?.first(where: {
            $0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse)
        }) else {
            log("FFF0 服务中没有可写特征")
            transition(to: .failure(message: "车辆控制模块未就绪"))
            return
        }

        log("✅ 发现可写特征：\(characteristic.uuid.uuidString)")
        targetCharacteristic = characteristic
        transition(to: .ready(deviceName: peripheral.name ?? Self.targetNameFragment))
    }

    // MARK: 指令发送

    func send(_ command: VehicleCommand) {
        guard case let .ready(deviceName) = controlState,
              let peripheral = discoveredPeripheral,
              let characteristic = targetCharacteristic else {
            publish(.failed(command, message: "请先连接目标车辆"))
            return
        }

        guard let data = command.rawValue.data(using: .utf8) else {
            publish(.failed(command, message: "指令编码失败"))
            return
        }

        pendingCommand = command
        transition(to: .sending(command: command, deviceName: deviceName))
        let type: CBCharacteristicWriteType = characteristic.properties.contains(.write) ? .withResponse : .withoutResponse
        peripheral.writeValue(data, for: characteristic, type: type)
        log("📤 写入指令到特征 \(characteristic.uuid.uuidString)：\(command.rawValue)")

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
        guard Self.shouldCompleteCommand(
            command,
            pendingCommand: pendingCommand,
            controlState: controlState,
            bluetoothPoweredOn: centralManager.state == .poweredOn
        ) else {
            pendingCommand = nil
            return
        }

        pendingCommand = nil
        publish(result)
        transition(to: .ready(deviceName: deviceName))
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic === targetCharacteristic,
              let command = pendingCommand else { return }

        let deviceName = controlState.deviceName ?? peripheral.name ?? Self.targetNameFragment
        if let error {
            log("❌ 写入失败：\(error.localizedDescription)")
            complete(
                command,
                result: .failed(command, message: "指令发送失败"),
                deviceName: deviceName
            )
        } else {
            log("✅ 写入成功：\(characteristic.uuid.uuidString)")
            complete(command, result: .sent(command), deviceName: deviceName)
        }
    }
}
