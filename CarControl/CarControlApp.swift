//
//  CarControlApp.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//


import SwiftUI
import CoreBluetooth

@main
struct CarControlApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject var bluetoothVM = BluetoothViewModel()  // ✅ 注入 ViewModel
    
    var body: some Scene {
        WindowGroup {
            if let cmd = AppDelegate.pendingCommand {
                SilentLaunchView(command: cmd)
                    .environmentObject(bluetoothVM)  // ✅ 提供给静默视图
            } else {
                ContentView()
                    .environmentObject(bluetoothVM)  // ✅ 提供给主视图
            }
        }
    }
}

// MARK: - AppDelegate 用于处理外部 URL Scheme 调用
//class AppDelegate: NSObject, UIApplicationDelegate {
//    func application(_ app: UIApplication,
//                     open url: URL,
//                     options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
//        let components = URLComponents(url: url, resolvingAgainstBaseURL: true)
//        if url.host == "send",
//           let cmd = components?.queryItems?.first(where: { $0.name == "cmd" })?.value {
//            NotificationCenter.default.post(name: .bluetoothCommand, object: cmd)
//        }
//        return true
//    }
//}

class AppDelegate: NSObject, UIApplicationDelegate {
    static var pendingCommand: String?  // ✅ 添加这个属性记录
    
    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: true)
        if url.host == "send",
           let cmd = components?.queryItems?.first(where: { $0.name == "cmd" })?.value {
            Self.pendingCommand = cmd  // ✅ 保存等待处理
        }
        return true
    }
}


// MARK: - 全局通知名定义
extension Notification.Name {
    static let bluetoothCommand = Notification.Name("BluetoothCommand")
}
