# Chiudere un conto conserva la storia, eliminarlo la distrugge

---
Status: accepted
---

Un conto si **chiude** o si **elimina**, e le due cose non si assomigliano. Chiudere è archiviare: il conto esce dal Patrimonio e dall'elenco dei conti aperti, resta in un elenco suo (`Conti chiusi`), e **tutti i suoi Movimenti restano** leggibili nella sua scheda e nello storico. Eliminare cancella il conto **e tutti i suoi Movimenti**, insieme ai Trasferimenti che lo coinvolgono (che toccano anche l'altro conto), e non si annulla.

L'eliminazione richiede una conferma esplicita — il nome del conto scritto a mano — e dice quante transazioni sta per distruggere, con il dettaglio per tipo. Senza quella conferma l'API rifiuta con 409 e suggerisce di chiudere il conto invece.

## Considered Options

- **Solo archiviare** (l'alternativa era non implementare l'eliminazione): nessun modo di rimediare a un conto creato per sbaglio o duplicato, e l'elenco dei conti chiusi diventerebbe una discarica.
- **Eliminazione senza distinzione** (scartata): distruggerebbe la storia per un clic sbagliato, e la storia dei Movimenti è il valore di questa applicazione.
- **Chiusura come sola visibilità, senza uscire dal Patrimonio**: il conto chiuso continuerebbe a contare nel totale pur non comparendo nell'elenco, e il numero mostrato non sarebbe più spiegabile.

## Consequences

- Chiudere un conto con un saldo residuo **lo toglie dal Patrimonio**: la scheda avvisa con l'importo esatto prima di procedere, e suggerisce di registrare prima il Trasferimento verso il conto dove il denaro si trova adesso. È lo stesso motivo per cui il Trasferimento esiste (ADR-0002): senza di esso il valore risulterebbe in due posti o in nessuno.
- Chiudere ed eliminare si possono fare anche dal lato opposto: un conto chiuso si riapre dalla sua scheda o dall'elenco `Conti chiusi` dell'elenco dei conti, e torna nel Patrimonio con la sua storia.
- Le **Fotografie mensili** già scritte restano come sono: sono la misura del passato, e riscriverle falsificherebbe il punto della curva. Dopo un'eliminazione il grafico del Patrimonio complessivo continua quindi a contenere quel conto mentre i conti aperti non lo contengono più: è il comportamento voluto di una fotografia, e il grafico ricostruito dai conti aperti mostra il salto.
- Le **Transazioni periodiche** che puntavano al conto eliminato restano senza conto indicato e le loro transazioni future finiscono sul Conto principale: una ricorrenza non deve smettere di funzionare perché il conto che indicava non esiste più.
- Il numero di Movimenti per tipo è calcolato **prima** dell'eliminazione (`conteggi` nella scheda del conto) perché dopo non c'è più nulla da contare.
