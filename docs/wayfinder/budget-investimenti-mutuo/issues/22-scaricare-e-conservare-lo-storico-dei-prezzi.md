# Scaricare e conservare lo storico dei prezzi

Type: task
Status: open
Blocked by: 21

## Question

Che cosa fare: costruire il pezzo che oggi **non esiste affatto** — nessuno storico dei prezzi è conservato da nessuna parte.

Dal biglietto «Lo storico dei prezzi dei titoli» (la ricerca è chiusa, lì c'è il dettaglio):

- `server/models/PriceHistory.js`: una riga per **ticker e mese** — `{ ticker, month: 'AAAA-MM', close, adjClose, currency, source, fetchedAt }`, indice unico `{ticker, month}` (upsert idempotente e additivo), collezione **globale** come `Instrument`, non per utente: il prezzo non appartiene all'utente, e moltiplicarlo per utente moltiplicherebbe le richieste a Yahoo. La chiave `'AAAA-MM'` è la stessa dell'asse dei grafici in `server/services/patrimonio.js` (`chiaveMese`, `MESE_ROMA`), così la serie si aggancia all'asse senza aritmetica sulle date; nel repo convivono due convenzioni di mese (Fotografia 0-indexata, `SavingsMonth` apparentemente 1-indexata) e la stringa le evita entrambe.
- il lettore: backfill `?range=max&interval=1mo&events=div%2Csplit` una volta per ticker; aggiornamento `?range=3mo&interval=1mo` con TTL 12–24 h; il **mese in corso non si chiede** (è quantità × `regularMarketPrice`, già nella cache dei 15 minuti).
- le trappole di forma: timestamp in secondi, array allineati per indice, `null` da scartare in coppia, `chart.error` da controllare **anche** quando arriva HTTP 200.
- la robustezza: `AbortSignal.timeout(5–8 s)`, controllo di `response.ok` e `Content-Type` **prima** di `json()`, backoff con jitter sul 429 (l'IP di uscita di Render è condiviso), cache negativa 24 h per i ticker inesistenti, concorrenza 2–3 con mutex per ticker, e — sempre — servire il dato conservato invece di un errore.
- nessun cron e nessuna chiamata di rete dentro `calcolaPatrimonio`: aggiornamento in lettura con TTL su una rotta separata, più un gesto esplicito «aggiorna i prezzi».
- la valuta **su ogni riga** (`meta.currency`), con la trappola `GBp` = pence.
- la valuta dello strumento resta quella del prezzo: la conversione in euro (biglietto «Un titolo in un'altra valuta dentro un conto in euro») si fa in lettura, con i cambi conservati a parte.

Verifica: un backfill vero su tre o quattro ticker reali (uno europeo, uno americano) e il confronto con i prezzi che mostra l'intermediario; poi un secondo giro di aggiornamento e la prova che l'upsert è **additivo** (nessuna riga persa, nessun `0` scritto, nessuna serie cancellata); `node --check`, `npm run build`.

## Answer

<!-- da scrivere alla chiusura -->
