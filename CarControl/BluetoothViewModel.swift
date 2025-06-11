import CoreBluetooth
import Foundation

class BluetoothViewModel: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    @Published var connectionStatus: String = "未连接"
    @Published var isConnected: Bool = false
    @Published var discoveredPeripheral: CBPeripheral?
    @Published var targetCharacteristic: CBCharacteristic?
    @Published var debugLog: [String] = []
    @Published var scanStatus: String = ""
    
    private var isScanning = false
    
    private var centralManager: CBCentralManager!
    private let serviceUUID = CBUUID(string: "FFF0")  // 替换为你的服务 UUID
    
    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
        log("💡 BluetoothViewModel 初始化")
    }
    
    func log(_ message: String) {
        print(message)
        DispatchQueue.main.async {
            self.debugLog.append(message)
        }
    }
    
    // MARK: 蓝牙扫描
    
    func scanForDevices() {

        guard !isConnected else {
                log("⚠️ 已连接设备，跳过扫描")
                scanStatus = "✅ 已连接，跳过扫描"
                return
            }
        
        
        guard !isScanning else {
               log("⚠️ 已在扫描中，跳过重复扫描")
               return
           }
        debugLog.removeAll()
        
        if centralManager.state == .poweredOn {
            isScanning = true
            scanStatus = "🔍 正在扫描..."
            centralManager.scanForPeripherals(withServices: nil, options: nil)
            log("🔍 开始扫描设备...")
            // 30秒后检查是否仍未连接，若是则停止扫描
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                guard let self = self else { return }
                
                if !self.isConnected {
                    self.centralManager.stopScan()
                    self.isScanning = false
                    self.scanStatus = "⏱️ 扫描超时，未连接设备"
                    self.log("⏱️ 扫描超时，已停止扫描")
                }
            }
        } else {
            scanStatus = "❌ 蓝牙未开启"
            log("❌ 蓝牙未开启，无法扫描")
        }
    }
    
    // MARK: 获取已连接设备
    
    func retrieveConnectedDevices() {
        if centralManager.state == .poweredOn {
            let connectedPeripherals = centralManager.retrieveConnectedPeripherals(withServices: [serviceUUID])
            
            if let peripheral = connectedPeripherals.first {
                log("✅ 已连接设备：\(peripheral.name ?? "未知设备")")
                discoveredPeripheral = peripheral
                centralManager.connect(peripheral, options: nil)
                scanStatus = "✅ 已连接，停止扫描"
            } else {
                log("❌ 没有找到已连接的设备")
                scanStatus = "❌ 未连接，准备扫描..."
                scanForDevices()
            }
        } else {
            log("❌ 蓝牙未开启，无法获取已连接设备")
        }
    }
    
    // MARK: CBCentralManagerDelegate
    
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            log("✅ 蓝牙已开启，开始获取已连接设备...")
            retrieveConnectedDevices() // 获取已连接设备
        } else {
            log("❌ 蓝牙未开启")
        }
    }
    
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? "未知设备"
        connectionStatus = "等待连接"
        if name.contains("RM3") { // 根据需要匹配设备名称
            debugLog.removeAll()
            log("✅ 找到目标设备：\(name)，开始连接...")
            centralManager.stopScan()
            isScanning = false
            scanStatus = "✅ 已连接，停止扫描"
            discoveredPeripheral = peripheral
            peripheral.delegate = self
            centralManager.connect(peripheral, options: nil)
        }
      
        log("发现设备：\(name)\n广告数据：\(advertisementData)\nRSSI 值：\(RSSI)")
        
    }
    
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connectionStatus = "连接成功"
        scanStatus = "✅ 已连接：\(peripheral.name ?? "未知设备")"
        isConnected = true
        log("✅ 已连接设备：\(peripheral.name ?? "未知设备")")
        peripheral.delegate = self
        peripheral.discoverServices([serviceUUID])
    }
    
    // MARK: CBPeripheralDelegate
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let services = peripheral.services {
            for service in services {
                log("🔍 发现服务 UUID: \(service.uuid.uuidString)")
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let characteristics = service.characteristics {
            for characteristic in characteristics {
                log("👉 发现特征 UUID: \(characteristic.uuid.uuidString)")
                
                if characteristic.properties.contains(.write) || characteristic.properties.contains(.writeWithoutResponse) {
                    log("✅ 发现可写特征：\(characteristic.uuid.uuidString)")
                    self.targetCharacteristic = characteristic
                    connectionStatus = "准备就绪：\(peripheral.name ?? "未知设备")"
                } else {
                    log("ℹ️ 非可写特征：\(characteristic.uuid.uuidString) - 属性：\(characteristic.properties)")
                }
            }
        }
    }
    
    // MARK: 指令发送
    
    func sendCommand(_ command: String) {
        let formatted = command
        log("🔵 准备发送指令：\(formatted.trimmingCharacters(in: .whitespacesAndNewlines))")
        
        guard let peripheral = discoveredPeripheral else {
            log("❌ 发送失败：未连接到设备")
            return
        }
        
        guard let characteristic = targetCharacteristic else {
            log("❌ 发送失败：未发现可写入的特征")
            return
        }
        
        guard let data = formatted.data(using: .utf8) else {
            log("❌ 发送失败：无法将指令转换为数据")
            return
        }
        
        let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.write) ? .withResponse : .withoutResponse
        peripheral.writeValue(data, for: characteristic, type: writeType)
        log("📤 写入指令到特征 \(characteristic.uuid.uuidString)：\(formatted.trimmingCharacters(in: .whitespacesAndNewlines))（方式：\(writeType == .withResponse ? "withResponse" : "withoutResponse")）")
    }
    
    // MARK: 写入回调（可选）
    
    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            log("❌ 写入失败：\(error.localizedDescription)")
        } else {
            log("✅ 写入成功：\(characteristic.uuid.uuidString)")
        }
    }
}
