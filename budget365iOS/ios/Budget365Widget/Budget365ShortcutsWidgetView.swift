// Budget365ShortcutsWidgetView.swift
// UI del widget — due bottoni grandi e puliti

import WidgetKit
import SwiftUI

struct Budget365ShortcutsWidgetView: View {
    let entry: ShortcutsTimelineEntry

    var body: some View {
        VStack(spacing: 10) {
            Link(destination: URL(string: "budget365://add?type=spesa")!) {
                Label("Spesa", systemImage: "minus.circle.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.red.opacity(0.12))
                    .cornerRadius(14)
            }

            Link(destination: URL(string: "budget365://add?type=entrata")!) {
                Label("Entrata", systemImage: "plus.circle.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.green)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.green.opacity(0.12))
                    .cornerRadius(14)
            }
        }
        .padding(12)
    }
}
