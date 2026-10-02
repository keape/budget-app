# Il Debito calcola la rata da sé

---
Status: accepted
---

Il residuo di un Debito non è solo un numero dichiarato dall'utente: il Debito può conoscere tasso, rata e numero di rate residue, e a ogni rata il sistema calcola da sé la Quota capitale (che abbassa il residuo) e la Quota interessi (che è una Spesa a tutti gli effetti). Il Patrimonio scende quindi del costo reale — gli interessi — e non dell'intera rata. L'utente conferma la rata; il tasso è aggiornabile e il residuo resta sempre correggibile a mano.

## Considered Options

- **Residuo dichiarato a mano, rata come Spesa intera**: zero configurazione, ma il Patrimonio è esatto solo se l'utente non dimentica mai di abbassare il residuo, e l'errore è invisibile perché il numero mostrato è quello che l'utente stesso ha scritto.
- **Quota capitale calcolata al momento del pagamento, con conferma**: nessun piano da configurare, ma richiede la conferma a ogni rata e il residuo non si muove finché il pagamento non viene registrato.

## Consequences

- Un Debito ha una meccanica che un Conto e un Bene non hanno: è questa differenza a giustificare una specie separata (vedi ADR 0001).
- Il sistema genera movimenti da sé — una Spesa per gli interessi e un Trasferimento per la quota capitale. Sono gli unici movimenti non digitati dall'utente e devono essere riconoscibili come generati.
- Il tipo di un Debito decide anche se ha un piano di ammortamento: le carte di credito non lo hanno, i mutui e i finanziamenti sì.
- Tasso variabile: aggiornare il tasso ricalcola le rate successive. Nessun dato da sincronizzare con fonti esterne.
- L'erogazione del mutuo è un Trasferimento dal Debito al conto che incassa (il debito sale, il denaro entra) e non è un reddito: il budget non si tocca.
