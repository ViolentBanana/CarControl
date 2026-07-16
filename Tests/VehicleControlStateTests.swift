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
