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

        precondition(BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .lock,
            controlState: .sending(command: .lock, deviceName: "RM3-01"),
            bluetoothPoweredOn: true
        ))
        precondition(!BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .lock,
            controlState: .bluetoothUnavailable,
            bluetoothPoweredOn: false
        ))
        precondition(!BluetoothViewModel.shouldCompleteCommand(
            .lock,
            pendingCommand: .unlock,
            controlState: .sending(command: .unlock, deviceName: "RM3-01"),
            bluetoothPoweredOn: true
        ))

        print("BluetoothTargetPolicyTests passed")
    }
}
