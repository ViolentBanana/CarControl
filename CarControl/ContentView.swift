import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var bluetoothVM: BluetoothViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsLog = false

    var body: some View {
        ZStack {
            VehicleControlTheme.background
                .ignoresSafeArea()

            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 0) {
                        header

                        resultBanner
                            .padding(.top, 12)

                        VehicleHeroView(
                            state: bluetoothVM.controlState,
                            lastResult: bluetoothVM.lastCommandResult
                        )
                        .contentShape(Rectangle())
                        .gesture(backgroundTapGesture)

                        Spacer(minLength: 12)
                        controls
                    }
                    .frame(minHeight: geometry.size.height)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                    .animation(
                        reduceMotion ? nil : .easeOut(duration: 0.2),
                        value: bluetoothVM.lastCommandResult
                    )
                    .background(gestureSurface)
                }
                .scrollIndicators(.hidden)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showsLog) {
            DebugLogSheet(lines: bluetoothVM.debugLog)
                .presentationDetents([.medium, .large])
        }
        .onAppear {
            bluetoothVM.connectToVehicle()
        }
        .onChange(of: bluetoothVM.lastCommandResult) { result in
            guard let result else { return }

            if result.presentation.isFailure {
                ControlFeedback.failure()
            } else {
                ControlFeedback.success()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    title
                        .fixedSize(horizontal: true, vertical: false)
                    Spacer(minLength: 8)
                    logButton
                        .fixedSize(horizontal: true, vertical: false)
                }

                VStack(alignment: .leading, spacing: 12) {
                    title
                    logButton
                }
            }

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 10) {
                    statusLabel

                    if showsRescanButton {
                        rescanButton
                            .fixedSize(horizontal: true, vertical: false)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    statusLabel

                    if showsRescanButton {
                        rescanButton
                    }
                }
            }
        }
        .padding(.top, 12)
        .background(gestureSurface)
    }

    private var title: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Q60S 控制")
                .font(.title2.bold())
                .foregroundStyle(VehicleControlTheme.primaryText)

            Text("RM3")
                .font(.caption.weight(.semibold))
                .foregroundStyle(VehicleControlTheme.secondaryText)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(VehicleControlTheme.elevated)
                .clipShape(Capsule())
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
        .contentShape(Rectangle())
        .gesture(backgroundTapGesture)
    }

    private var logButton: some View {
        Button {
            showsLog = true
        } label: {
            Label("日志", systemImage: "list.bullet.rectangle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(VehicleControlTheme.primaryText)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(VehicleControlTheme.elevated)
                .clipShape(Capsule())
        }
        .accessibilityHint("打开连接日志")
    }

    private var statusLabel: some View {
        HStack(alignment: .center, spacing: 10) {
            if bluetoothVM.controlState.isReady {
                Circle()
                    .fill(VehicleControlTheme.ready)
                    .frame(width: 8, height: 8)
                    .accessibilityHidden(true)
            }

            Text(bluetoothVM.controlState.statusText)
                .font(.subheadline)
                .foregroundStyle(VehicleControlTheme.secondaryText)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .gesture(backgroundTapGesture)
    }

    private var rescanButton: some View {
        Button("重新扫描") {
            bluetoothVM.connectToVehicle()
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(VehicleControlTheme.primaryText)
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(VehicleControlTheme.elevated)
        .clipShape(Capsule())
        .accessibilityHint("搜索并连接 RM3")
    }

    @ViewBuilder
    private var resultBanner: some View {
        if let result = bluetoothVM.lastCommandResult {
            let presentation = result.presentation

            HStack(spacing: 8) {
                Image(systemName: presentation.systemImage)
                    .accessibilityHidden(true)

                Text(presentation.message)
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .foregroundStyle(presentation.isFailure ? VehicleControlTheme.accent : VehicleControlTheme.ready)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .background(VehicleControlTheme.elevated)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .contentShape(Rectangle())
            .gesture(backgroundTapGesture)
        }
    }

    private var controls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 24) {
                commandButton(.unlock, style: .secondary)
                commandButton(.lock, style: .primary)
                commandButton(.trunk, style: .secondary)
            }

            VStack(spacing: 20) {
                commandButton(.lock, style: .primary)

                HStack(alignment: .center, spacing: 36) {
                    commandButton(.unlock, style: .secondary)
                    commandButton(.trunk, style: .secondary)
                }
            }

            VStack(spacing: 20) {
                commandButton(.lock, style: .primary)
                commandButton(.unlock, style: .secondary)
                commandButton(.trunk, style: .secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(gestureSurface)
    }

    private var showsRescanButton: Bool {
        switch bluetoothVM.controlState {
        case .disconnected, .failure:
            return true
        default:
            return false
        }
    }

    private var backgroundTapGesture: some Gesture {
        TapGesture(count: 2)
            .exclusively(before: TapGesture(count: 1))
            .onEnded { value in
                switch value {
                case .first:
                    showsLog.toggle()
                case .second:
                    guard !bluetoothVM.controlState.isReady else { return }
                    bluetoothVM.connectToVehicle()
                }
            }
    }

    private var gestureSurface: some View {
        Color.clear
            .contentShape(Rectangle())
            .gesture(backgroundTapGesture)
    }

    private func commandButton(
        _ command: VehicleCommand,
        style: VehicleControlButton.Style
    ) -> some View {
        VehicleControlButton(
            command: command,
            style: style,
            isEnabled: bluetoothVM.controlState.isReady,
            isBusy: bluetoothVM.controlState.sendingCommand == command
        ) {
            bluetoothVM.send(command)
        }
    }
}

private extension VehicleCommandResult {
    var presentation: CommandResultPresentation {
        switch self {
        case let .sent(command):
            return CommandResultPresentation(
                isFailure: false,
                message: "\(command.title)指令已发送",
                systemImage: "checkmark.circle.fill"
            )
        case let .failed(command, message):
            return CommandResultPresentation(
                isFailure: true,
                message: "\(command.title)失败：\(message)",
                systemImage: "exclamationmark.circle.fill"
            )
        }
    }
}

private struct CommandResultPresentation {
    let isFailure: Bool
    let message: String
    let systemImage: String
}
