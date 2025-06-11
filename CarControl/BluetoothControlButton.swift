//
//  BluetoothControlButton.swift
//  CarControl
//
//  Created by CHEN on 2025/6/3.
//
import SwiftUI

struct BluetoothControlButton: View {
    let title: String
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: {
            action()
        }) {
            Text(title)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isEnabled ? Color.blue : Color.gray)
                .foregroundColor(.white)
                .cornerRadius(10)
        }
        .disabled(!isEnabled)
    }
}
