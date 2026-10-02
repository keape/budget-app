# Il residuo di un Debito è l'opposto dei suoi Movimenti

---
Status: accepted
---

Il valore della Componente a movimenti di un Debito è il suo **residuo**, cioè l'opposto della somma dei suoi Movimenti. L'ADR-0005 diceva che «le Attività sommano, i Debiti sottraggono»: questa è la forma che quel principio prende nei numeri. Il segno si applica in un punto solo del motore (`valoreComponente` e `serieCumulata` di `server/services/patrimonio.js`), e da lì lo ereditano serie mensile, `deltaMese` e Fotografie.

Conseguenze, lette dal lato del Debito: l'**erogazione** di un mutuo (Trasferimento dal Debito al conto) alza il residuo; la **quota capitale** della rata (Trasferimento dal conto al Debito) lo abbassa; una **Spesa registrata sul Debito** — un acquisto fatto con la carta di credito — lo alza, e resta negativa in archivio perché la regola della collezione non cambia; un'**Entrata** lo abbassa (un rimborso ricevuto sulla carta); una **Rettifica** con importo negativo lo alza.

## Considered Options

- **Il residuo è un campo dichiarato dall'utente** (una Valutazione sulla Componente, come per un immobile): nessun algoritmo da capire, ma una carta di credito non si aggiornerebbe da sé (ogni acquisto andrebbe ricopiato a mano) e il residuo di un mutuo resterebbe esatto solo finché l'utente non dimentica un aggiornamento. Il numero mostrato sarebbe quello scritto dall'utente, quindi un errore sarebbe invisibile.
- **Il residuo è la somma dei Movimenti, con il segno ribaltato al momento della scrittura** (le rotte salvano gli importi già girati): il motore non avrebbe nessun caso particolare, ma una Spesa pagata con la carta finirebbe in archivio con importo positivo — contro la regola di `Spesa.importo` e contro il budget, che somma le Spese così come sono.
- **Il residuo è l'opposto della somma dei Movimenti** (scelta): una sola fonte di verità, un solo punto che applica il segno, e le collezioni dei Movimenti restano fedeli alle loro regole.

## Consequences

- Chi legge un Movimento dal Debito non vede mai il segno interno: le API e la scheda del Debito mostrano l'**effetto sul residuo** (`movimentiDellaVoce` moltiplica per −1 gli importi quando la specie è `debito`). Nel dettaglio di un Debito, quindi, un Trasferimento di quota capitale appare negativo perché il residuo è sceso.
- Una Rettifica su un Debito ha il segno contrario alla lettura: la correzione del residuo che scende si salva come Rettifica positiva. La scheda del Debito non chiede all'utente una differenza con segno, ma **il residuo vero** (`POST /api/debiti/:id/residuo`), e converte lei.
- Il residuo iniziale di un Debito già in corso è una Rettifica con `origine: 'sistema'` e descrizione «Residuo iniziale»: è la fotografia del debito il giorno in cui è stato registrato, e la storia comincia da lì (ADR-0009).
- Il patrimonio si calcola con una lettura in più (i Debiti) e una fusione, sempre in un punto solo (ADR-0006).
