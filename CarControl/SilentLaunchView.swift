//
//  SilentLaunchView.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//

import SwiftUI

struct SilentLaunchView: View {
    @EnvironmentObject var bluetoothVM: BluetoothViewModel
    let command: String

    @State private var isSent = false
    @Environment(\.scenePhase) var scenePhase

    var body: some View {
        Color.clear
            .onAppear {
                // 如果未连接，则尝试连接
                if !bluetoothVM.isConnected {
                    bluetoothVM.retrieveConnectedDevices()
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    bluetoothVM.sendCommand(command)
                    isSent = true
                }

                // 清除 pendingCommand 防止重复
                AppDelegate.pendingCommand = nil
            }
            .onChange(of: scenePhase) { phase in
                if phase == .background && isSent {
                    exit(0)  // ✅ 完成后关闭 App（可选）
                }
            }
    }
}
