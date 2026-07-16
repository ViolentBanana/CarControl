import SwiftUI

struct DebugLogSheet: View {
    let lines: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if lines.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "wave.3.right")
                                .font(.title2)
                            Text("暂无连接日志")
                                .font(.headline)
                        }
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 180)
                    } else {
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding()
            }
            .background(VehicleControlTheme.background)
            .navigationTitle("连接日志")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
