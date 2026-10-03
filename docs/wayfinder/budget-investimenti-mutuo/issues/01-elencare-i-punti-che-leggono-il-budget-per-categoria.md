# L'elenco dei punti che leggono il budget per categoria

Type: research
Status: resolved
Assignee: Pi (sessione di disegno)

## Question

Quali sono, **tutti**, i punti del codice che leggono il budget o i movimenti per categoria, e che cosa calcola ciascuno?

Serve la checklist esaustiva (`file:riga` → che cosa legge → che cosa calcola) perché il riordino delle categorie e le tre classi li toccano tutti: se uno solo se ne dimentica, un totale non torna con la somma delle sue parti.

Punti già noti, da verificare e completare:

- backend: `server/routes/budgetSettings.js`, `server/routes/categorie.js`, `server/routes/spese.js` (`GET /totale-mese`), `server/routes/entrate.js`, `server/routes/widget.js`;
- frontend: `src/hooks/useBudgetData.js`, `src/hooks/useBudgetCalculations.js`, `src/components/BudgetHeader|BudgetSummary|BudgetChart|BudgetTable|MonthlySummaryChart.js`, `src/Budget.js`, `src/BudgetSettings.js`, `src/Home.js`, `src/Filtri.js` (pagina Transazioni), `src/Transazioni.js`.

Da distinguere due famiglie, perché si rompono in modo diverso: chi legge gli **importi** per categoria, e chi legge l'**elenco delle categorie** (form di inserimento Spesa, filtri, icone, archiviazione).

Esito atteso: l'elenco completo, con una riga di commento per ciascun punto e l'indicazione di quale aggregazione è «il numero che l'utente guarda» e quale è derivata.

## Answer

Verificato con `grep` e lettura diretta il 2026-10-02. Le righe sono quelle di oggi: valgono come punto di partenza, non come contratto.

### (a) Chi legge gli IMPORTI per categoria

**Il previsto** — il numero che la pagina del budget mostra:

- `server/routes/budgetSettings.js:22` — `GET /api/budget-settings?anno=`: senza `mese` aggrega **tutti i documenti dell'anno** sommando per categoria (`:65-75`); con `mese` restituisce il documento del mese (`:50-56`).
- `src/hooks/useBudgetData.js:39-157` — il punto più delicato. Chiede le impostazioni mese per mese e **somma per categoria** (`:78-84`), calcola il *budget medio mensile* (`:99-111`), prova due strategie alternative (`:115-157`) e aggrega anche le transazioni per categoria (`:264-284`).
- `src/BudgetSettings.js:160-172` — somma i dodici mesi per categoria per la vista annuale; `:221-229` scrive il previsto del mese per categoria.

**L'effettivo e lo scostamento**:

- `src/hooks/useBudgetCalculations.js:24-40` — unisce le chiavi dei previsti con quelle delle transazioni (`tutteCategorie`) e calcola scostamenti e dati del grafico; è il cuore della tabella.
- `src/components/BudgetTable.js:38+` — una riga per categoria (categoria, previsto, effettivo, differenza).
- `src/components/BudgetChart.js` — una barra per categoria.
- `src/components/BudgetSummary.js:4-7` — i tre totali (previsto, effettivo, differenza), derivati dalla somma delle righe.
- `src/Home.js:81-86` (totali previsti del mese), `:103-110` (categoria più spesa del mese), `:112-140` (totali di oggi, settimana, mese; prime 5 categorie; bilancio del mese).
- `src/components/MonthlySummaryChart.js:10-44` — confronto previsto/effettivo **solo sui totali** (Entrate, Spese, Bilancio), mai per categoria.
- `src/Filtri.js:977-1010` — riepilogo per **movimento** (uscite, entrate, saldo, media, spesa più alta), non per categoria; `:1136-1155` esporta il CSV con la colonna Categoria.
- `server/routes/spese.js:56` (`GET /api/spese/totale-mese`), `server/routes/widget.js:12` (`GET /api/widget/riepilogo`) — totali del mese **senza** categoria; il widget porta la categoria solo come etichetta di riga (`:53`, `:61`).
- `server/services/patrimonio.js:532,537` — la categoria viaggia come etichetta sui Movimenti di un conto.
- `server/routes/debiti.js:80,169-217` — **l'unico punto del backend che crea una categoria da sé**: la Spesa della quota interessi nasce con `categoria = categoriaRata || tipo.nome || 'Altre spese'`. In una lettura a tre classi è una fissa, e il valore di ripiego `'Altre spese'` è una categoria che può non esistere in nessun elenco.

