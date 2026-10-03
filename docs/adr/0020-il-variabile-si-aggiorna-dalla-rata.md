# Il mutuo a tasso variabile si aggiorna dalla rata

---
Status: accepted
---

Quando la banca comunica la revisione di un mutuo a tasso variabile, si scrive **la rata nuova** e basta: il Tasso ricavato si ricalcola da sé dai tre numeri (residuo, rata nuova, rate restanti). Il tasso comunicato dalla banca resta un'informazione con cui controllare, non un secondo campo da tenere allineato a mano.

La rata è il numero certo — è quello che la banca addebita davvero — mentre il tasso comunicato è un'informazione, e ricalcolando la rata dall'atto si ottiene una rata che non è quella addebitata: gli arrotondamenti e l'eventuale premio dentro la rata la scostano di poco a ogni revisione, e semestre dopo semestre lo scostamento si somma. Scrivere la rata ha anche il pregio di lasciare un posto solo da aggiornare: due campi da tenere allineati sono un campo in più in cui sbagliare.

## Considered Options

- **Scrivere il tasso e farsi calcolare la rata**: coerente con «il Debito calcola la rata da sé», ma la rata calcolata non è quella della banca, e lo scostamento si cumula a ogni revisione.
- **Non aggiornare niente fino al controllo annuale**: nessun gesto; ma il mutuo continua a girare su una rata che non esiste più, l'errore cresce invece di annullarsi, e il controllo annuale corregge il residuo senza dire che il mutuo è cambiato.

## Consequences

- Per un mutuo a tasso variabile la configurazione sensata è **Tasso ricavato comanda** (ADR-0017): l'alternativa — far comandare il Tasso dell'atto — richiede di aggiornare il tasso a ogni revisione e accetta lo scostamento.
- Una revisione non è un evento da dichiarare: non c'è nessun campo «nuova revisione», c'è la rata che cambia. Se la rata cambia due volte fra due rate automatiche, vince l'ultima scritta.
- Il tasso ricavato dopo una revisione è una **misura** del nuovo costo del debito, e si può confrontare con quello comunicato dalla banca: se i due divergono, o la rata scritta è quella sbagliata, o c'è dentro qualcosa che non è interesse.
- La rata più alta non cambia il numero di rate: la durata è fissata dalla scadenza, e il ricalcolo delle rate restanti avviene solo dopo un'estinzione anticipata (ADR-0019).
