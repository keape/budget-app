# La quota di possesso non si scrive: si legge

---
Status: accepted
---

La Quota di possesso vale per **tutto** ciò che passa da una Voce cointestata — il valore della Voce, ma anche le Spese e le Entrate che vi si registrano — e vale anche per il budget. Le cifre in archivio restano però quelle vere: la Spesa è quella che la banca ha addebitato, l'importo è quello scritto sull'estratto conto. La quota è una **lente di lettura applicata in un punto solo**, come il segno dei Debiti (ADR-0011): patrimonio, budget, rendiconto e Fotografia mensile la ereditano leggendo, non riscrivendo.

## Considered Options

- **Salvare gli importi già divisi per la quota**: nessuna lente da applicare a valle, ma l'archivio smette di dire quanto è stato davvero pagato, il numero scritto non coincide più con l'estratto conto, e cambiare la quota domani significherebbe riscrivere lo storico.
- **Quota applicata al solo patrimonio, budget a importi interi**: metà del lavoro, ma lo stesso euro risulterebbe speso una volta a metà (nel Patrimonio) e una volta intero (nel budget), e il rendiconto di fine mese sarebbe in contraddizione con sé stesso.

## Consequences

- La quota di possesso **non ha una data**: dice di chi è una cosa, non da quando. Vale quindi anche per i Movimenti già registrati e per i mesi passati, senza doverli ritoccare.
- Il motore del budget diventa un lettore della quota: è la modifica più delicata di questa fase, perché tocca i totali mensili, le statistiche per categoria e il rendiconto.
- Una Voce al 100% non cambia comportamento: la lente c'è, e non fa niente. Nessuna migrazione dei dati esistenti.
- L'elenco dei Movimenti continua a mostrare l'importo vero; se mostra anche la quota, deve dire che la sta mostrando, altrimenti il numero sembra sbagliato rispetto al budget.
- Le statistiche che sommano Spese ed Entrate (confronti fra mesi, medie, budget per categoria) devono passare tutte dalla stessa lente: una che se ne dimentica produce un totale che non torna con la somma delle sue parti.
