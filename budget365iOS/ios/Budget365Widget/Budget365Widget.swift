// Budget365Widget.swift
// Entry point del widget Budget365 — WidgetKit medium con riepilogo mensile

import WidgetKit
import SwiftUI

@main
struct Budget365Widget: Widget {
    let kind: String = "com.budget365.widget.riepilogo"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Budget365WidgetProvider()) { entry in
            Budget365WidgetView(entry: entry)
        }
        .configurationDisplayName("Budget365")
        .description("Riepilogo mensile delle tue finanze.")
        .supportedFamilies([.systemMedium])
    }
}
