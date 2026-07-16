import Foundation

@main
enum VehicleControlStateTests {
    static func main() {
        precondition(VehicleCommand.trunk.rawValue == "MCK")
        precondition(VehicleCommand.unlock.rawValue == "MCF")
        precondition(VehicleCommand.lock.rawValue == "MSF")

        precondition(VehicleCommand(url: URL(string: "carcontrol://send?cmd=MSF")!) == .lock)
        precondition(VehicleCommand(url: URL(string: "carcontrol://send?cmd=MCF")!) == .unlock)
        precondition(VehicleCommand(url: URL(string: "carcontrol://send?cmd=MCK")!) == .trunk)
        precondition(VehicleCommand(url: URL(string: "carcontrol://other?cmd=MSF")!) == nil)
        precondition(VehicleCommand(url: URL(string: "https://send?cmd=MSF")!) == nil)
        precondition(VehicleCommand(url: URL(string: "carcontrol://send?cmd=UNKNOWN")!) == nil)

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
