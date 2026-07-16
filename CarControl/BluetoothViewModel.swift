import CoreBluetooth
import Foundation

class BluetoothViewModel: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private struct PendingCommand {
        let token: UUID
        let command: VehicleCommand
    }

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
    private var pendingCommand: PendingCommand?
    private var commandResultPublicationToken: UUID?
    private var scanGeneration = 0
    private var connectionGeneration = 0
    private var activeConnectionGeneration: Int?
    private var expectedPeripheralID: UUID?
    private var peripheralConnectionGenerations: [UUID: Int] = [:]

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

    static func canStartScan(controlState: VehicleControlState, isScanning: Bool) -> Bool {
        guard !isScanning else { return false }

        switch controlState {
        case .bluetoothUnavailable, .disconnected, .failure:
            return true
        default:
            return false
        }
    }

    static func canHandleDisconnect(controlState: VehicleControlState) -> Bool {
        switch controlState {
        case .discoveringServices, .ready, .sending:
            return true
        default:
            return false
        }
    }

    static func shouldAcceptPeripheralCallback(
        callbackPeripheralID: UUID,
        expectedPeripheralID: UUID?,
        callbackGeneration: Int?,
        activeGeneration: Int?,
        bluetoothPoweredOn: Bool
    ) -> Bool {
        bluetoothPoweredOn
            && callbackPeripheralID == expectedPeripheralID
            && callbackGeneration != nil
            && callbackGeneration == activeGeneration
    }

    static func shouldHandleOperation(scheduledToken: UUID, activeToken: UUID?) -> Bool {
        scheduledToken == activeToken
    }

    static func shouldResetConnectionAfterCommandTimeout(
        scheduledToken: UUID,
        activeToken: UUID?
    ) -> Bool {
        shouldHandleOperation(scheduledToken: scheduledToken, activeToken: activeToken)
    }

    static func shouldCompleteCommand(
        _ command: VehicleCommand,
        pendingCommand: VehicleCommand?,
        scheduledToken: UUID,
        pendingToken: UUID?,
        controlState: VehicleControlState,
        bluetoothPoweredOn: Bool
    ) -> Bool {
        guard bluetoothPoweredOn,
              pendingCommand == command,
              shouldHandleOperation(scheduledToken: scheduledToken, activeToken: pendingToken),
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

    private func beginConnection(to peripheral: CBPeripheral, deviceName: String) {
        stopScanning()
        connectionGeneration += 1
        let generation = connectionGeneration
        activeConnectionGeneration = generation
        expectedPeripheralID = peripheral.identifier
        peripheralConnectionGenerations = [peripheral.identifier: generation]
        targetCharacteristic = nil
        pendingCommand = nil
        discoveredPeripheral = peripheral
        peripheral.delegate = self
        transition(to: .connecting(deviceName: deviceName))
        centralManager.connect(peripheral, options: nil)
    }

    private func invalidateConnection(cancelPeripheral: Bool) {
        let peripheral = discoveredPeripheral
        peripheral?.delegate = nil
        if cancelPeripheral,
           centralManager?.state == .poweredOn,
           let peripheral {
            centralManager?.cancelPeripheralConnection(peripheral)
        }

        connectionGeneration += 1
        activeConnectionGeneration = nil
        expectedPeripheralID = nil
        peripheralConnectionGenerations.removeAll()
        targetCharacteristic = nil
        discoveredPeripheral = nil
        pendingCommand = nil
    }

    private func acceptsCallback(from peripheral: CBPeripheral) -> Bool {
        Self.shouldAcceptPeripheralCallback(
            callbackPeripheralID: peripheral.identifier,
            expectedPeripheralID: expectedPeripheralID,
            callbackGeneration: peripheralConnectionGenerations[peripheral.identifier],
            activeGeneration: activeConnectionGeneration,
            bluetoothPoweredOn: centralManager.state == .poweredOn
        )
    }

    private func markBluetoothUnavailable() {
        stopScanning()
        invalidateConnection(cancelPeripheral: true)
        transition(to: .bluetoothUnavailable)
    }

    private func failConnection(message: String) {
        invalidateConnection(cancelPeripheral: true)
        transition(to: .failure(message: message))
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
        commandResultPublicationToken = nil
        lastCommandResult = nil
    }

    private func publish(_ result: VehicleCommandResult) {
        let publicationToken = UUID()
        commandResultPublicationToken = publicationToken
        lastCommandResult = result

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self else { return }
            guard Self.shouldHandleOperation(
                scheduledToken: publicationToken,
                activeToken: self.commandResultPublicationToken
            ) else { return }
            self.clearCommandResult()
        }
    }

    // MARK: 蓝牙扫描

    func scanForDevices() {
        guard centralManager.state == .poweredOn else {
            markBluetoothUnavailable()
            log("❌ 蓝牙未开启，无法扫描")
            return
        }

        guard Self.canStartScan(controlState: controlState, isScanning: isScanning) else {
            log("⚠️ 当前状态不允许扫描，跳过重复请求")
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

        switch controlState {
        case .scanning, .connecting, .discoveringServices, .ready, .sending:
            return
        default:
            break
        }

        let connectedPeripherals = centralManager.retrieveConnectedPeripherals(withServices: [serviceUUID])
        guard let peripheral = connectedPeripherals.first(where: { Self.isTargetDeviceName($0.name) }) else {
            log("❌ 没有找到已连接的 \(Self.targetNameFragment)")
            scanForDevices()
            return
        }

        let name = peripheral.name ?? Self.targetNameFragment
        log("✅ 已连接目标设备：\(name)")
        beginConnection(to: peripheral, deviceName: name)
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
        guard central.state == .poweredOn,
              controlState == .scanning,
              isScanning else {
            log("忽略过期的扫描回调：\(peripheral.identifier)")
            return
        }

        let name = peripheral.name ?? "未知设备"
        guard Self.isTargetDeviceName(peripheral.name) else {
            log("忽略非目标设备：\(name)")
            return
        }

        debugLog.removeAll()
        log("✅ 找到目标设备：\(name)，开始连接...")
        beginConnection(to: peripheral, deviceName: name)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard acceptsCallback(from: peripheral),
              case .connecting = controlState else {
            log("忽略过期的连接成功回调：\(peripheral.identifier)")
            return
        }

        let name = peripheral.name ?? Self.targetNameFragment
        transition(to: .discoveringServices(deviceName: name))
        log("✅ 已连接设备：\(name)")
        peripheral.delegate = self
        peripheral.discoverServices([serviceUUID])
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard central.state == .poweredOn else {
            markBluetoothUnavailable()
            return
        }

        guard acceptsCallback(from: peripheral),
              Self.canHandleDisconnect(controlState: controlState) else {
            log("忽略过期的断开回调：\(peripheral.identifier)")
            return
        }

        invalidateConnection(cancelPeripheral: false)
        transition(to: .disconnected)
        if let error { log("连接断开：\(error.localizedDescription)") }
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard central.state == .poweredOn else {
            markBluetoothUnavailable()
            return
        }

        guard acceptsCallback(from: peripheral),
              case .connecting = controlState else {
            log("忽略过期的连接失败回调：\(peripheral.identifier)")
            return
        }

        invalidateConnection(cancelPeripheral: false)
        transition(to: .failure(message: "连接目标车辆失败"))
        if let error { log("连接失败：\(error.localizedDescription)") }
    }

    // MARK: CBPeripheralDelegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard acceptsCallback(from: peripheral),
              case .discoveringServices = controlState else {
            log("忽略过期的服务发现回调：\(peripheral.identifier)")
            return
        }

        if let error {
            log("服务发现失败：\(error.localizedDescription)")
            failConnection(message: "车辆控制模块未就绪")
            return
        }

        guard let service = peripheral.services?.first(where: { $0.uuid == serviceUUID }) else {
            log("未发现 FFF0 服务")
            failConnection(message: "车辆控制模块未就绪")
            return
        }

        log("🔍 发现目标服务 UUID: \(service.uuid.uuidString)")
        peripheral.discoverCharacteristics(nil, for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard acceptsCallback(from: peripheral),
              case .discoveringServices = controlState else {
            log("忽略过期的特征发现回调：\(peripheral.identifier)")
            return
        }

        guard service.uuid == serviceUUID else {
            log("忽略非目标服务：\(service.uuid.uuidString)")
            return
        }

        if let error {
            log("特征发现失败：\(error.localizedDescription)")
            failConnection(message: "车辆控制模块未就绪")
            return
        }

        guard let characteristic = service.characteristics?.first(where: {
            $0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse)
        }) else {
            log("FFF0 服务中没有可写特征")
            failConnection(message: "车辆控制模块未就绪")
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
              let characteristic = targetCharacteristic,
              acceptsCallback(from: peripheral) else {
            publish(.failed(command, message: "请先连接目标车辆"))
            return
        }

        guard let data = command.rawValue.data(using: .utf8) else {
            publish(.failed(command, message: "指令编码失败"))
            return
        }

        let commandToken = UUID()
        pendingCommand = PendingCommand(token: commandToken, command: command)
        transition(to: .sending(command: command, deviceName: deviceName))
        let type: CBCharacteristicWriteType = characteristic.properties.contains(.write) ? .withResponse : .withoutResponse
        peripheral.writeValue(data, for: characteristic, type: type)
        log("📤 写入指令到特征 \(characteristic.uuid.uuidString)：\(command.rawValue)")

        if type == .withoutResponse {
            complete(command, token: commandToken, result: .sent(command), deviceName: deviceName)
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                guard let self else { return }
                self.handleCommandTimeout(
                    command,
                    token: commandToken
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

    private func handleCommandTimeout(_ command: VehicleCommand, token: UUID) {
        guard Self.shouldResetConnectionAfterCommandTimeout(
            scheduledToken: token,
            activeToken: pendingCommand?.token
        ), Self.shouldCompleteCommand(
            command,
            pendingCommand: pendingCommand?.command,
            scheduledToken: token,
            pendingToken: pendingCommand?.token,
            controlState: controlState,
            bluetoothPoweredOn: centralManager.state == .poweredOn
        ), let peripheral = discoveredPeripheral,
           acceptsCallback(from: peripheral)
        else {
            return
        }

        publish(.failed(command, message: "车辆响应超时"))
        failConnection(message: "车辆响应超时")
    }

    private func complete(
        _ command: VehicleCommand,
        token: UUID,
        result: VehicleCommandResult,
        deviceName: String
    ) {
        guard Self.shouldCompleteCommand(
            command,
            pendingCommand: pendingCommand?.command,
            scheduledToken: token,
            pendingToken: pendingCommand?.token,
            controlState: controlState,
            bluetoothPoweredOn: centralManager.state == .poweredOn
        ), let peripheral = discoveredPeripheral,
           acceptsCallback(from: peripheral)
        else {
            return
        }

        pendingCommand = nil
        publish(result)
        transition(to: .ready(deviceName: deviceName))
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard acceptsCallback(from: peripheral),
              characteristic === targetCharacteristic,
              case .sending = controlState,
              let pendingCommand else { return }

        let deviceName = controlState.deviceName ?? peripheral.name ?? Self.targetNameFragment
        if let error {
            log("❌ 写入失败：\(error.localizedDescription)")
            complete(
                pendingCommand.command,
                token: pendingCommand.token,
                result: .failed(pendingCommand.command, message: "指令发送失败"),
                deviceName: deviceName
            )
        } else {
            log("✅ 写入成功：\(characteristic.uuid.uuidString)")
            complete(
                pendingCommand.command,
                token: pendingCommand.token,
                result: .sent(pendingCommand.command),
                deviceName: deviceName
            )
        }
    }
}
