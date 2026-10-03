# Piano — il mutuo, il bene collegato e la quota di possesso

Disegno deciso in sessione: vedi `GLOSSARY.md` (lessico) e `docs/adr/0012`–`0020`. Qui c'è solo **cosa fare**, in che ordine, e come si verifica ogni passo.

## Cosa esiste già e va riusato (non riscritto)

| Pezzo | Dove | Stato |
| --- | --- | --- |
| Residuo di un Debito = opposto della somma dei Movimenti | `server/services/patrimonio.js` (`valoreComponente`, `serieCumulata`) | fatto (ADR-0011) |
| Rata divisa in Quota interessi (Spesa) e Quota capitale (Trasferimento) | `server/routes/debiti.js` `POST /api/debiti/:id/rate` | fatto (ADR-0004) |
| Tasso ricavato per bisezione da residuo, rata e rate restanti | `server/services/debiti.js` `tassoImplicito` | fatto |
| Correzione del residuo vero con Rettifica | `POST /api/debiti/:id/residuo` | fatto |
| Annullamento di una rata | `DELETE /api/debiti/:id/rate/:rataId` | fatto |
| Voce chiusa / riaperta, Movimenti conservati | `archiviata` su Attivita/Debito + `PATCH /api/voci/:id` | fatto (ADR-0010) |
| Ricorrenza che genera movimenti da sé, con anteprima e avviso | `server/routes/transazioniPeriodiche.js`, `src/Transazioni.js` | fatto — è il modello della rata automatica |
| Fotografia mensile scritta in lettura, passata non riscritta | `server/services/patrimonio.js` `salvaFotografia` | fatto (ADR-0009) |

## Passi

### P0 — Il modello

