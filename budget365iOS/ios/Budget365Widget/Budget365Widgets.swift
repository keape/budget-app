// Budget365Widgets.swift
// WidgetBundle — raggruppa tutti i widget Budget365

import WidgetKit
import SwiftUI

@main
struct Budget365Widgets: WidgetBundle {
    var body: some Widget {
        Budget365Widget()            // Riepilogo mensile (medium)
        Budget365ShortcutsWidget()   // Inserimento rapido (small)
    }
}
