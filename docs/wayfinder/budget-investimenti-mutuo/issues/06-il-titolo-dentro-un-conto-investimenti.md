# Il titolo dentro un conto investimenti

Type: grilling
Status: open

## Question

Che cos'è, esattamente, **un titolo dentro un conto investimenti** — e che cosa vuol dire comprarlo?

Deciso in fase di disegno: i titoli usano il motore esistente (`Instrument`, con ticker e prezzo), quindi una Componente-titolo dovrà portare ticker, quantità, costo di acquisto e data. Restano da decidere le cose che intorno a questo cambiano il modello e la pagina.

Sotto-domande, in conversazione con l'utente (una domanda per volta):

- la Componente-titolo porta la **quantità** e il prezzo di carico *unitario* (o il costo totale)? E la quantità si modifica a mano quando arriva un frazionamento?
- comprare un titolo è **un gesto solo** (dichiari ticker, quantità, prezzo, data) che scrive la Componente e il Trasferimento dalla liquidità, oppure due gesti separati (il Trasferimento lo registri tu)? Oggi le Componenti si creano con la rotta `POST /api/voci/:id/componenti` e i movimenti sono cose a parte;
- dentro un conto investimenti convivono titoli a **mercato** e **liquidità** a movimenti (lo dice l'ADR-0002): che cosa mostra la scheda del conto — un valore unico, o titoli e liquidità separati?
- quali conti entrano nel **grafico d'insieme**: i conti di tipo Investimenti, o qualunque conto che contenga almeno un titolo?
- vendere: si chiude la Componente con il Realizzo (come dice l'ADR-0002) e il ricavato entra nella liquidità del conto; chi scrive il Realizzo, l'utente o l'app dal prezzo del giorno?
- un titolo comprato in **due tranche** è una Componente sola con due acquisti, o due Componenti?
- **vendere una parte**: una vendita parziale non è esprimibile come Realizzo di una Componente (il Realizzo è un numero solo, senza quantità: `server/models/Componente.js:71-74`, `server/routes/componenti.js:57-64`), mentre il vecchio modulo ha un documento per evento di vendita (`InstrumentSale`: quantità, prezzo, `proceeds`, `costBasis`, `capitalGain`). Si riduce la quantità della Componente lasciando traccia in `InstrumentSale`, o si spezza la Componente in due pezzi?

Esito atteso: i campi di una Componente-titolo e i gesti dell'utente (comprare, vendere, aggiornare), con la distinzione fra titoli e liquidità dentro il conto.

## Answer

<!-- da scrivere alla chiusura -->
