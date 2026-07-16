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

    @ScaledMetric(relativeTo: .headline) private var primaryDiameter: CGFloat = 112
    @ScaledMetric(relativeTo: .subheadline) private var secondaryDiameter: CGFloat = 76
    @ScaledMetric(relativeTo: .body) private var contentSpacing: CGFloat = 8

    private var diameter: CGFloat {
        style == .primary ? primaryDiameter : secondaryDiameter
    }

    private var accessibilityHint: String {
        if isBusy {
            return "正在发送\(command.title)"
        }

        return isEnabled ? "发送车辆控制指令" : "连接 RM3 后可用"
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: contentSpacing) {
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
            .frame(width: diameter, height: diameter)
            .background(style == .primary && isEnabled ? VehicleControlTheme.accent : VehicleControlTheme.control)
            .clipShape(Circle())
        }
        .buttonStyle(PressScaleButtonStyle())
        .disabled(!isEnabled || isBusy)
        .accessibilityLabel(command.title)
        .accessibilityHint(accessibilityHint)
    }
}

private struct PressScaleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .brightness(configuration.isPressed ? -0.06 : 0)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}