- `server/models/Attivita.js`, `server/models/Debito.js`: `quotaPossesso` (Number, default 1, tra 0 e 1).
- `server/models/Debito.js`: `gravaSu` (ObjectId di un'Attività, facoltativo); `durataAnni` e `ratePagate` (facoltativi, per i Tipi con piano); `tassoScelto` (`'ricavato'` \| `'atto'`, default `'ricavato'`); `ultimoControlloResiduo` (Date, facoltativo, per il controllo annuale).
- `tasso` resta **il Tasso dell'atto** (nessuna migrazione: i Debiti che hanno un tasso lo hanno dichiarato). Il Tasso ricavato resta calcolato, non salvato.
- `scadenza` resta il dato interno con cui si contano le rate restanti: alla creazione la si ricava da `durataAnni` + `ratePagate` + `giornoRata`, e si tiene allineata nel `PATCH`.
- Verifica: `node --check server/models/Debito.js`, e i Debiti esistenti si rileggono senza modifiche (100%, nessun legame).

### P1 — La creazione e la scheda

- `server/routes/voci.js` `POST /api/voci`: accettare `quotaPossesso`, e per i Debiti con piano `durataAnni`, `ratePagate`, `gravaSu`, `tassoScelto`; ricavare la `scadenza`; rifiutare `gravaSu` che punta a una Voce che non esiste o non è un'Attività.
- `server/routes/voci.js` `PATCH /api/voci/:id`: gli stessi campi, con il ricalcolo della scadenza quando cambiano durata o rate pagate.
- `server/routes/voci.js` `GET /api/voci/:id` e i `dettaglioVoce`: restituire il **Debito collegato** e la **Quota di proprietà** (`valore − residuo collegato`), oltre ai Debiti che gravano su un'Attività.
- `src/Patrimonio.js` (modulo «Nuovo conto»): al posto della data dell'ultima rata, `durata` e `rate già pagate` per i Tipi con piano; più `quota di possesso`, `grava su` (elenco dei Beni) e la scelta del tasso che comanda.
- `src/ContoDettaglio.js`: la scheda dell'Attività mostra valore, Debiti collegati e Quota di proprietà, con la seconda porta per collegare o sciogliere un Debito; la scheda del Debito mostra i due tassi affiancati, la differenza e quanto costa (ADR-0017), e i campi del piano.
- Verifica: `npm run build`, più un giro a mano: creare la casa, creare il mutuo collegato, vedere `280.000 − 150.000 = quota mia`.

### P2 — La lente della Quota di possesso

Il passo più delicato: **una funzione sola**, applicata in lettura, mai una riscrittura.

- `server/services/patrimonio.js`: il `costruisci()` di `calcolaPatrimonio` applica la quota a valore, serie, `gruppi`, `attivita`, `debiti`, `patrimonio`; le Fotografie continuano a registrare i valori **interi** e la lente si applica quando si leggono (`fotografiaDelMeseCorrente` e la lettura delle Fotografie in `server/routes/patrimonio.js`) — così la curva non ha gradini e niente si riscrive.
- Esporre `quotaPossesso` sui Movimenti che l'API restituisce (`server/routes/spese.js`, `entrate.js`, `trasferimenti.js`, `voci.js`): chi legge sa a chi appartiene il conto.
- Aggregazioni da passare dalla lente, una per una: `server/routes/widget.js` (`$sum` su `importo`), `server/routes/spese.js` `GET /totale-mese`, `src/hooks/useBudgetData.js`, `src/Home.js` (totali di oggi, settimana, mese, categoria top), `src/components/MonthlySummaryChart.js`, `src/Filtri.js`, `src/Transazioni.js`.
- `src/utils/patrimonioFormat.js` (o dove si formattano i valori): una Voce cointestata mostra **la quota** e accanto il valore intero («140.000 di 280.000»).
- Verifica: la somma delle parti deve dare il totale in ogni vista (Home, budget mensile, statistiche, rendiconto, curva, Ripartizione), e un conto al 100% non deve cambiare nessun numero rispetto a prima.

### P3 — Il piano del Debito (durata, rate pagate, due tassi)

- `server/services/debiti.js`: `piano()` accetta `durataAnni` e `ratePagate`; restituisce **entrambi** i tassi, quale comanda e la differenza in euro al mese; nuova funzione `rateRestantiDopoVersamento(residuo, rata, tasso)` per l'estinzione anticipata con riduzione della durata.
- `server/routes/debiti.js`: `GET /api/debiti/:id` porta i due tassi e la scelta.
- Verifica: `server/scripts/verifica-piano-mutuo.js` (nuovo, sul modello di `server/scripts/diagnostica-saldo.js`): stampa il piano per residuo 150.000, rata 557, durata e rate pagate reali, e deve dare interessi 254 e capitale 303 quando il Tasso ricavato coincide con la rata della banca.

### P4 — La rata automatica

- `server/routes/debiti.js`: `POST /api/debiti/rate-mancanti` — per ogni Debito attivo con piano e Tasso, scrive le rate non ancora registrate **dalla rata successiva all'ultima già scritta fino a oggi**, ognuna alla data del suo mese, con i due Movimenti; si ferma a residuo zero; risponde con l'elenco di quello che ha scritto (per l'avviso).
- Chiusura da sé: quando il residuo arriva a zero, `archiviata = true`; il legame `gravaSu` **resta salvato** e torna a valere alla riapertura (ADR-0018).
- `src/Home.js` e `src/Patrimonio.js`: chiamare `rate-mancanti` all'apertura (come `src/Transazioni.js` fa con le ricorrenze) e mostrare l'avviso «N rate registrate» con l'elenco e il rimando al controllo sull'estratto conto, usando `src/contexts/NotificationContext.js`.
- Verifica: nessuna rata scritta due volte (c'è già il controllo sul mese), nessuna rata con residuo a zero, un'assenza di tre mesi scrive tre rate con le date giuste.

### P5 — Il controllo annuale

- `server/routes/debiti.js`: `GET /api/debiti/:id` espone `ultimoControlloResiduo` e «controllo dovuto» quando è passato più di un anno (a partire dalla creazione); la correzione usa la rotta esistente `POST /api/debiti/:id/residuo`, che già scrive la Rettifica.
- `src/ContoDettaglio.js`: il promemoria con il residuo stimato, il campo per quello della banca e la differenza mostrata prima di confermare.
- Verifica: il controllo si vede una volta all'anno, la Rettifica porta la descrizione «scostamento del calcolo» e la differenza non è mai silenziosa.

### P6 — I casi rari

- `server/routes/debiti.js`: `POST /api/debiti/:id/versamento` (Trasferimento dal conto al Debito, **non** una Spesa) con la domanda durata/rata, e lo stato «decisione in sospeso» quando la risposta non c'è ancora; `PATCH` per scioglierla.
- Tasso variabile: si scrive la rata nuova nel `PATCH` e il Tasso ricavato si ricalcola (ADR-0020) — nessun campo nuovo oltre a quelli di P0.
- Verifica: un versamento parziale con riduzione della durata accorcia la scadenza; con riduzione della rata la scadenza resta; il budget non si muove in nessuno dei due casi.

### P7 — Chiusura

- Aggiornare `docs/CLAUDE_BACKEND.md` (rotte nuove, campi nuovi, la lente della quota), `docs/CLAUDE_FRONTEND.md` (scheda del bene, modulo di creazione, avvisi) e `CLAUDE.md` (una riga nel blocco Patrimonio: legame, quota di possesso, rata automatica). Restare nei limiti: `CLAUDE.md` ≤ 100 righe, sub-file ≤ 120.
- `graphify update .` dopo le modifiche.
- Verifiche finali: `node --check` sui file server toccati, `npm run build`, e un collaudo con i numeri veri del mutuo.

## Collaudo con i numeri veri

Serve, per il mutuo esistente: **durata** (es. 30 anni), **rate già pagate** (chi sta pagando la 57ª ne ha pagate 56), residuo di oggi, rata, e — se si trova — il tasso dell'atto e la quota interessi della prossima rata.

Il primo numero da guardare: il Tasso ricavato e la sua plausibilità. Se dalle durata e rate pagate esce un tasso assurdo, uno dei dati è sbagliato, e si vede subito invece che dopo un anno di rate automatiche.

## Fuori perimetro

iOS ed Expo (ADR-0008), la condivisione fra utenti (ADR-0013, sessione a sé), il piano di allocazione (sospeso), la polizza pagata a parte (è una Spesa normale).

## Rischi

- **La lente della quota** è l'unico passo che tocca il budget in più punti: se una sola aggregazione se ne dimentica, un totale non torna con la somma delle sue parti. Va fatta in un giro solo, con l'elenco dei punti di P2 come checklist.
- **La scrittura automatica** mette numeri calcolati nel patrimonio: ogni passo di P4 deve restare annullabile con un gesto (`DELETE /api/debiti/:id/rate/:rataId` esiste già).
- **`tassoScelto = 'atto'`** su una rata che contiene un premio fa derivare il residuo: il controllo annuale (P5) non è un extra, è la contropartita.
