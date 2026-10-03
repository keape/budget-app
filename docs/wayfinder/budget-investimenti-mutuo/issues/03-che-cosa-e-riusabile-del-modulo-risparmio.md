# Che cosa è riusabile del modulo Risparmio

Type: research
Status: resolved
Assignee: Pi (sessione di disegno)

## Question

Che cosa del **modulo Risparmio** si può riusare, e che cosa va incapsulato dentro il modello a Componenti dei conti investimenti?

Fatti verificati: il modulo vive in `src/Savings.js` (876 righe) con `server/routes/savings.js`, i modelli `Instrument`, `InstrumentAllocation`, `InstrumentSale`, `SavingsMonth`, `AllocationPlan` e il componente `src/components/InstrumentSearch.js`. L'ADR-0002 ha già deciso che il motore titoli **non si riscrive**: si incapsula come motore delle Componenti-titolo dentro i conti investimenti. L'ADR-0003 ha già deciso che l'Allocazione registra il Trasferimento e che il piano diventa un livello di confronto.

Da rispondere, con `file:riga`:

1. come si calcola oggi il **portafoglio** (posizioni, quantità, prezzo di carico, valore a mercato) a partire da allocazioni e vendite, e quale parte di quel calcolo serve a una Componente-titolo;
2. che cosa registra oggi una **vendita** (`InstrumentSale`): plusvalenza, quantità, prezzo, e se si incastra con il Realizzo delle Componenti;
3. in che stato sono `SavingsMonth` e `AllocationPlan` (quali dati esistono davvero, quanti documenti per utente toccherebbero una migrazione);
4. quali rotte di `server/routes/savings.js` restano utili e quali diventano doppioni di rotte patrimoniali;
5. se `InstrumentSearch` è già il selettore che serve alla scheda di un conto investimenti.

Esito atteso: una tabella riuso / incapsulare / buttare, con i file e le righe, e i punti dove il modulo Risparmio e i conti investimenti dicono la stessa cosa in due modi.

## Answer

Relazione completa (41 KB): [`../assets/03-riusabile-modulo-risparmio.md`](../assets/03-riusabile-modulo-risparmio.md). Qui il nocciolo.

**«Sospeso» è solo nella documentazione.** `docs/CLAUDE_FRONTEND.md:18` lo dice di `src/Savings.js`, ma la pagina è montata (`src/App.js:106-113`), ha la voce di menu (`src/navbar.js:85-93`), la carta in Home (`src/Home.js:265-277`) e — soprattutto — **l'app iOS la consuma per intero** (`budget365iOS/src/screens/SavingsScreen.tsx:563-683`, `:887-1069`). L'ADR-0008 impegna a non cambiare il formato delle risposte esistenti: «buttare» significa quindi **smettere di scrivere**, non cancellare. È un vincolo da tenere nelle Note della mappa.

**Il calcolo del portafoglio è già la formula decisa.** `GET /api/savings/portfolio` (`server/routes/savings.js:425-509`): quantità corrente = comprato − venduto (`:486`), prezzo di carico = `Σamount / Σquantity` (`:487`), valore = quantità × `lastPrice` (`:492-493`), più realizzato e latente. L'aritmetica dei passi 4–5 **è** `quantità × prezzo`: è quella da incapsulare, e cambia solo la chiave (Componente, non Strumento). Il passo 2 — l'aggregazione per `instrumentId` (`:456-470`) — sparisce, perché la quantità diventa un campo della Componente.

**Dove si innesta il motore: un buco, non un doppione.** `valoreComponente()` tratta `mercato` **esattamente come** `dichiarata` (`server/services/patrimonio.js:223-231`, con il commento «il prezzo arriva dal motore titoli nella Fetta 2»), e `serieComponente()` manda `mercato` su `serieDichiarata()` (`:336-341`). Quindi una Componente creata a `mercato` — e la rotta lo accetta (`server/routes/voci.js:352-353`) — oggi vale la sua ultima dichiarazione. Il punto di innesto è già indicato dal codice stesso.

**Trappole del calcolo, da non ereditare**: le allocazioni **senza `quantity`** entrano nell'importo ma contano zero quote, quindi la riga viene scartata (`savings.js:508`) e il denaro sparisce dal portafoglio (nel backup: 2 su 5, 2.000 €); `priceAtAllocation` è **scritto e mai riletto** da nessuna aggregazione; `lastPrice` è unico e globale per ticker e **senza storico** (per questo `server/models/Fotografia.js:3-6` scrive che «il passato non è ricostruibile»); la valuta non si converte; e il pulsante **«🔄 Aggiorna prezzi» non aggiorna niente**: è `onClick={loadData}` (`src/Savings.js:806-809`), cioè rilegge la stessa GET.

