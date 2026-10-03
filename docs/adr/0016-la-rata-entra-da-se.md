# La rata entra da sé

---
Status: accepted
---

Il giorno del pagamento la rata si registra **da sola**: una ricorrenza scrive la Spesa della Quota interessi e il Trasferimento della Quota capitale, senza conferma. Gli importi li calcola il Debito (residuo, tasso, rate restanti). È la stessa meccanica che l'app usa già per le transazioni periodiche, applicata a un Debito.

Il prezzo di questa scelta è che il **residuo mostrato è una stima**: finché non si scrive il residuo vero dell'estratto conto, il numero in scheda è quello che l'app ha calcolato. La Rettifica resta il gesto che raddrizza (`POST /api/debiti/:id/residuo`, ADR-0011), ma da gesto occasionale diventa manutenzione — e a ricordarsene è **l'app**: una volta all'anno, al riepilogo del mutuo, il Debito mostra il residuo stimato, chiede il numero della banca e registra la differenza come Rettifica spiegata («scostamento del calcolo»). Un gesto all'anno, e il numero in scheda torna a essere un fatto.

Gli avvisi che il calcolo si contraddice da sé — il residuo finisce prima della scadenza, la Quota interessi supera la rata — restano utili ma non bastano: uno scostamento piccolo e costante non si contraddice mai, scivola in silenzio.

## Considered Options

- **Rata preparata e confermata**: nessun movimento senza che l'utente l'abbia visto, numeri sempre quelli della banca, residuo esatto senza manutenzione. Scartata perché il gesto mensile pesa più di uno scostamento noto e correggibile.
- **Rata calcolata e scritta a mano ogni mese**: è come funziona oggi; nessuna automazione da costruire, ma l'utente deve ricordarsi il giorno e rifare il calcolo che l'app sa già fare.

## Consequences

- La scrittura automatica ha bisogno di **rate restanti esatte** e di un tasso: la Durata e le Rate pagate diventano dati di creazione, non più la data dell'ultima rata (che è il dato che nessuno ricorda).
- Se il debito non ha un tasso né i dati per ricavarlo, la rata automatica non parte: il Debito resta a registrazione manuale, ed è una condizione normale, non un errore.
- Un errore di calcolo non si vede: entra nel Patrimonio e nel budget come se fosse un fatto. Per questo i numeri scritti dal sistema devono restare riconoscibili come generati, e annullabili in un gesto.
- La rata dell'ultimo periodo è più bassa (non si rimborsa più capitale di quanto si deve): anche scritta da sé, l'ultima rata non può eccedere il residuo.
- Se l'app non viene aperta per mesi, alla riapertura scrive **tutte** le rate mancanti, ognuna alla data del suo mese, e **lo dice**: quante ne ha scritte e con quali importi, così si possono controllare sull'estratto conto. Il budget dei mesi passati si sistema al posto giusto, e l'unico caso in cui più numeri calcolati entrano insieme è anche l'unico in cui l'app avvisa.
