# La plusvalenza e il prezzo di carico: una definizione sola

Type: grilling
Status: open

## Question

Che cosa vuol dire **plusvalenza**, e dove sta il **prezzo di carico**? Oggi il progetto ha due definizioni della prima e tre posti per il secondo.

Fatti (dal biglietto «Che cosa è riusabile del modulo Risparmio»):

- il lessico dice «Plusvalenza = Realizzo − ultima Valutazione» (`GLOSSARY.md:82-83`);
- il codice del risparmio calcola «ricavo − costo di carico medio» (`server/models/InstrumentSale.js:14`, calcolato in `server/routes/savings.js:385`): due basi contabili diverse con lo stesso nome, e la Componente non ne calcola nessuna;
- il prezzo di carico vive in tre posti: dichiarato sulla Componente (`costoAcquisto` + `dataCosto`, `server/models/Componente.js:63-64`), calcolato dal Risparmio come `Σamount / Σquantity` (`savings.js:487`, `:382`), e un `priceAtAllocation` che viene scritto e **mai riletto** (`InstrumentAllocation.js:27-30`, `savings.js:137`, `:157`);
- `Componente.realizzo` è scritto e mai letto (`server/routes/componenti.js:67-72`).

Da decidere in conversazione con l'utente (una domanda per volta, come vuole la skill `grilling`):

- la plusvalenza è «Realizzo − ultima Valutazione» o «ricavo − costo di carico»? Oppure sono **due numeri diversi** che vogliono due nomi diversi (uno economico, uno fiscale)?
- il prezzo di carico si **dichiara** sulla Componente o si **calcola** dalle quantità comprate? Se si compra in due tranche a prezzi diversi, il carico è medio (come fa oggi il Risparmio) o per tranche?
- la plusvalenza si **congela** al momento della vendita (come fa `InstrumentSale`) o si ricalcola ogni volta (e allora cambia se si corregge una riga vecchia)?
- `priceAtAllocation`: diventa il prezzo di carico della Componente, o sparisce?
- che cosa entra nel lessico: quali parole, e con quale `_Avoid_`.

Esito atteso: una definizione sola per la plusvalenza e una per il prezzo di carico, scritte in `GLOSSARY.md` (skill `domain-modeling`), più il verdetto su `priceAtAllocation`. Se la decisione è difficile da rovesciare e sorprendente, merita una ADR in `docs/adr/`.

## Answer

<!-- da scrivere alla chiusura -->
