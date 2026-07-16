import SwiftUI

struct VehicleHeroView: View {
    let state: VehicleControlState
    let lastResult: VehicleCommandResult?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var showsOpenTrunk: Bool {
        lastResult == .sent(.trunk)
    }

    var body: some View {
        ZStack {
            if state.isReady {
                Ellipse()
                    .fill(VehicleControlTheme.ready.opacity(0.12))
                    .frame(width: 220, height: 280)
                    .blur(radius: 28)
            }

            Image(showsOpenTrunk ? "VehicleTopTrunkOpen" : "VehicleTop")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 230, maxHeight: 310)
                .opacity(state == .disconnected ? 0.42 : 1)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.22), value: showsOpenTrunk)

            if showsOpenTrunk {
                Ellipse()
                    .fill(VehicleControlTheme.accent.opacity(0.5))
                    .frame(width: 150, height: 64)
                    .blur(radius: 18)
                    .offset(y: 118)
                    .transition(.opacity)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 300)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(showsOpenTrunk ? "车辆俯视图，尾箱指令已发送" : "车辆俯视图")
    }
}
