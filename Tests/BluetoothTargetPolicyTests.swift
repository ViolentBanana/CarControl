import Foundation

@main
enum BluetoothTargetPolicyTests {
    static func main() {
        precondition(BluetoothViewModel.isTargetDeviceName("RM3"))
        precondition(BluetoothViewModel.isTargetDeviceName("rm3-vehicle"))
        precondition(BluetoothViewModel.isTargetDeviceName("Vehicle-RM3-01"))
        precondition(!BluetoothViewModel.isTargetDeviceName("RM2"))
        precondition(!BluetoothViewModel.isTargetDeviceName("Unknown Device"))
        precondition(!BluetoothViewModel.isTargetDeviceName(nil))

        let connectedDeviceNames = ["RM0-LOCK", "RM3-BleKEY"]
        precondition(
            BluetoothViewModel.firstConnectedPeripheral(from: connectedDeviceNames)
                == "RM0-LOCK"
        )
        precondition(
            BluetoothViewModel.firstConnectedPeripheral(from: [String]()) == nil
        )

        precondition(BluetoothViewModel.shouldHandleScanTimeout(
            scheduledGeneration: 2,
            currentGeneration: 2,
            isScanning: true
        ))
        precondition(!BluetoothViewModel.shouldHandleScanTimeout(
            scheduledGeneration: 1,
            currentGeneration: 2,
            isScanning: true
        ))
        precondition(!BluetoothViewModel.shouldHandleScanTimeout(
            scheduledGeneration: 2,
            currentGeneration: 2,
            isScanning: false
        ))

        precondition(BluetoothViewModel.canStartScan(
            controlState: .disconnected,
            isScanning: false
        ))
        precondition(!BluetoothViewModel.canStartScan(
            controlState: .connecting(deviceName: "RM3-01"),
            isScanning: false
        ))
        precondition(!BluetoothViewModel.canStartScan(
            controlState: .scanning,
            isScanning: true
        ))
        precondition(BluetoothViewModel.canHandleDisconnect(
            controlState: .ready(deviceName: "RM3-01")
        ))
        precondition(BluetoothViewModel.canHandleDisconnect(
            controlState: .sending(command: .lock, deviceName: "RM3-01")
        ))
        precondition(!BluetoothViewModel.canHandleDisconnect(
            controlState: .connecting(deviceName: "RM3-01")
        ))
        precondition(!BluetoothViewModel.canHandleDisconnect(
            controlState: .bluetoothUnavailable
        ))

        let expectedPeripheralID = UUID()
        let otherPeripheralID = UUID()
        precondition(BluetoothViewModel.shouldAcceptPeripheralCallback(
            callbackPeripheralID: expectedPeripheralID,
            expectedPeripheralID: expectedPeripheralID,
            callbackGeneration: 3,
            activeGeneration: 3,
            bluetoothPoweredOn: true
        ))
        precondition(!BluetoothViewModel.shouldAcceptPeripheralCallback(
            callbackPeripheralID: otherPeripheralID,
            expectedPeripheralID: expectedPeripheralID,
            callbackGeneration: 3,
            activeGeneration: 3,
            bluetoothPoweredOn: true
        ))
        precondition(!BluetoothViewModel.shouldAcceptPeripheralCallback(
            callbackPeripheralID: expectedPeripheralID,
            expectedPeripheralID: expectedPeripheralID,
            callbackGeneration: 2,
            activeGeneration: 3,
            bluetoothPoweredOn: true
        ))
        precondition(!BluetoothViewModel.shouldAcceptPeripheralCallback(
            callbackPeripheralID: expectedPeripheralID,
            expectedPeripheralID: expectedPeripheralID,
            callbackGeneration: 3,
            activeGeneration: 3,
            bluetoothPoweredOn: false
        ))

        let currentOperationToken = UUID()
        precondition(BluetoothViewModel.shouldHandleOperation(
            scheduledToken: currentOperationToken,
            activeToken: currentOperationToken
        ))
        precondition(!BluetoothViewModel.shouldHandleOperation(
            scheduledToken: UUID(),
            activeToken: currentOperationToken
        ))
        precondition(!BluetoothViewModel.shouldHandleOperation(
            scheduledToken: currentOperationToken,
            activeToken: nil
        ))
        precondition(BluetoothViewModel.shouldResetConnectionAfterCommandTimeout(
            scheduledToken: currentOperationToken,
            activeToken: currentOperationToken
        ))
        precondition(!BluetoothViewModel.shouldResetConnectionAfterCommandTimeout(
            scheduledToken: UUID(),
            activeToken: currentOperationToken
        ))

        precondition(BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .lock,
            scheduledToken: currentOperationToken,
            pendingToken: currentOperationToken,
            controlState: .sending(command: .lock, deviceName: "RM3-01"),
            bluetoothPoweredOn: true
        ))
        precondition(!BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .lock,
            scheduledToken: currentOperationToken,
            pendingToken: currentOperationToken,
            controlState: .bluetoothUnavailable,
            bluetoothPoweredOn: false
        ))
        precondition(!BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .unlock,
            scheduledToken: currentOperationToken,
            pendingToken: currentOperationToken,
            controlState: .sending(command: .unlock, deviceName: "RM3-01"),
            bluetoothPoweredOn: true
        ))
        precondition(!BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .lock,
            scheduledToken: UUID(),
            pendingToken: currentOperationToken,
            controlState: .sending(command: .lock, deviceName: "RM3-01"),
            bluetoothPoweredOn: true
        ))

        print("BluetoothTargetPolicyTests passed")
    }
}
