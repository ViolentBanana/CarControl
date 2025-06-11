//
//  CarControlWidgetEntryView.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//

import WidgetKit
import SwiftUI

struct CarControlWidgetEntryView: View {
    var entry: SimpleEntry

    var body: some View {
        HStack(spacing: 12) {
            WidgetButton(label: "尾箱", command: "MCK")
            WidgetButton(label: "开锁", command: "MCF")
            WidgetButton(label: "锁门", command: "MSF")
        }
        .padding()
    }

    func WidgetButton(label: String, command: String) -> some View {
        Link(destination: URL(string: "carcontrol://send?cmd=\(command)")!) {
            Text(label)
                .font(.headline)
                .frame(width: 60, height: 60)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
        }
    }
}
