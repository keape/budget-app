# Un titolo in un'altra valuta dentro un conto in euro

Type: grilling
Status: open

## Question

Che cosa mostra un conto investimenti che contiene titoli quotati in valute diverse?

Fatti: `meta.currency` arriva dal motore (ISO 4217, con `GBp` = pence e gli indici fuori gioco), e oggi `Fotografia` e `server/services/patrimonio.js` sommano tutto in un unico numero **senza nessuna conversione**: un titolo in dollari sommato a uno in euro gonfia il patrimonio, e il grafico non lo dice. `Instrument.currency` esiste già (popolato dalla ricerca, `instruments.js:74`). La ricerca propone di conservare i **cambi mensili** (`EURUSD=X`, `EURGBP=X`, `EURCHF=X` con `interval=1mo`) accanto ai prezzi, convertendo in lettura, e di salvare il prezzo nella valuta dello strumento.

Da decidere in conversazione con l'utente (una domanda per volta, come vuole la skill `grilling`):

- si converte al cambio del mese, o si mostra il valore nella valuta del titolo e **non** si somma (totale etichettato «valuta mista»)?
- il cambio è quello di fine mese o la media del mese?
- la conversione vale solo per il **valore del conto** (la somma) o anche per il **grafico del singolo titolo**, che nella sua valuta è più leggibile?
- che cosa vede l'utente quando il cambio manca per un mese: come per i prezzi, si porta avanti l'ultimo noto marcandolo?
- il prezzo si conserva nella valuta dello strumento (il prezzo è un fatto, il cambio è un'opinione sostituibile): confermato?
- un titolo comprato su due borse diverse (stesso strumento, valuta diversa) è un titolo solo o due?

Esito atteso: la regola di conversione, che cosa si mostra quando il cambio non c'è, e dove si conservano i cambi.

## Answer

<!-- da scrivere alla chiusura -->
