//
//  SilentLaunchView.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//

import SwiftUI

struct SilentLaunchView: View {
    @EnvironmentObject var bluetoothVM: BluetoothViewModel
    let command: VehicleCommand
    let onSent: () -> Void

    @State private var isSent = false

    var body: some View {
        Color.clear
            .onAppear {
                bluetoothVM.connectToVehicle()
                sendWhenReady()
            }
            .onChange(of: bluetoothVM.controlState) { _ in
                sendWhenReady()
            }
    }

    private func sendWhenReady() {
        guard !isSent,
              bluetoothVM.controlState.isReady else { return }
        isSent = true
        bluetoothVM.send(command)
        onSent()
    }
}
