import SwiftUI

struct VehicleControlButton: View {
    enum Style {
        case primary
        case secondary
    }

    let command: VehicleCommand
    let style: Style
    let isEnabled: Bool
    let isBusy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                if isBusy {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: command.systemImage)
                        .font(style == .primary ? .title2 : .headline)
                }

                Text(command.title)
                    .font(style == .primary ? .headline : .subheadline.weight(.semibold))
            }
            .foregroundStyle(isEnabled ? VehicleControlTheme.primaryText : VehicleControlTheme.secondaryText)
            .frame(width: style == .primary ? 112 : 76, height: style == .primary ? 112 : 76)
            .background(style == .primary && isEnabled ? VehicleControlTheme.accent : VehicleControlTheme.control)
            .clipShape(Circle())
        }
        .buttonStyle(PressScaleButtonStyle())
        .disabled(!isEnabled || isBusy)
        .accessibilityLabel(command.title)
        .accessibilityHint(isEnabled ? "发送车辆控制指令" : "连接 RM3 后可用")
    }
}

private struct PressScaleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .brightness(configuration.isPressed ? -0.06 : 0)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}
