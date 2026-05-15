// Budget365WidgetProvider.swift
// TimelineProvider — fetch dati dall'API e crea la timeline per il widget

import WidgetKit
import SwiftUI
import UIKit

struct Budget365Entry: TimelineEntry {
    let date: Date
    let saldo: Double
    let entrateMese: Double
    let speseMese: Double
    let mese: String
    let anno: Int
    let transazioni: [WidgetTransazione]
    let error: String?
    let isPlaceholder: Bool
    let isLoggedIn: Bool

    static let placeholder = Budget365Entry(
        date: Date(),
        saldo: 0,
        entrateMese: 0,
        speseMese: 0,
        mese: "",
        anno: Calendar.current.component(.year, from: Date()),
        transazioni: [],
        error: nil,
        isPlaceholder: true,
        isLoggedIn: true
    )

    static let notLoggedIn = Budget365Entry(
        date: Date(),
        saldo: 0,
        entrateMese: 0,
        speseMese: 0,
        mese: "",
        anno: Calendar.current.component(.year, from: Date()),
        transazioni: [],
        error: nil,
        isPlaceholder: false,
        isLoggedIn: false
    )
}

struct WidgetTransazione: Identifiable {
    let id: String
    let tipo: String   // "spesa" o "entrata"
    let importo: Double
    let categoria: String
    let descrizione: String
}

// MARK: - Response API
struct WidgetRiepilogoResponse: Codable {
    let success: Bool
    let saldo: Double?
    let entrateMese: Double?
    let speseMese: Double?
    let mese: String?
    let anno: Int?
    let ultimeTransazioni: [TransazioneDTO]?
    let error: String?
}

struct TransazioneDTO: Codable {
    let id: String
    let tipo: String
    let importo: Double
    let categoria: String
    let descrizione: String
}

struct Budget365WidgetProvider: TimelineProvider {

    private let apiBaseURL = "https://budget-app-ios-backend.onrender.com"
    private let appGroupID = "group.com.budget365.sharing"

    // MARK: - UserDefaults condiviso
    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    private var authToken: String? {
        sharedDefaults?.string(forKey: "widget_token")
    }

    private var savedUsername: String? {
        sharedDefaults?.string(forKey: "widget_username")
    }

    // MARK: - Placeholder (design-time)
    func placeholder(in context: Context) -> Budget365Entry {
        Budget365Entry.placeholder
    }

    // MARK: - Snapshot (quick preview)
    func getSnapshot(in context: Context, completion: @escaping (Budget365Entry) -> Void) {
        if context.isPreview {
            completion(Budget365Entry.placeholder)
            return
        }
        fetchRiepilogo { entry in
            completion(entry)
        }
    }

    // MARK: - Timeline (refresh periodico)
    func getTimeline(in context: Context, completion: @escaping (Timeline<Budget365Entry>) -> Void) {
        fetchRiepilogo { entry in
            // Aggiorna ogni 30 minuti (limite standard WidgetKit)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    // MARK: - Fetch dati
    private func fetchRiepilogo(completion: @escaping (Budget365Entry) -> Void) {
        guard let token = authToken, !token.isEmpty else {
            completion(Budget365Entry.notLoggedIn)
            return
        }

        let urlString = "\(apiBaseURL)/api/widget/riepilogo"

        guard let url = URL(string: urlString) else {
            completion(Budget365Entry.placeholder)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(Budget365Entry(
                    date: Date(),
                    saldo: 0,
                    entrateMese: 0,
                    speseMese: 0,
                    mese: "",
                    anno: Calendar.current.component(.year, from: Date()),
                    transazioni: [],
                    error: "Connessione...",
                    isPlaceholder: false,
                    isLoggedIn: true
                ))
                return
            }

            guard let data = data else {
                completion(Budget365Entry(date: Date(), saldo: 0, entrateMese: 0, speseMese: 0, mese: "", anno: Calendar.current.component(.year, from: Date()), transazioni: [], error: "Nessun dato", isPlaceholder: false, isLoggedIn: true))
                return
            }

            do {
                let decoded = try JSONDecoder().decode(WidgetRiepilogoResponse.self, from: data)
                guard decoded.success else {
                    completion(Budget365Entry(date: Date(), saldo: 0, entrateMese: 0, speseMese: 0, mese: "", anno: Calendar.current.component(.year, from: Date()), transazioni: [], error: decoded.error ?? "Errore", isPlaceholder: false, isLoggedIn: true))
                    return
                }

                let transazioni: [WidgetTransazione] = (decoded.ultimeTransazioni ?? []).map { t in
                    WidgetTransazione(id: t.id, tipo: t.tipo, importo: t.importo, categoria: t.categoria, descrizione: t.descrizione)
                }

                let entry = Budget365Entry(
                    date: Date(),
                    saldo: decoded.saldo ?? 0,
                    entrateMese: decoded.entrateMese ?? 0,
                    speseMese: decoded.speseMese ?? 0,
                    mese: decoded.mese ?? "",
                    anno: decoded.anno ?? Calendar.current.component(.year, from: Date()),
                    transazioni: transazioni,
                    error: nil,
                    isPlaceholder: false,
                    isLoggedIn: true
                )
                completion(entry)
            } catch {
                completion(Budget365Entry(date: Date(), saldo: 0, entrateMese: 0, speseMese: 0, mese: "", anno: Calendar.current.component(.year, from: Date()), transazioni: [], error: "Errore dati", isPlaceholder: false, isLoggedIn: true))
            }
        }.resume()
    }
}
