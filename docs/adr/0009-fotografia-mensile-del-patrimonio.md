# Il patrimonio è fotografato ogni mese, e lo storico parte da oggi

---
Status: accepted
---

Il grafico dell'andamento del Patrimonio si costruisce dalle **Fotografie mensili**, non dai Movimenti. La Fotografia del mese in corso è **provvisoria**: viene riscritta ogni volta che il patrimonio viene ricalcolato, e diventa definitiva quando il mese successivo la sostituisce. Lo storico **parte dal mese in cui la funzione entra in uso**: i mesi precedenti non si ricostruiscono.

## Considered Options

- **Ricostruire il passato dai Movimenti**: i prezzi salvati sono solo quelli attuali, i beni e i debiti non esistevano, e le Allocazioni già registrate non conoscono il broker: il risultato sarebbe una curva inventata, indistinguibile da una misurata.
- **Scrivere la Fotografia solo alla chiusura del mese, con un processo pianificato**: su Render il processo pianificato non è affidabile, e un mese saltato sarebbe un buco permanente nella curva. Con la scrittura provvisoria, un mese senza visite resta un mese senza Fotografia, ma i mesi visitati si autocorreggono.

## Consequences

- La **lettura** del patrimonio scrive la Fotografia del mese in corso: è idempotente (indice unico su utente, anno e mese) e quindi ripetibile senza danno. Non è un effetto collaterale accidentale ed è documentato in `server/routes/patrimonio.js`.
- Un mese in cui nessuno apre l'applicazione resta senza Fotografia: il grafico salta quel mese invece di inventarlo.
- La Fotografia porta con sé il dettaglio per Voce, quindi la curva del patrimonio resta spiegabile a posteriori: si può sapere da quale Voce veniva la differenza fra due mesi.
- `mese` è 0-indexato come in `BudgetSettings` e `SavingsMonth` (0 = gennaio), per non introdurre una seconda convenzione nella stessa applicazione.
