> Copia della relazione unita dai cinque modelli (`fusion_investigate`), prodotta il 2026-10-02 risolvendo il biglietto «Che cosa è riusabile del modulo Risparmio». Il run grezzo (prompt dei candidati, risposte separate, eventi) resta in `.pi/fusion/01a0fe31-c4b0-71a0-87fa-34231641949e-67332/investigate-6480c0dada1af5eb530f0131b296df7b`, percorso non versionato: questo file è la copia che vive con la mappa.

# Che cosa del modulo Risparmio è riusabile, che cosa va incapsulato, che cosa è doppione

**Metodo e limiti (una riga).** Tutto è letto dal codice con strumenti di sola lettura; nessun file è stato modificato. I conteggi del §3 sono **indicativi** e vengono dall'unico artefatto presente nel repo (`backup budget-app/2026-04/`, prodotto da `server/backup.js:15-24`), non dal database di produzione: le query per rifarli sul DB vivo sono in fondo al §3. L'unica affermazione già verificata in produzione è nel commento `server/routes/savings.js:104-109` (verifica 2026-10-02: nessuno strumento `conto_corrente`, nessuna allocazione negativa).

**Nota di partenza — «sospeso» è nella documentazione, non nel codice.** `docs/CLAUDE_FRONTEND.md:18` dice di `src/Savings.js` «sospeso: il piano di allocazione è una sessione a sé», ma il modulo è montato e raggiungibile: rotta `/savings` in `src/App.js:106-113`, voce di menu in `src/navbar.js:85-93`, carta in Home in `src/Home.js:265-277`, montaggio API in `server/index.js:133`. E soprattutto l'app iOS consuma il modulo *per intero* (`budget365iOS/src/screens/SavingsScreen.tsx:563-683`, `:887-1069`). «Sospeso» va letto come «sospeso sul web», non «spento».

---

## 1. Come si calcola OGGI il portafoglio

Tutto vive in una sola rotta: `GET /api/savings/portfolio?anno=&mese=` (`server/routes/savings.js:425-509`). Le allocazioni non sono mai materializzate come posizioni: il portafoglio è un'aggregazione al volo.

**Passo 1 — finestra temporale (facoltativa).** Con `anno` e `mese` si raccolgono gli `_id` dei `SavingsMonth` fino a quel mese compreso (`savings.js:431-447`) e si filtra su `savingsMonthId: { $in: monthIds }` (`savings.js:450`, `savings.js:453`). Senza parametri la posizione è «adesso». Il client web **omette** la finestra (`src/Savings.js:76`), il client iOS la passa (`budget365iOS/src/screens/SavingsScreen.tsx:683`).

**Passo 2 — le comprate.** Aggregazione su `InstrumentAllocation` raggruppata per `instrumentId` (`savings.js:456-470`):
- `totalAmount = Σ amount`
- `totalQuantity = Σ ifNull(quantity, 0)` (`savings.js:461-462`)

**Passo 3 — le vendute.** Aggregazione su `InstrumentSale` (`savings.js:471-481`):
- `totalQuantitySold = Σ quantity` (`savings.js:473`)
- `totalRealizedGain = Σ capitalGain` (`savings.js:474`)

**Passo 4 — la posizione** (`savings.js:486-494`):

| grandezza | riga | formula |
|---|---|---|
| quantità corrente | `savings.js:486` | `totalQuantity − totalQuantitySold` |
| prezzo di carico unitario (PCM) | `savings.js:487` | `totalAmount / totalQuantity` |
| costo residuo | `savings.js:488` | `currentQuantity × avgCostPerShare` |
| valore a mercato | `savings.js:492-493` | `currentQuantity × instrument.lastPrice` (solo se quantità > 0 e prezzo presente) |
| plusvalenza non realizzata | `savings.js:494` | `estimatedCurrentValue − remainingCostBasis` |
| plusvalenza realizzata | `savings.js:485` | `Σ capitalGain` |

**Passo 5 — filtro di riga**: si mostra la posizione se resta quantità o c'è plusvalenza realizzata (`savings.js:508`).

**Che parte serve a una Componente-titolo.** L'aritmetica dei passi 4-5 **è già** la formula decisa (`quantità × prezzo`), più costo di carico e guadagno latente: è la parte da **incapsulare**. Cambia l'*ingresso*, non l'aritmetica. Oggi quantità e costo arrivano da un registro mensile di allocazioni; una Componente-titolo li porterebbe come campi propri. Il passo 2 **non** è riusabile come è scritto, perché aggrega per `instrumentId` su *tutte* le allocazioni dell'utente (`savings.js:456-470`): una Componente-titolo è una posizione *dentro una Voce*, quindi la chiave diventa `componenteId` (o, nella decisione nuova, il passo 2 sparisce perché quantità e carico si leggono dalla Componente). Il passo 1 non ha corrispettivo nel modello a Componenti: il patrimonio è «adesso» più le Fotografie (`server/services/patrimonio.js:377-433`); al più ispira la serie mensile.

**Trappole reali del calcolo (da non ereditare).**

