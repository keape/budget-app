# Un versamento di capitale chiede cosa ha fatto la banca

---
Status: accepted
---

Un'**estinzione anticipata** parziale è un Trasferimento dal conto al Debito, come la Quota capitale di una rata: abbassa il residuo e non è una Spesa, quindi non entra nel budget. Al momento di registrarla l'app chiede l'unica cosa che cambia davvero il piano — la banca ha ridotto la **durata** o la **rata**? Con la durata, le rate restanti si ricalcolano (stessa rata, stesso tasso, residuo più basso) e la scadenza si accorcia da sé; con la rata, si scrive la rata nuova e la durata resta quella.

La domanda **si può rimandare**: chi ha fatto il versamento ma non ha ancora la risposta della banca risponde «non lo so ancora», la scheda dice che c'è una decisione in sospeso e il piano resta fermo. Serve perché la risposta si dà nel momento in cui di solito non la si ha ancora, e una risposta data a caso sbaglia il piano per mesi senza che niente lo segnali.

## Considered Options

- **Accorcia la durata, sempre, calcolata**: è il default delle banche italiane e non chiede niente a nessuno; ma quando la banca ha ridotto la rata il piano resta sbagliato finché non lo si corregge, e non c'è niente che lo ricordi.
- **Solo il versamento, piano aggiustato al controllo annuale**: nessun calcolo da fidarsi; ma la scheda mostra per mesi una scadenza e delle rate restanti che non sono più vere, e il residuo stimato è il primo numero che si guarda.

## Consequences

- L'estinzione **totale** è lo stesso evento che porta il residuo a zero: il Debito si chiude da sé (ADR-0018) e il collegamento con l'Attività si scioglie.
- Il versamento **non è una Spesa** e non entra nel budget: il costo del mutuo sono gli interessi, e questo è capitale.
- Una decisione in sospeso è uno stato del Debito, non una risposta inventata: finché non la si scioglie, il piano mostrato è quello di prima e la scheda lo dichiara.
- L'estinzione anticipata è l'unico caso in cui il residuo scende senza che nessuno lo abbia calcolato, quindi è anche il momento in cui conviene scrivere il residuo vero della banca: da lì il piano riparte esatto.
