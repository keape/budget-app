// Budget365ShortcutsWidget.swift
// Widget — inserimento rapido: scegli tipo e apri app

import WidgetKit
import SwiftUI

struct Budget365ShortcutsWidget: Widget {
    let kind: String = "com.budget365.widget.shortcuts"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShortcutsTimelineProvider()) { entry in
            Budget365ShortcutsWidgetView(entry: entry)
        }
        .configurationDisplayName("Inserimento Rapido")
        .description("Scegli spesa o entrata e apri l'app per inserire i dettagli.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Timeline Provider (statico)
struct ShortcutsTimelineEntry: TimelineEntry {
    let date: Date
}

struct ShortcutsTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShortcutsTimelineEntry {
        ShortcutsTimelineEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (ShortcutsTimelineEntry) -> Void) {
        completion(ShortcutsTimelineEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShortcutsTimelineEntry>) -> Void) {
        let entry = ShortcutsTimelineEntry(date: Date())
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 24, to: Date()) ?? Date().addingTimeInterval(86400)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}
