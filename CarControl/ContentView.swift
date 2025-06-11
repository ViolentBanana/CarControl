//
//  ContentView.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var bluetoothVM: BluetoothViewModel
    @State private var showLog = false

    var body: some View {
        GeometryReader { geometry in
            VStack {
                Spacer(minLength: geometry.size.height * 0.1)

                VStack(spacing: 20) {
                    Text("蓝牙状态：\(bluetoothVM.connectionStatus)")
                        .font(.headline)
                    
                    Text(bluetoothVM.scanStatus)
                        .font(.subheadline)
                        .foregroundColor(.gray)

                    BluetoothControlButton(title: "尾箱（MCK）", isEnabled: bluetoothVM.isConnected) {
                        bluetoothVM.sendCommand("MCK")
                    }

                    BluetoothControlButton(title: "开锁（MCF）", isEnabled: bluetoothVM.isConnected) {
                        bluetoothVM.sendCommand("MCF")
                    }

                    BluetoothControlButton(title: "锁门（MSF）", isEnabled: bluetoothVM.isConnected) {
                        bluetoothVM.sendCommand("MSF")
                    }

                    if showLog {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(bluetoothVM.debugLog, id: \.self) { line in
                                    Text(line)
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .frame(maxHeight: 200)
                        .background(Color(UIColor.systemGray6))
                        .cornerRadius(8)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                }
                .padding(.horizontal)

                Spacer()
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .contentShape(Rectangle()) // 让整个区域响应点击
            .gesture(
                TapGesture(count: 1)
                    .onEnded {
                        bluetoothVM.scanForDevices()
                    }
                    .simultaneously(with:
                        TapGesture(count: 2)
                            .onEnded {
                                withAnimation {
                                    showLog.toggle()
                                }
                            }
                    )
            )
            .onAppear {
                bluetoothVM.retrieveConnectedDevices()
                NotificationCenter.default.addObserver(forName: .bluetoothCommand, object: nil, queue: .main) { notification in
                    if let cmd = notification.object as? String {
                        bluetoothVM.sendCommand(cmd)
                    }
                }
            }
        }
    }
}
