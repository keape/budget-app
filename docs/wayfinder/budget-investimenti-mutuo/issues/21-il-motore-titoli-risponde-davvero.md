# Il motore titoli risponde davvero?

Type: task
Status: open

## Question

Che cosa fare: **misurare**, una volta, se il motore titoli funziona — in locale e dal backend di produzione — e fissare i numeri che tutto il resto del lavoro dà per scontati.

Perché è un biglietto a sé: la ricerca del biglietto «Lo storico dei prezzi dei titoli» ha scoperto che `https://query1.finance.yahoo.com/v8/finance/chart/...` ha risposto **HTTP 406 Not Acceptable** a tutte e quattro le chiamate di prova, senza corpo. Il codice usa `User-Agent: 'Mozilla/5.0 (compatible)'` (`server/routes/instruments.js:6`) e non controlla `response.ok`: se il 406 arriva anche dal server, il motore titoli **è già rotto in produzione** e nessuno se ne accorge, perché il fallimento degrada in silenzio sul prezzo vecchio conservato.

Le sette misure, in quest'ordine perché ognuna può cambiare le successive:

1. una chiamata con lo User-Agent attuale **dal server di produzione** e una in locale: che codice di stato torna?
2. la stessa con uno User-Agent di browser vero e `Accept: application/json,text/plain,*/*`: cambia qualcosa?
3. `range=2y&interval=1mo` e `range=5y&interval=1mo`: quanti punti tornano?
4. la data del primo timestamp mensile: inizio o fine mese?
5. `meta.currency` su `VWCE.DE` (atteso `EUR`) e su un ticker della Borsa di Londra (atteso `GBp`, cioè pence): è il caso che rompe la somma dei conti;
6. il verso di `EURUSD=X` (USD per EUR?), letto una volta sul valore della serie;
7. presenza di `adjclose` con `interval=1mo` e di `events.splits`.

Il comando pronto per le misure 2–7 è nel §0 della nota di ricerca (artefatto `.pi/fusion/01a0fe31-c4b0-71a0-87fa-34231641949e-67332/research-496450dd5175e311ff380ff2c7e6f1be`).

Esito atteso: i sette numeri scritti qui, e la risposta alla domanda che conta: **il prezzo dei titoli, in produzione, è aggiornato o fermo?** Se è fermo, il biglietto «Scaricare e conservare lo storico dei prezzi» parte da lì (User-Agent, `response.ok`, timeout) e non dallo storico.

## Answer

<!-- da scrivere alla chiusura -->
