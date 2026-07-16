//
//  CarControlApp.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//


import SwiftUI

@main
struct CarControlApp: App {
    @StateObject private var bluetoothVM = BluetoothViewModel()
    @State private var pendingCommand: VehicleCommand?
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(bluetoothVM)
                .background {
                    if let pendingCommand {
                        SilentLaunchView(command: pendingCommand) {
                            self.pendingCommand = nil
                        }
                        .environmentObject(bluetoothVM)
                        .id(pendingCommand)
                        .accessibilityHidden(true)
                    }
                }
                .onOpenURL { url in
                    pendingCommand = VehicleCommand(url: url)
                }
            }
        }
}
