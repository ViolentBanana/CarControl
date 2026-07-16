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

    init?(url: URL) {
        guard url.scheme?.lowercased() == "carcontrol",
              url.host?.lowercased() == "send",
              let rawValue = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "cmd" })?
                .value else { return nil }
        self.init(rawValue: rawValue)
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