- **Allocazioni legacy senza `quantity`**: entrano in `totalAmount` ma contano 0 in `totalQuantity`, quindi la riga finisce scartata (`savings.js:508`) e il denaro «sparisce» dal portafoglio. Non è ipotetico: nel backup 2 allocazioni su 5 sono in questo stato (2000 € complessivi). E con `currentQuantity = 0` la vendita è **impossibile** (`savings.js:378-380`).
- **`priceAtAllocation` è scritto e mai riletto** da nessuna aggregazione (`savings.js:137`, `:157`; l'unico altro uso è lato client `src/Savings.js:120`). Il prezzo davvero pagato esiste in archivio ma il PCM si ricava da `amount/quantity` (`savings.js:487`, `:382`): funziona solo finché `amount` è esattamente `quantità × prezzo`.
- **`lastPrice` è unico e globale per ticker** (`server/models/Instrument.js:25-32`), aggiornato con cache di 15 minuti (`server/routes/instruments.js:113-118`): **non esiste storico dei prezzi**. Per questo `server/models/Fotografia.js:3-6` scrive che «il passato non è ricostruibile».
- **La valuta non si converte**: arriva da Yahoo (`instruments.js:72`) e il portafoglio somma numeri di valute diverse (`src/Savings.js:197-201`).
- **Il pulsante web «🔄 Aggiorna prezzi» non aggiorna nulla**: è `onClick={loadData}` (`src/Savings.js:806-809`), cioè rilegge la stessa GET (`src/Savings.js:48-85`). Il prezzo si rinfresca solo di rimbalzo passando da `/api/instruments/search` (`instruments.js:83-93`) o dalle rotte `/price`/`/:ticker` che oggi usa solo l'app iOS.

**Dove il valore di una Componente-titolo si calcola OGGI.** `valoreComponente()` tratta `mercato` **esattamente come** `dichiarata` (`server/services/patrimonio.js:223-231`, con il commento esplicito «il prezzo arriva dal motore titoli nella Fetta 2», `patrimonio.js:228`), e `serieComponente()` manda `mercato` su `serieDichiarata()` (`patrimonio.js:336-341`, `:314-334`). Quindi una Componente creata con `valorizzazione: 'mercato'` — cosa che la rotta accetta (`server/routes/voci.js:352-353`) — viene **valutata come dichiarata**: è il punto in cui si innesta il motore titoli, ed è un buco, non un doppione.

**Vincolo tecnico da rispettare in questa giunzione.** `patrimonio.js` è chiamato da rotte sincrone (`voci.js:50`, rotta patrimonio `:28`) e lì **non si fanno chiamate di rete**. Il prezzo delle Componenti-titolo va quindi letto da `Instrument.lastPrice`/storico già salvato, non chiesto a Yahoo dentro il calcolo; il caso «prezzo mancante» va deciso.

---

## 2. Che cosa registra esattamente una vendita, e come si incastra col Realizzo

**Il documento** (`server/models/InstrumentSale.js:5-19`): `userId`, `savingsMonthId` (obbligatorio, `:6`), `instrumentId`, `quantity`, `priceAtSale`, `proceeds` (= `quantity × priceAtSale`), `costBasis` (= `quantity × PCM`), `capitalGain` (= `proceeds − costBasis`), più `timestamps`. **Non esiste un campo `data`**: la data è il `createdAt` e il mese economico è `savingsMonthId`. Due conseguenze: una vendita non si retrodatina, e ogni vendita è legata al modulo mese.

**Chi la scrive** — `POST /api/savings/months/:id/sales` (`server/routes/savings.js:343-402`):
1. richiede `instrumentId`, `quantity`, `priceAtSale` positivi (`savings.js:346-352`);
2. **richiede che il `SavingsMonth` esista** (`savings.js:354-356`): senza il documento del mese non si vende — il client iOS infatti chiama prima `ensure-month` (`budget365iOS/src/screens/SavingsScreen.tsx:966-976`);
3. ricalcola al volo il PCM su **tutto lo storico dello strumento** (nessuna finestra di mese) e `currentQty = comprato − venduto` (`savings.js:364-376`), rifiutando se `quantity > currentQty + 1e-9` (`savings.js:378-380`);
4. calcola `avgCostPerShare`, `proceeds`, `costBasis`, `capitalGain` (`savings.js:382-385`);
5. **congela i tre numeri** nel documento (`savings.js:387-397`): un'allocazione inserita dopo cambia il PCM ma non riscrive le vendite già registrate — la plusvalenza memorizzata resta quella di prima.

**La cancellazione** (`DELETE /api/savings/months/:id/sales/:saleId`, `savings.js:406-420`) è un `findOneAndDelete` puro: non ricalcola nulla, ma *rialza silenziosamente* quantità e costo residuo del portafoglio (lo stato è derivato).

**Come si incastra col Realizzo — oggi non si incastra affatto.**

| | `InstrumentSale` | `Componente` (Realizzo) |
|---|---|---|
| forma | un documento per **evento** di vendita (`InstrumentSale.js:5-19`) | due campi sul pezzo: `realizzo` (`server/models/Componente.js:71-74`) e `chiusa`/`dataChiusura` (`Componente.js:69-71`) |
| granularità | **parziale**: si vendono N quote su M (`savings.js:349-351`) | **tutto o niente**: `chiusa: true` chiude la Componente (`server/routes/componenti.js:67-72`) |
| prezzo | `priceAtSale × quantity` (`savings.js:383`) | un solo numero incassato, senza quantità né prezzo unitario |
| plusvalenza | `proceeds − costBasis` a costo medio, **calcolata e scritta** (`InstrumentSale.js:14`, `savings.js:385`) | non calcolata da nessuna parte |
| data | `createdAt` | `dataChiusura` (`componenti.js:60`) |
| rapporto con la Voce | resta nel portafoglio come «realizzato» (`savings.js:485`) | l'incasso «entra nella Voce che incassa» (ADR-0002) — oggi non lo fa nessuno: `componenti.js:57-64` non scrive né Trasferimento né Entrata |

Punti concreti di rottura:
- `Componente.realizzo` è **un solo numero**, senza `proceeds`/`costBasis` e senza quantità venduta: dice *quanto si è incassato*, non *quanti pezzi*.
- `InstrumentSale` ha la quantità ma **non ha `componenteId`**: non sa a quale Componente appartiene, solo a quale `instrumentId`.
- La definizione di plusvalenza è diversa nei due mondi: `GLOSSARY.md:82-83` dice «Realizzo − ultima Valutazione», il codice calcola «ricavo − costo di carico medio» (`InstrumentSale.js:14`, `savings.js:385`). Sono due basi fiscali/contabili diverse, e la Componente oggi non ne calcola nessuna.
- Nel modello nuovo una vendita deve fare **tre cose in un punto solo** che oggi sono in tre posti: scrivere il ricavo (dato di `InstrumentSale`), scalare la quantità posseduta (oggi implicito in `currentQuantity`, `savings.js:486`; domani campo della Componente) e chiudere il pezzo con `realizzo`/`chiusa` (`Componente.js:71-74`). Il punto di scrittura unico oggi non esiste.
- **Una vendita parziale non è rappresentabile come Realizzo di una Componente**: o la Componente-titolo porta una quantità (allora una vendita parziale è riduzione di quantità + Realizzo/plusvalenza parziale, che è ciò che la decisione nuova implica), oppure il Realizzo resta il gesto di chiusura intera e le vendite parziali continuano a vivere solo in `InstrumentSale`. Il precedente da imitare esiste già: `PATCH /api/componenti/:id` sa riaprire una Componente chiusa (`componenti.js:62-64`) e `DELETE /api/componenti/:id` rifiuta la cancellazione con movimenti (409, `componenti.js:77-105`).

---

## 3. `SavingsMonth` e `AllocationPlan`: forma, quanti per utente, che cosa tocca una migrazione

### Forma

**`SavingsMonth`** (`server/models/SavingsMonth.js:5-44`): `userId`, `anno`, `mese` (0 = gennaio), `income`, `expenses`, `savings` (= `income − expenses`), `status ∈ {open, closed}`, `closedAt`, più `timestamps`. Indice **non unico** su `{userId, anno, mese}` (`SavingsMonth.js:44`): i duplicati sono possibili per costruzione. I tre numeri **non sono immessi**: sono ridotti ogni volta da `Entrata`/`Spesa` (`savings.js:44-55` in `ensure-month`, `savings.js:84-98` in `auto-close`). È una **cache derivata**, non una fonte di verità.

Chi lo scrive (nessun cron: tutto nasce da richieste):
- `POST /api/savings/auto-close` (`savings.js:73-117`): ricalcola **il mese precedente** e fa upsert. È chiamato *fire-and-forget* a ogni apertura della Home, sia web sia iOS (`src/Home.js:145`; `budget365iOS/src/screens/HomeScreen.tsx:318`). È ciò che ha creato i mesi a zero.
- `POST /api/savings/ensure-month` (`savings.js:25-69`): stesso ricalcolo su un mese non futuro qualsiasi, upsert, `status: 'closed'`. Lo chiama solo l'app iOS (`budget365iOS/src/screens/savings/hooks/useSavingsData.ts:85`, `SavingsScreen.tsx:588`, `:644`, `:887`, `:966`).

**`AllocationPlan`** (`server/models/AllocationPlan.js:4-36`): `userId` **unico** (`:7-11`) → al massimo **un documento per utente**; `monthlyTargets[] {anno, mese, targetSavings}` (`:12-24`); `allocations[] {instrumentId, targetPercentage, targetAmount}` (`:25-38`). Creato pigramente all'upsert (`savings.js:213-218`): **chi non ha mai aperto la scheda Piano non ha alcun documento**. `monthlyTargets` e `targetAmount` sono letti solo dall'app iOS (`SavingsScreen.tsx:1370-1377`, `:1623`): per il web sono dati morti. Nessuna validazione che `instrumentId` esista (`savings.js:208-219` verifica solo le percentuali) → aspettarsi riferimenti orfani.

### Quanti documenti per utente

Non esistono numeri di produzione nel repo. Quelli che seguono vengono da `backup budget-app/2026-04/` e vanno trattati come **stima indicativa**, non come conteggio:

| Collezione | Documenti | Utenti distinti | Forma osservata |
|---|---|---|---|
| `savingsmonths.json` | **7** | **4** | tutti `anno: 2026`, `mese ∈ {0,1,2}`, tutti `status: "closed"`; **4 dei 7 hanno `income=expenses=savings=0`** |
| `allocationplans.json` | **1** | **1** | 3 voci (`10 + 25 + 65 = 100`), **nessun `monthlyTargets`** |
| `instrumentallocations.json` | **5** | **1** | 3 con `quantity`/`priceAtAllocation`, **2 senza** |

Ripartizione di `savingsmonths.json`: un utente con 3 mesi, uno con 2, due con 1.

Limiti superiori dimostrabili dal codice, indipendenti dal backup:
- `AllocationPlan`: **0 o 1 per utente**, garantito dall'indice unico (`AllocationPlan.js:7-11`).
- `SavingsMonth`: **al più uno per (utente, mese) nel percorso normale, ma l'indice non lo impone** (`SavingsMonth.js:44`); il tetto pratico è il numero di mesi in cui l'utente ha aperto l'app (auto-close scrive solo il mese precedente) più i mesi sfogliati in iOS (ensure-month li crea a richiesta). Due upsert concorrenti (`savings.js:59`, `:96`) possono creare **doppioni**, e il client web poi sceglie con un `.find()` arbitrario (`src/Savings.js:54-56`).
- `InstrumentAllocation`: una riga per (mese × strumento × assegnazione), senza vincolo di unicità (`server/models/InstrumentAllocation.js:32`).

**Tre lacune che i numeri del backup non mostrano.**
1. **`InstrumentSale` non è mai stato contato né salvato.** `server/backup.js:15-24` elenca solo `User, Spesa, Entrata, BudgetSettings, TransazionePeriodica, SavingsMonth, InstrumentAllocation, AllocationPlan`: **`Instrument` e `InstrumentSale` non sono in nessun backup** (nessun `instruments.json` né `instrumentsales.json`). Prima di qualunque migrazione del motore titoli queste due collezioni vanno messe in sicurezza: `Instrument` è la sola copia di ticker e prezzi, `InstrumentSale` l'unico registro delle vendite (e quindi non si può dire oggi quante vendite esistano).
2. **`Instrument` è globale, non per utente**: `ticker` è `unique` su tutta la collezione (`server/models/Instrument.js:4-9`), non c'è `userId`, e la ricerca fa `findOneAndUpdate` di upsert per chiunque sia autenticato (`server/routes/instruments.js:82-92`). Una Componente-titolo che punta a `Instrument` eredita questa globalità; nessuno cancella mai un `Instrument`.
3. **La cancellazione account non pulisce il Risparmio.** `DELETE /api/auth/delete-account` (`server/routes/auth.js:483-517`) cancella solo `Spesa`, `Entrata`, `BudgetSettings`, `TransazionePeriodica` e `User`. `SavingsMonth`, `InstrumentAllocation`, `InstrumentSale`, `AllocationPlan` (e le collezioni patrimoniali) restano orfani: i 7 documenti del backup potrebbero includere utenti non più esistenti, quindi «per utente» va misurato sul DB vivo.

### Query per i numeri veri (da eseguire fuori da qui)

```js
// conteggi per utente — sola lettura
db.savingsmonths.aggregate([{ $group: { _id: '$userId', mesi: { $sum: 1 },
  dal: { $min: { a: '$anno', m: '$mese' } }, al: { $max: { a: '$anno', m: '$mese' } } } }])
// doppioni (indice non unico): deve uscire vuoto
db.savingsmonths.aggregate([{ $group: { _id: { u: '$userId', a: '$anno', m: '$mese' }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } }])
db.savingsmonths.countDocuments({ income: 0, expenses: 0, savings: 0 })      // mesi vuoti
db.allocationplans.countDocuments()                                          // atteso: 1 per utente con piano
db.allocationplans.countDocuments({ 'monthlyTargets.0': { $exists: true } })  // mai scritto finora?
db.instrumentallocations.aggregate([{ $group: { _id: '$userId', n: { $sum: 1 },
  senzaQuantity: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$quantity', null] }, null] }, 1, 0] } },
  importo: { $sum: '$amount' } } }])
db.instrumentsales.aggregate([{ $group: { _id: '$userId', n: { $sum: 1 }, quote: { $sum: '$quantity' } } }])
db.instruments.countDocuments({ type: 'conto_corrente' })                    // atteso 0
db.instruments.countDocuments({ lastPrice: null })                           // Componenti senza prezzo
```

L'ADR-0002:20 chiede già che questo conteggio («quanti utenti e quante allocazioni») sia fatto **prima** di toccare la produzione; la mappa in `docs/wayfinder/.../map.md:44` registra la domanda come non ancora sciolta.

### Che cosa toccherebbe una migrazione

1. **Lo stato dice che non è cominciata**: `docs/adr/0008-solo-web-prima-del-collaudo.md:18` — «le Allocazioni e le Vendite già registrate restano dove sono e il conto investimenti di partenza per lo storico **non è ancora stato creato**».
2. **`InstrumentAllocation` → Componenti-titolo**: una Componente per (utente, strumento) dentro un «conto investimenti di partenza», con `quantità = Σ quantity` e `costoAcquisto = Σ amount`. È lo schema del Conto principale (`server/services/patrimonio.js:100-140`, `server/scripts/migrate-fetta1-voci.js:66-96`).
3. **Il tranello dei Trasferimenti retroattivi**: l'ADR-0003 vorrebbe un Trasferimento per ogni assegnazione (`docs/adr/0003-lallocazione-registra-il-trasferimento.md:7`), ma generarlo *all'indietro* toglierebbe denaro al Conto principale (ricostruendo uscite mai registrate) e cambierebbe i saldi storici. Va deciso se lo storico diventa Componenti senza Movimenti (saldi attuali intatti) oppure Trasferimenti datati (saldi riscritti): decisione di prodotto, non tecnica.
4. **`InstrumentSale` → Realizzo**: o si aggiunge `componenteId` alla vendita, o si chiudono le Componenti con `realizzo` e la vendita resta come dettaglio fiscale. Manca un campo data: la data utile è `createdAt`, e la migrazione deve almeno misurare se `createdAt` cade nel mese indicato da `savingsMonthId`.
5. **`SavingsMonth` non entra nel patrimonio**: nessuna rotta patrimoniale lo legge. La migrazione non lo trasforma, semmai smette di scriverlo.
6. **`AllocationPlan` cambia chiave**: pubblica `instrumentId` (`AllocationPlan.js:26-30`), ma la verità con cui si confronta dopo l'ADR-0003 è una Voce/Componente (`docs/adr/0003...md:18`).
7. **Il client iOS consuma tutto**: oltre a `/months`, `/ensure-month`, `/allocations`, `/plan`, `/plan/monthly-target`, usa `/year-summary` e `/portfolio?anno=&mese=`. Nessuna rotta si spegne senza toccare `budget365iOS`.

In volume: pochissimo — al più **7** documenti `SavingsMonth` (di cui 4 vuoti) e **1** `AllocationPlan`. Il costo di una migrazione qui non è il volume, sono le decisioni sopra.

---

## 4. Quali rotte di `server/routes/savings.js` restano utili, quali sono doppioni

Verdetto per rotta (grep completo: `savings.js:13, 25, 73, 119, 135, 169, 188, 202, 242, 285, 325, 343, 406, 425`). «Doppione» = nel modello patrimoniale esiste già un posto che dice la stessa cosa. **Deprecata** ≠ rimovibile domani: veda la nota finale sul vincolo iOS.

| Rotta | riga | Verdetto | Perché |
|---|---|---|---|
| `GET /months` | `savings.js:13` | **Doppione** (forma da congelare) | È la lista dei mesi derivati da `Entrata`/`Spesa`, che il budget già possiede (`server/routes/entrate.js:45`, `spese.js:47`); non partecipa al patrimonio. |
| `POST /ensure-month` | `savings.js:25` | **Doppione** | Stessa derivazione di `auto-close`; i due totali mensili hanno già rotte proprie. |
| `POST /auto-close` | `savings.js:73` | **Doppione dannoso** | Fire-and-forget a ogni Home (`src/Home.js:145`); è ciò che ha creato i 4 mesi a zero. Concetto di chiusura già in `Fotografia.chiusa` (`server/models/Fotografia.js:46`). |
| `GET/POST/DELETE /months/:id/allocations` | `savings.js:119`, `:135`, `:169` | **Da incapsulare/rifare** | Oggi scrive `InstrumentAllocation` verso uno *Strumento*; l'ADR-0003 vuole un Trasferimento verso una *Voce* (`docs/adr/0003...md:16`). `savings.js` **non importa né scrive mai** `Trasferimento` né `Componente`: l'ADR-0003 è deciso ma **non implementato**. Il gemello esiste: `POST /api/trasferimenti` (`server/routes/trasferimenti.js:60-100`) e `POST /api/voci/:id/componenti` (`voci.js:341-378`). Il `DELETE` ha un difetto: cancellare l'allocazione senza il Trasferimento accoppiato lascia il denaro contato una o due volte. |
| `GET/PUT /plan` | `savings.js:188`, `:202` | **Riusare** | È il livello di confronto che sopravvive (`docs/adr/0003...md:18`); da riagganciare a Voce/Componente (`$populate('allocations.instrumentId')` sparirà). |
| `PUT /plan/monthly-target` | `savings.js:242` | **Candidato a buttare (solo dopo verifica iOS)** | Secondo «previsto» accanto al budget e al `savings` derivato. **Attenzione**: un candidato cita righe iOS che lo leggerebbero (`SavingsScreen.tsx:1370-1377`, `:1623`), un altro non trova consumatori. Va verificato il riferimento iOS prima di rimuovere: in assenza di verifica, **deprecato, non rimosso**. |
| `GET /year-summary` | `savings.js:285` | **Doppione** | Aggrega `InstrumentAllocation` per strumento (`savings.js:297-306`): vista di patrimonio in miniatura già coperta da `GET /api/voci` (`voci.js:47`) e `GET /api/patrimonio/serie` (`patrimonio.js:66-96`). |
| `GET /months/:id/sales` | `savings.js:325` | **Da spostare** | Dopo l'ADR-0003 la vendita è un fatto della Componente → `GET /api/componenti/...` (che oggi non esiste: `componenti.js` ha solo PATCH e DELETE). |
| `POST /months/:id/sales` | `savings.js:343` | **Incapsulare** | L'aritmetica (PCM, `proceeds`, `costBasis`, `capitalGain`, `savings.js:382-385`) è buona; il vincolo «il mese deve esistere» (`savings.js:354-356`) e la chiave `instrumentId` sono sbagliati. |
| `DELETE /months/:id/sales/:saleId` | `savings.js:406` | **Incapsulare** | Serve, ma dentro la scheda della Componente, non dentro il mese. |
| `GET /portfolio` | `savings.js:425` | **Incapsulare (riscritto sull'aggregato giusto)** | È il calcolo della posizione: resta il *modello di lettura* di un conto investimenti, ma la chiave va da `instrumentId` a Componente e la finestra sui mesi non serve. |
| `GET /api/instruments/search` | `instruments.js:22` | **Riusare** | Unica fonte di ticker/nome/tipo/prezzo, con cache 24h e fallback locale (`instruments.js:50-66`). |
| `GET /api/instruments/:ticker/price` | `instruments.js:121` | **Riusare** | Serve alla Componente-titolo per il valore a mercato; cache 15 min (`instruments.js:112-118`). |
| Storico prezzi Yahoo | — | **Non esiste** | Nessuna chiamata storica: l'unico `range` usato è `1d` (`instruments.js:135`, `:175`). Non è riuso, è lavoro nuovo. |

**Rotte patrimoniali con cui i doppioni collidono**: `POST /api/trasferimenti` (`trasferimenti.js:60-100`, con `da`/`a` come `{voceSpecie, voceId, componenteId}` — `server/models/Trasferimento.js:11-25`), `POST /api/voci/:id/componenti` (`voci.js:341-378`, unico punto che crea Componenti e accetta `valorizzazione: 'mercato'`), `PATCH /api/componenti/:id` (`componenti.js:17-73`, unico punto che scrive `costoAcquisto` e `realizzo`), `GET /api/voci/:id` (`voci.js:80`, la scheda del conto), `GET /api/patrimonio` e `/serie` (`patrimonio.js:16`, `:68`).

**Vincolo esterno da non dimenticare**: le rotte `/api/savings/*` sono consumate anche dall'app iOS (`budget365iOS/src/screens/SavingsScreen.tsx:563-683`, `:887-1069`) e l'ADR-0008 si è impegnata a **non cambiare il formato** delle risposte esistenti (`docs/adr/0008-solo-web-prima-del-collaudo.md:16`). «Buttare» significa quindi *fuori dal modello di destinazione*, non «cancellare domani»: prima si congela la forma, poi si valuta la rimozione.

**Doppioni anche tra le voci, non solo tra le rotte**: `SavingsMonth.status = 'closed' + closedAt`, `Componente.chiusa + dataChiusura` e `Voce.archiviata` (`voci.js:229`) sono **tre modi di dire «chiuso»**.

---

## 5. `InstrumentSearch` è già il selettore che serve?

**Sì nella sostanza, no nella rifinitura.** `src/components/InstrumentSearch.js:5-70` è un autocomplete completo:
- è un componente *controllato dall'esterno*: riceve `onSelect` e `placeholder`, non gestisce lo stato della scelta (`:5`); il genitore tiene l'oggetto selezionato e lo mostra come pill (`src/Savings.js:37`, `:524-544`);
- cerca con debounce 300 ms su `GET /api/instruments/search` (`:12-23`) e **restituisce il documento Strumento intero** (`:12-14`): chi seleziona ottiene `_id`, `ticker`, `name`, `type`, `currency`, `exchange`, `lastPrice` (`instruments.js:56-93`) — cioè tutto ciò che serve a una Componente-titolo senza una seconda chiamata;
- mostra ticker, nome e tipo (`:45-69`), con stati di caricamento e nessun risultato.

Per la scheda di un conto investimenti serve esattamente così: `onSelect` consegna lo strumento completo. È già usato due volte oggi (`src/Savings.js:540` per le allocazioni, `:746` per il piano). Avvertenze, tutte risolvibili **senza riscriverlo**:

1. **Cerca creando.** `/api/instruments/search` fa upsert di ogni risultato Yahoo nella collezione `instruments` (`instruments.js:74-92`): una ricerca «esplorativa» scrive già nel motore — su una collezione globale e non backuppata, è un effetto collaterale da conoscere.
2. **Non è controllato**: non ha `value`/`initialValue`: per modificare una Componente-titolo esistente mostrerebbe il campo vuoto. Manca una via per mostrare «il titolo già scelto», se non il trucco della pastiglia già presente in `Savings.js:534-553`.
3. **Dipende da Yahoo**: se la ricerca fallisce l'API risponde con la cache locale o con `[]` (`instruments.js:105-108`); per un ticker già noto serve un ingresso manuale, che oggi non esiste.
4. **Non mostra prezzo né valuta** nella lista, e non ha semantica di combobox (`role="combobox"`, navigazione da tastiera, `aria-activedescendant`): l'`input` è `:29-37`, le opzioni sono `<button>` in un `div`.

Il punto vero è che l'oggetto restituito è uno **Strumento di un catalogo globale** (`Instrument` non ha `userId`, `server/models/Instrument.js:3-42`), mentre ciò che la scheda deve creare è una **Componente di un utente**: il selettore è riusabile tale e quale, è il *chiamante* che cambia mestiere. Verdetto: **riusare così com'è** per il primo rilascio (ticker + nome + tipo), aggiungendo prezzo/valuta e la semantica di combobox come rifinitura.

---

## 6. Tabella finale: RIUSARE / INCAPSULARE / BUTTARE

| Verdetto | Pezzo | file:riga | Motivazione |
|---|---|---|---|
| **RIUSARE** | Catalogo `Instrument` (ticker unico, tipo, valuta, `lastPrice`) | `server/models/Instrument.js:3-42` | È il dizionario del titolo, senza `userId`; la Componente-titolo punterà a questo, non a un modello nuovo. |
| **RIUSARE** | Ricerca Strumenti (Yahoo + cache + upsert) | `server/routes/instruments.js:22-109` | Unico modo per ottenere un ticker vero; cache 24h e fallback locale. |
| **RIUSARE** | Prezzo corrente con cache 15′ | `server/routes/instruments.js:121-165` | Il prezzo vero che serve a `quantità × prezzo`; va letto dal patrimonio senza fare rete. |
| **RIUSARE** | `InstrumentSearch` | `src/components/InstrumentSearch.js:5-70` | È già il selettore della scheda: `onSelect` consegna il documento completo. |
| **RIUSARE** | Aritmetica della posizione (PCM, costo residuo, valore, guadagno latente) | `server/routes/savings.js:486-494` (e `:382-385`) | È la regola decisa, scritta una volta; va solo chiamata con la chiave giusta (Componente, non Strumento). |
| **RIUSARE** | Vincolo «non vendere più di quanto si possiede» | `savings.js:376-380` | Invariante di dominio ancora valida su una Componente-titolo (con la tolleranza `1e-9`). |
| **RIUSARE** | `InstrumentSale` come documento della vendita | `server/models/InstrumentSale.js:5-19` | Porta quantità, prezzo, costo e plusvalenza: unico record di una vendita parziale. |
| **RIUSARE** | `AllocationPlan` come livello di confronto | `server/models/AllocationPlan.js:25-38`, `savings.js:188-238` | L'ADR-0003 lo conferma sopra i Trasferimenti reali; da riagganciare a Voce/Componente. |
| **RIUSARE (completare)** | `Componente.realizzo`, `chiusa`, `dataChiusura` | `server/models/Componente.js:71-74`; `server/routes/componenti.js:67-72` | Esistono già e sono la destinazione dell'incastro della vendita; oggi `realizzo` è scritto e mai letto. |
| **INCAPSULARE** | `GET /api/savings/portfolio` come motore della Componente a `mercato` | `savings.js:425-509` → `server/services/patrimonio.js:223-231` (export `valoreComponente`, `:670`) | ADR-0002: il motore non si riscrive; oggi `mercato` è trattato come `dichiarata` (`patrimonio.js:228`), quindi è lì che va agganciato, in un punto solo. |
| **INCAPSULARE** | Semantica «portafoglio al mese X» | `savings.js:431-453` | Base possibile della serie mensile di una Componente-titolo, che oggi non esiste (`patrimonio.js:336-341` ricade sulle dichiarazioni). |
| **INCAPSULARE** | `POST /months/:id/sales` come gesto di chiusura/realizzo | `savings.js:343-402` → `componenti.js:57-64` | Il calcolo di plusvalenza e prezzo unitario esiste solo qui; il Realizzo oggi è un numero senza quantità né plusvalenza. |
| **INCAPSULARE** | `DELETE /months/:id/sales/:saleId` | `savings.js:406-420` | Serve, ma dentro la scheda della Componente. Oggi cancellare rialza silenziosamente quantità e costo residuo. |
| **INCAPSULARE** | `POST /months/:id/allocations` come wrapper: Componente-titolo + Trasferimento | `savings.js:135-166` → `voci.js:341-370` + `trasferimenti.js:60-100` | ADR-0003: l'allocazione **registra il Trasferimento**; oggi non lo fa. |
| **INCAPSULARE** | `quantity` e `priceAtAllocation` dell'allocazione | `server/models/InstrumentAllocation.js:24-29` | Alimentano `quantità` e prezzo di carico della Componente, quando presenti (le righe senza `quantity` sono un caso da contare). |
| **INCAPSULARE** | Ramo `mercato` di `valoreComponente`/`serieComponente` | `server/services/patrimonio.js:224-231`, `:336-341` | Punto di innesto dichiarato dal codice stesso; manca il lettore dei prezzi, non un modello nuovo. |
| **INCAPSULARE** | Catalogo degli strumenti (`azioni/obbligazioni/etf_fondi/altro`) | `server/models/Instrument.js:16-21` | Seconda tassonomia accanto ai Tipo di voce (`server/models/TipoVoce.js:14-22`, dove «Investimenti» esiste già): va mappata, non duplicata. |
| **INCAPSULARE** | Grafico «Piano vs Reale» | `src/Savings.js:203-213`, `:614-660` | Unica vista che confronta piano e allocazioni; cambia chiave ma la forma serve. |
| **BUTTARE (smettere di scrivere)** | `SavingsMonth` come documento | `server/models/SavingsMonth.js:5-44`, indice non unico `:44` | `income/expenses/savings` sono derivati da `Entrata`/`Spesa` e ricalcolati a ogni chiamata (`savings.js:39-56`, `:84-98`): non una fonte di verità, e i duplicati sono ammessi dall'indice. |
| **BUTTARE** | `GET /months`, `POST /ensure-month`, `POST /auto-close` | `savings.js:13`, `:25`, `:73` | Amministrano una cache del mese; la chiamata a ogni Home è l'unico motivo per cui esiste. Il ruolo di fotografia mensile è di `Fotografia` (`patrimonio.js:111`). |
| **BUTTARE** | `GET /year-summary` | `savings.js:285-331` | Aggregato per Strumento di una cosa che dopo la migrazione si legge per Voce; doppione di `patrimonio.js:66-96`. |
| **BUTTARE** | Il vincolo «la vendita appartiene a un mese» | `server/models/InstrumentSale.js:6`, `savings.js:354-356` | Un fatto di mercato non deve dipendere dall'esistenza di un documento di risparmio mensile (l'app iOS lo aggira chiamando `ensure-month` prima di vendere). |
| **BUTTARE** | `savingsMonthId` come ancora temporale di posizione e vendita | `InstrumentAllocation.js:10-14`, `InstrumentSale.js:7` | Una Componente non appartiene a un mese: appartiene a una Voce (`Componente.js:36-49`). |
| **BUTTARE** | `instrumentId` come destinazione dell'assegnazione | `InstrumentAllocation.js:15-19`, `AllocationPlan.js:26-30` | ADR-0003: la destinazione è una **Voce**, non uno Strumento. |
| **BUTTARE** | `AllocationPlan.monthlyTargets[]` + `PUT /plan/monthly-target` | `AllocationPlan.js:12-24`, `savings.js:242-283` | Secondo «previsto» accanto al budget e al `savings` derivato. **Fare prima la verifica iOS** dei riferimenti; fino ad allora deprecato, non rimosso. |
| **BUTTARE** | `priceAtAllocation` come campo a sé | scritto in `savings.js:137`, `:157`; **mai letto** in aggregazione | O diventa il prezzo di carico della Componente, o è rumore: oggi non entra in nessun calcolo. |
| **BUTTARE** | Il finto conto corrente (`conto_corrente`) | `server/models/Instrument.js:17-19`, `savings.js:104-109` | Già rimosso: era un accumulo contabile, non denaro. Precedente da non ripetere quando si aggiunge la liquidità non investita. |
| **BUTTARE** (i pezzi si ricompongono) | `src/Savings.js` come pagina a sé (3 tab) + voce di menu + carta in Home | `src/Savings.js:413-846`; `src/navbar.js:85-93`; `src/App.js:106-113`; `src/Home.js:265-277` | Il tab «mese» è una seconda vista dei Trasferimenti, il tab «portfolio» una seconda vista di una Voce investimenti, il tab «piano» l'unico pezzo originale: tenerli insieme perpetua il doppio modello. **Congelare**, non cancellare (iOS). |
| **NUOVO (non è riuso)** | Storico dei prezzi da Yahoo | `instruments.js:135`, `:175` (solo `range=1d`) | Nessuno storico esiste in nessun posto: serve una collezione e una chiamata che oggi non ci sono. Va decisa in `issues/02-lo-storico-dei-prezzi-dei-titoli.md`. |
| **NUOVO** | Lettura serie mensile di una Componente-titolo | `server/services/patrimonio.js:314-341` (`serieDichiarata`) | Oggi la curva di una Componente a mercato è una scaletta di dichiarazioni; deve diventare quantità del mese × prezzo del mese. E va deciso dove vive lo storico e come il calcolo lo legge **senza chiamate di rete**. |

---

## 7. Dove i due moduli dicono la stessa cosa in due modi diversi

1. **La plusvalenza.** Glossario e ADR-0002: «Realizzo − ultima Valutazione» (`GLOSSARY.md:82-83`). Codice del risparmio: `proceeds − costBasis`, a costo storico medio (`server/models/InstrumentSale.js:14`, calcolato in `savings.js:385`). Due definizioni economiche diverse con lo stesso nome, e la Componente oggi non ne calcola nessuna.
2. **Il prezzo di carico.** La Componente ha `costoAcquisto` + `dataCosto` (`server/models/Componente.js:63-64`); il risparmio lo **calcola** come `Σ amount / Σ quantity` (`savings.js:487`, `:382`) e in più memorizza un `priceAtAllocation` mai usato (`InstrumentAllocation.js:27-30`, `savings.js:157`). Calcolato e dichiarato divergono appena l'utente corregge una riga storica: tre posti per un solo concetto.
3. **Il valore a mercato.** Deciso: `quantità × prezzo`. Oggi `patrimonio.valoreComponente()` tratta `mercato` come `dichiarata` e legge `valutazione ?? costoAcquisto ?? 0` (`patrimonio.js:227-231`), mentre `/portfolio` fa `quantità × lastPrice` (`savings.js:492-494`). I due moduli, **adesso**, danno due valori diversi per lo stesso titolo.
4. **La quantità posseduta.** Nel Risparmio è *derivata* (`Σ quantity allocazioni − Σ quantity vendite`, `savings.js:462`, `:486`); nella decisione nuova è un *campo della Componente*. Finché convivono, esistono due verità sulla stessa quantità.
5. **La vendita = Realizzo.** Da una parte un **evento** con quantità e prezzo (`InstrumentSale.js:5-19`), dall'altra **campi di chiusura** sulla Componente (`Componente.js:69-72`, `componenti.js:57-64`): una vendita parziale non è esprimibile come Realizzo, e una vendita totale non lascia alcun documento nel modello a Componenti.
6. **L'assegnazione del risparmio.** Il glossario dice già la regola nuova: «Assegnarlo registra il Trasferimento dal conto di origine alla destinazione» (`GLOSSARY.md:156-157`), e l'ADR-0003 la conferma — ma la rotta scrive solo `InstrumentAllocation`, senza origine e senza Trasferimento (`savings.js:135-166`; il modello non ha alcun campo di origine, `InstrumentAllocation.js:4-35`).
7. **La chiusura del mese.** `SavingsMonth.status: 'closed' + closedAt` (`SavingsMonth.js:25-30`) vs `Fotografia.chiusa` (`Fotografia.js:46`) vs `Componente.chiusa + dataChiusura` (`Componente.js:69-71`): tre semantiche e tre collezioni per dire «chiuso».
8. **Il risparmio del mese.** `savings = income − expenses` calcolato e **memorizzato** (`savings.js:45-63`), lo stesso numero ricalcolato al volo da `spese.js:47`, `entrate.js:45` e `widget.js:10-45`.
9. **Le due allocazioni.** L'Allocazione reale (`InstrumentAllocation`) e la riga del piano (`AllocationPlan.allocations`): entrambe puntano a uno **Strumento**, mentre i Trasferimenti puntano a una **Voce**. Il confronto piano/reale confronta chiavi diverse da quelle della verità (`docs/adr/0003...md:18`).
10. **Due definizioni di freschezza del prezzo.** `Instrument.lastUpdated` con TTL 24h per la ricerca (`instruments.js:7-13`, `:19`) e `Instrument.priceUpdatedAt` con TTL 15 minuti per il prezzo (`instruments.js:112-118`). Due campi, due regole, lo stesso fatto.
11. **Come si chiama un titolo.** «Strumento» nel glossario degli investimenti (`GLOSSARY.md:150-151`) e «Componente» (con i titoli come esempio esplicito) nel glossario del patrimonio (`GLOSSARY.md:19-20`, `:90-91`): la stessa cosa con due nomi e due ancore di dati (`instrumentId` vs `voceId`+`componenteId`).
12. **«A mercato» che si comporta come «dichiarata».** `valorizzazione` ammette `mercato` (`server/models/Componente.js:36-41`, `voci.js:352-353`) ma il calcolo lo tratta come dichiarata (`patrimonio.js:228`): lo stesso nome dice due cose diverse nei due livelli.
13. **Il saldo del «conto» del risparmio.** Il conto corrente strumentale è stato smontato (`Instrument.js:17-19`, `savings.js:104-109`) e il suo ruolo è passato al Conto principale (`patrimonio.assicuraContoPrincipale`, `patrimonio.js:104-142`): per un po' i due moduli hanno tenuto il «saldo del risparmio» in due posti diversi, e il commento in `savings.js:105-109` ne è la traccia. È il precedente da non ripetere.

---

## Punti aperti da sciogliere prima di muovere la produzione

1. **Definizione unica di plusvalenza**: scegliere tra «Realizzo − ultima Valutazione» (`GLOSSARY.md:82-83`) e «proceeds − costBasis» (`InstrumentSale.js:14`, `savings.js:385`). Sono due basi contabili diverse, e finché convivono qualsiasi migrazione di `InstrumentSale` è ambigua.
2. **Vendite parziali nel modello a Componenti**: decidere se la Componente-titolo porta una quantità (vendita = riduzione + Realizzo parziale) oppure se il Realizzo resta chiusura intera e le parziali vivono solo in `InstrumentSale`.
3. **Migrazione senza doppie verità**: decidere il percorso `InstrumentAllocation`→Componente+Trasferimento e `InstrumentSale`→Realizzo (aggiungere `componenteId` o chiudere le Componenti), con la scelta sullo storico retroattivo (Componenti senza Movimenti vs Trasferimenti datati) che è decisione di prodotto.
4. **Verifica dei consumatori iOS** di `/plan/monthly-target` e delle altre rotte `/api/savings/*` prima di rimuovere o cambiare forme di risposta, come impone l'ADR-0008:16.
5. **Riconciliare i conteggi del backup con query live** su `SavingsMonth`, `AllocationPlan`, `InstrumentAllocation`, `InstrumentSale`, e mettere i primi due in cassaforte (oggi fuori backup).
6. **Dove vive lo storico prezzi** e come il calcolo patrimoniale lo legge **senza chiamate di rete** (`patrimonio.js` è sincrono); il caso «prezzo mancante» va deciso.
7. **Risolvere i doppioni concettuali** su prezzo di carico, valore a mercato, chiusura, tassonomia degli strumenti e assegnazione del risparmio (i 13 punti del §7).

**Limiti dichiarati di questa relazione.** I conteggi del §3 vengono da un backup datato e **non** dal database di produzione: vanno rifatti con le query riportate, in particolare per duplicati di `SavingsMonth` e orfani dopo `delete-account`. `Instrument` e `InstrumentSale` non sono coperti da backup, quindi **non è oggi possibile dire quante vendite esistano**. Nessuna esecuzione (build, test, `node --check`): tutto è statico sui sorgenti. Fuori dallo scope richiesto, ma citati dove servono a decidere: `budget365iOS/` e `BudgetAppExpo` come consumatori delle rotte.