### (b) Chi legge l'ELENCO delle categorie

- `server/routes/categorie.js:9` — `GET /api/categorie`: ricava i nomi da **tutti** i `BudgetSettings` dell'utente (query robusta su `userId` stringa o ObjectId), `trim`, dedup, ordina. Restituisce **solo** i nomi presenti nel database.
- `src/BudgetSettings.js:30-39` — `categorieSpeseDiBase` (19 nomi: Abbigliamento, Abbonamenti, Acqua, Alimentari, Altre spese, Bar, Cinema Mostre Cultura, Elettricità, Giardinaggio/Agricoltura/Falegnameria, Manutenzione/Arredamento casa, Mutuo, Regali, Ristorante, Salute, Sport/Attrezzatura sportiva, Tecnologia, Vacanza, Vela) e `categorieEntrateDiBase` (7 nomi) **scritti a mano nel frontend**; `getAllCategories` (`:41-49`) unisce base + database e toglie le archiviate.
- **Divergenza da sanare**: quella lista di base esiste solo nella pagina delle impostazioni. `src/Transazioni.js:52-72`, `src/Filtri.js:920-938` (opzioni filtro = nomi dall'API ∪ nomi presenti nei movimenti caricati) e `src/ContoDettaglio.js:152-153` (datalist della categoria della rata e dei movimenti, `:722-727`, `:1009-1015`, `:1066-1072`) vedono **solo** i nomi dal database. Lo stesso utente vede quindi elenchi diversi in pagine diverse.
- `server/routes/transazioniPeriodiche.js:279` — una ricorrenza scrive `categoria` sui movimenti che genera: anche lì il nome è testo libero.

### (c) I flussi che girano su tutti i documenti mese

- `server/routes/categorie.js:72-160` — `POST /api/categorie/delete`: legge **tutti** i documenti di budget dell'utente, normalizza i nomi con una regex (`normalize`, `:110`) e fa un `updateOne` con `$unset` per ogni documento che contiene la categoria; poi cancella l'icona.
- `server/routes/categorie.js:162-262` — `POST /api/categorie/rename`: stesso giro, `$unset` + `$set` documento per documento, più la rinomina dell'icona.
- `src/BudgetSettings.js:232-280` e `:326-335` — rinomina ed elimina anche lo stato in memoria e poi chiamano la rotta globale.
- Costo: N letture + M scritture, dove N è il numero di mesi con budget. Con l'entità Categoria diventano una lettura e una scrittura — ma resta da decidere che cosa fare dei **nomi già scritti sui movimenti**, che restano testo e non si rinominano da soli (gli script `server/scripts/sposta-movimenti-categoria.js` e `configura-categorie-entrata.js` fanno già questo lavoro a mano).

### (d) Le due collezioni di appoggio

- `server/models/CategoriaArchiviata.js` (userId, tipo, categoria; indice unico) — usata solo in `server/routes/categorie.js:264-320` (`GET /archiviate`, `POST /archivia`, `POST /disarchivia`).
- `server/models/CategoryIcon.js` — usata solo in `server/routes/categorie.js:322-370` (`GET`/`PUT /icons`) e in `src/BudgetSettings.js`.
- Nessun'altra parte del sistema le legge. Sono già, di fatto, l'anagrafica delle categorie — ma in due pezzi separati e senza il nome.

### Che cosa ne segue

1. I punti da toccare per le tre classi sono **tre gruppi**: i previsti (`budgetSettings.js`, `useBudgetData.js`, `BudgetSettings.js`), lo scostamento per categoria (`useBudgetCalculations.js` e i tre componenti della pagina), i totali (`Home.js`, `MonthlySummaryChart.js`, `widget.js`, `spese.js /totale-mese`).
2. La **divergenza degli elenchi** (punto b) è il difetto da sanare per primo: l'entità Categoria diventa l'unica fonte dei nomi, e la lista scritta a mano nel frontend sparisce.
3. `server/routes/debiti.js:169-217` è l'unico posto dove una categoria nasce senza che l'utente la scriva: con le classi, quella categoria dev'essere una fissa che esiste davvero, non `'Altre spese'`.
4. I due script di manutenzione già esistenti mostrano che la rinomina dei nomi sui movimenti è un lavoro manuale ricorrente: l'entità Categoria è l'occasione per chiuderlo.

## Comments

Investigatore `bg_delegate`: **fallito** (uscita 1, «operation aborted» lato provider). Enumerazione fatta direttamente in sessione, con le prove riportate sopra.
