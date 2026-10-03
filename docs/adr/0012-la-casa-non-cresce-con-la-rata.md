# La casa non cresce con la rata: il mutuo si collega

---
Status: accepted
---

Pagare la Quota capitale di un mutuo **non alza il valore dell'immobile**: la casa vale quello che vale sul mercato, e a cambiare è la **Quota di proprietà**, perché è il Debito a scendere. L'Attività quindi resta a valorizzazione dichiarata (il valore di mercato, aggiornato dall'utente) e il Debito porta un **collegamento** all'Attività che finanzia: è quel collegamento che permette alla scheda dell'immobile di mostrare «valore di mercato, residuo del mutuo collegato, quota di proprietà = differenza».

## Considered Options

- **Nessun collegamento: valore di mercato da una parte, mutuo dall'altra** (funziona già oggi): zero lavoro, ma la Quota di proprietà non esiste come numero e la crescita si vede solo nel totale del Patrimonio, mescolata a tutto il resto.
- **L'immobile vale la Quota di proprietà, e cresce della Quota capitale**: la lettura più spontanea («la casa è mia per quanto ho pagato»), ma quel campo smette di essere il valore della casa: la rivalutazione non ha più dove stare, alla vendita la Plusvalenza non ha una base su cui calcolarsi, e servirebbe comunque un secondo numero per il valore di mercato.

## Consequences

- Vale per ogni Attività indebitata, non solo per gli immobili: un'auto comprata a rate ha la sua quota di proprietà allo stesso modo.
- Il collegamento si dichiara da **due porte** — la scheda del Debito (quale bene grava) e la scheda dell'Attività (quali debiti la gravano) — ma è **un dato solo**: la seconda porta scrive lo stesso campo, non una copia. Due copie divergerebbero, e nessuna delle due saprebbe di essere quella sbagliata.
- Un Debito si collega a **una** Attività; un'Attività può avere più Debiti collegati (prima casa e seconda casa non si confondono).
- La Quota di proprietà non si dichiara, si legge: per questo non è una Componente e non ha una valorizzazione. «Dichiarata» resta il valore di mercato.
- Il valore di mercato non si muove con le rate: resta l'ultima Valutazione finché l'utente non ne scrive una nuova (ADR-0009 per la Fotografia mensile, che invece si muove con il Debito).
- Un immobile senza mutuo collegato non mostra nessuna quota di proprietà: sarebbe uguale al valore, e un numero uguale al valore non aggiunge niente.
