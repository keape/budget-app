// Budget365WidgetView.swift
// UI del widget medium — riepilogo mensile con saldo, entrate/uscite e ultime transazioni

import WidgetKit
import SwiftUI

struct Budget365WidgetView: View {
    let entry: Budget365Entry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        if entry.isPlaceholder {
            placeholderView
        } else if !entry.isLoggedIn {
            notLoggedInView
        } else if let error = entry.error {
            errorView(error: error)
        } else {
            contentView
        }
    }

    // MARK: - Placeholder
    private var placeholderView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 120, height: 14)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 80, height: 28)
                Spacer()
            }
            Spacer()
        }
        .padding()
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Non loggato
    private var notLoggedInView: some View {
        VStack(spacing: 8) {
            Image(systemName: "lock.shield")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Accedi per vedere il riepilogo")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Text("Apri l'app Budget365")
                .font(.caption2)
                .foregroundColor(.blue)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Errore / caricamento
    private func errorView(error: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: "cloud.fill")
                .font(.title3)
                .foregroundColor(.secondary)
            Text(error)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Contenuto principale
    private var contentView: some View {
        HStack(alignment: .top, spacing: 0) {
            // Colonna sinistra: saldo + entrate/uscite
            leftColumn
                .frame(width: 120)

            Divider()
                .padding(.vertical, 8)

            // Colonna destra: ultime transazioni
            rightColumn
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(UIColor.systemBackground))
        .widgetURL(URL(string: "budget365://transazioni"))
    }

    // MARK: - Colonna sinistra
    private var leftColumn: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Mese
            Text("\(entry.mese.prefix(3).uppercased()) \(String(entry.anno))")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)

            Spacer().frame(height: 2)

            // Saldo
            Text(formatCurrency(entry.saldo))
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(saldoColor)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer().frame(height: 6)

            // Entrate
            HStack(spacing: 3) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 9))
                    .foregroundColor(.green)
                Text(formatCurrency(entry.entrateMese))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.green)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            // Uscite
            HStack(spacing: 3) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 9))
                    .foregroundColor(.red)
                Text(formatCurrency(entry.speseMese))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            Spacer()
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    // MARK: - Colonna destra
    private var rightColumn: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TRANSAZIONI")
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.secondary)
                .padding(.leading, 10)
                .padding(.top, 2)

            if entry.transazioni.isEmpty {
                VStack {
                    Spacer()
                    Text("Nessuna transazione")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ForEach(Array(entry.transazioni.prefix(3))) { t in
                    transazioneRow(t)
                    if t.id != entry.transazioni.prefix(3).last?.id {
                        Divider()
                            .padding(.leading, 10)
                    }
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // MARK: - Riga transazione
    private func transazioneRow(_ t: WidgetTransazione) -> some View {
        HStack(spacing: 6) {
            // Cerchio colore categoria
            Circle()
                .fill(t.tipo == "entrata" ? Color.green : Color.red)
                .frame(width: 6, height: 6)

            VStack(alignment: .leading, spacing: 1) {
                Text(t.categoria)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                if !t.descrizione.isEmpty {
                    Text(t.descrizione)
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Text(formatCurrency(t.importo))
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(t.tipo == "entrata" ? .green : .red)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.leading, 10)
    }

    // MARK: - Helpers
    private var saldoColor: Color {
        if entry.saldo > 0 { return .green }
        if entry.saldo < 0 { return .red }
        return .primary
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "it_IT")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "€0"
    }
}

// MARK: - Preview
struct Budget365WidgetView_Previews: PreviewProvider {
    static var previews: some View {
        let entry = Budget365Entry(
            date: Date(),
            saldo: 1245.50,
            entrateMese: 3200.00,
            speseMese: 1954.50,
            mese: "Maggio",
            anno: 2026,
            transazioni: [
                WidgetTransazione(id: "1", tipo: "spesa", importo: 45.00, categoria: "Alimentari", descrizione: "Esselunga"),
                WidgetTransazione(id: "2", tipo: "entrata", importo: 2500.00, categoria: "Stipendio", descrizione: "Maggio"),
                WidgetTransazione(id: "3", tipo: "spesa", importo: 120.00, categoria: "Benzina", descrizione: "Eni")
            ],
            error: nil,
            isPlaceholder: false,
            isLoggedIn: true
        )
        Budget365WidgetView(entry: entry)
            .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
