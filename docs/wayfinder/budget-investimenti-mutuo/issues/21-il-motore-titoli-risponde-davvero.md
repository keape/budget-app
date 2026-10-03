# Il motore titoli risponde davvero?

Type: task
Status: open

## Question

Che cosa fare: rispondere a **una** domanda — dall'IP di uscita di Render, il prezzo dei titoli è **aggiornato o fermo**? — e fissare i numeri che tutto il resto del lavoro dà per scontati.

**La premessa di questo biglietto è stata corretta il 2026-10-03, e la vecchia era sbagliata.** Era nato perché la ricerca di «Lo storico dei prezzi dei titoli» aveva visto `HTTP 406 Not Acceptable` a tutte le chiamate di prova, e ne aveva dedotto che il motore potesse essere rotto in produzione, in silenzio. Le misure in locale con lo **stesso** `User-Agent` del motore (`Mozilla/5.0 (compatible)`, `server/routes/instruments.js:6`) hanno risposto **200**: quel 406 veniva dall'ambiente dell'investigatore, non dal motore. La misura 2 però ha dato il contrario di quello che ci si aspettava — con uno User-Agent di browser vero la risposta è **429** — quindi cambiare User-Agent non è la cura. Le sette misure stanno nei commenti qui sotto.

Resta **la misura che conta**, e si fa senza rotte di debug e senza toccare i guardrail del repo:

- **dai dati**, che è la via più pulita e non chiede permessi: in produzione, quanti `Instrument` hanno `lastPrice` vuoto, e quali hanno `priceUpdatedAt` fermo da giorni. È il primo numero da guardare;
- **dalla rotta che l'app già usa**: `GET /api/instruments/:ticker/price` non è una rotta di manutenzione, è quella che chiama il frontend. Chiamarla sull'indirizzo di produzione con il token dell'app, due volte a più di 15 minuti di distanza (la cache è `PRICE_CACHE_TTL_MS`), e guardare se `priceUpdatedAt` sul documento si muove;
- **solo se quelle due non bastano**: la shell di Render, oppure — ultima spiaggia — una finestra di manutenzione breve e dichiarata con `ENABLE_ADMIN_ROUTES=true`, da spegnere subito dopo (`AGENTS.md`).

Esito atteso: la risposta, con i due numeri che la sostengono (`priceUpdatedAt` fermo da quanti giorni; quanti strumenti senza prezzo). **Se è fermo**, il biglietto «Scaricare e conservare lo storico dei prezzi» parte dalla robustezza (User-Agent, controllo di `response.ok`, timeout) e non dallo storico. **Se è aggiornato**, quel biglietto parte dallo storico — e la robustezza va scritta comunque, perché la `response.ok` che oggi non si controlla è un guasto che aspetta di accadere.

## Answer

<!-- da scrivere alla chiusura -->

## Comments

**Le sette misure, fatte in locale il 2026-10-03** con `curl` da questa macchina e lo `User-Agent` del motore (`Mozilla/5.0 (compatible)`, `server/routes/instruments.js:6`).

1. **200, non 406.** Chart `range=1d&interval=1d`, chart `range=3mo&interval=1mo` e la ricerca (`/v1/finance/search?q=VWCE`) rispondono tutte **200**. Il 406 non si riproduce.
2. Con uno User-Agent di browser vero (Chrome) e `Accept: application/json,text/plain,*/*`: **429**. Il senso della misura si è rovesciato: l'UA «da bot» è quello che funziona, quello da browser è quello che viene limitato.
3. `range=2y&interval=1mo` → **25 punti** (l'asse comincia a novembre 2024, non a ottobre); `range=max&interval=1mo` → **376 punti** (VWCE.DE parte a luglio 2019).
4. Il timestamp mensile è la **mezzanotte locale della borsa del primo giorno del mese**, e il valore è la chiusura di quel mese: la riga `2026-07-31 22:00 UTC` — che a Berlino è l'1 agosto 00:00 — vale **166,66**, cioè la chiusura del **31 agosto**. Verificato su tre piazze: Tokyo (`7203.T`: 1 agosto 00:00 JST = 31 luglio 15:00 UTC, dove `Europe/Rome` darebbe **luglio** invece di agosto), New York (`AAPL`: 1 agosto 00:00 EDT = 04:00 UTC, dove Roma per caso non sbaglia) e Berlino. Il primo bucket di una serie è l'eccezione: AAPL comincia il **1° dicembre 1984**, VWCE il **29 luglio 2019**, cioè il giorno di quotazione.
5. Valute: `VWCE.DE` → `EUR`, `ISF.L` → **`GBp`** (pence: la trappola c'è), ma `VUSA.L` → **`GBP`**. Non basta sospettare la piazza di Londra: `meta.currency` va letto a ogni chiamata.
6. `EURUSD=X` → `currency: USD`, valore **1,1254** = dollari per euro: per convertire in euro si **divide**.
7. `adjclose` **c'è** con `interval=1mo`. La chiave `events` invece **non compare affatto** quando il ticker non ha frazionamenti: le chiavi della risposta sono solo `indicators`, `meta`, `timestamp`.

**Una trappola di forma che le misure hanno aggiunto**: `range=3mo&interval=1mo` non torna tre righe per tre mesi di finestra, ne torna **quattro** — i due mesi chiusi (agosto e settembre), il bucket del mese nuovo **vuoto** (`close: null`, ottobre) e la riga di **oggi** col prezzo corrente. Vanno scartate in coppia, come i buchi interni, o il mese in corso entra nello storico con un valore che non è una chiusura. Riportata nel biglietto «Scaricare e conservare lo storico dei prezzi», che è dove serve.

**Il comando**: §0 di [`../assets/02-storico-prezzi-titoli.md`](../assets/02-storico-prezzi-titoli.md), la relazione di ricerca ora dentro la mappa.
