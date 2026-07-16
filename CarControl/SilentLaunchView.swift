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
    @State private var pendingVehicleCommand: VehicleCommand?
    @Environment(\.scenePhase) var scenePhase

    var body: some View {
        Color.clear
            .onAppear {
                pendingVehicleCommand = VehicleCommand(rawValue: command)
                bluetoothVM.connectToVehicle()
                sendWhenReady()
                AppDelegate.pendingCommand = nil
            }
            .onChange(of: bluetoothVM.controlState) { _, _ in
                sendWhenReady()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background && isSent {
                    exit(0)  // ✅ 完成后关闭 App（可选）
                }
            }
    }

    private func sendWhenReady() {
        guard !isSent,
              bluetoothVM.controlState.isReady,
              let pendingVehicleCommand else { return }
        bluetoothVM.send(pendingVehicleCommand)
        isSent = true
    }
}