**La vendita e il Realizzo oggi non si incastrano affatto.** `InstrumentSale` è un **evento** (quantità, prezzo, `proceeds`, `costBasis`, `capitalGain`, e la data è il `createdAt`) legato a un mese; `Componente.realizzo` è **un numero solo**, senza quantità né plusvalenza, scritto e mai letto. Le tre cose che nel modello nuovo devono accadere in un punto solo — scrivere il ricavo, scalare la quantità, chiudere il pezzo — oggi stanno in tre posti, e **una vendita parziale non è esprimibile come Realizzo di una Componente**. Va deciso (sotto-domanda aggiunta al biglietto «Il titolo dentro un conto investimenti»).

**I due moduli, adesso, danno due valori diversi per lo stesso titolo**: `/portfolio` fa quantità × `lastPrice` (`savings.js:492-494`), il patrimonio legge l'ultima dichiarazione (`patrimonio.js:228`). E due definizioni di plusvalenza convivono: il lessico dice «Realizzo − ultima Valutazione» (`GLOSSARY.md:82-83`), il codice del risparmio calcola «ricavo − costo di carico medio» (`server/models/InstrumentSale.js:14`, `savings.js:385`). Serve una decisione: biglietto nuovo.

**I dati sono pochissimi e non tutti al sicuro.** Dal backup del repo (`backup budget-app/2026-04/`): 7 `SavingsMonth` (di cui **4 a zero**), 1 `AllocationPlan` (senza `monthlyTargets`), 5 `InstrumentAllocation` (2 senza `quantity`). Ma `Instrument` e `InstrumentSale` **non sono in nessun backup** (`server/backup.js:15-24`): `Instrument` è la sola copia di ticker e prezzi, `InstrumentSale` l'unico registro delle vendite — quindi oggi **non si può dire quante vendite esistano**. L'ADR-0002 chiede già il conteggio prima di toccare la produzione: biglietto nuovo, e va fatto prima della migrazione. Attenzione anche: `DELETE /api/auth/delete-account` (`server/routes/auth.js:483-517`) non pulisce le collezioni del Risparmio, quindi «per utente» va misurato sul database vivo.

**`InstrumentSearch` è già il selettore giusto**: `onSelect` consegna il documento Strumento intero (ticker, nome, tipo, valuta, prezzo) e non serve una seconda chiamata. Avvertenze: cercare **crea** (la ricerca fa upsert su `instruments`, `server/routes/instruments.js:74-92`), non è controllato (per modificare un titolo esistente mostrerebbe il campo vuoto), e non ha la semantica di combobox.

**Verdetto in breve**: riusare il catalogo `Instrument`, la ricerca, il prezzo, `InstrumentSearch`, l'aritmetica della posizione e `AllocationPlan` come livello di confronto; incapsulare `portfolio`, la vendita e il ramo `mercato` di `valoreComponente`; smettere di scrivere `SavingsMonth` e le rotte che amministrano quella cache (`/months`, `/ensure-month`, `/auto-close`), il vincolo «la vendita appartiene a un mese» (`InstrumentSale.js:6`, `savings.js:354-356`), `savingsMonthId` come ancora, `instrumentId` come destinazione dell'assegnazione, e `monthlyTargets` (quest'ultimo **solo dopo** la verifica dei consumatori iOS).

**Tre doppioni concettuali da sciogliere** (i tredici punti sono nella relazione): il prezzo di carico (dichiarato sulla Componente, calcolato nel Risparmio, più un `priceAtAllocation` mai usato — tre posti per un concetto); la chiusura (`SavingsMonth.status`, `Fotografia.chiusa`, `Componente.chiusa`: tre modi di dire «chiuso»); e «a mercato» che si comporta come «dichiarata».

## Comments

Investigatore `fusion_investigate`: riuscito. I tre nodi che ha aperto sono diventati i biglietti «La plusvalenza e il prezzo di carico: una definizione sola», «Che cosa diventa il vecchio Risparmio» e «Mettere al sicuro Instrument e InstrumentSale, e contare i dati veri».
