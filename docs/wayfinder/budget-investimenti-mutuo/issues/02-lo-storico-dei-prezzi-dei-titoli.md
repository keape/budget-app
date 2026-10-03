# Lo storico dei prezzi dei titoli

Type: research
Status: resolved
Assignee: Pi (sessione di disegno)

## Question

Come si ricava e si conserva lo **storico dei prezzi** di un titolo, partendo dal motore che esiste già?

Fatti verificati:

- `server/routes/instruments.js` legge il prezzo corrente da `https://query1.finance.yahoo.com/v8/finance/chart/<ticker>?range=1d&interval=1d`, con ripiego su `query8`, e tiene il prezzo sul documento `Instrument` con cache di 15 minuti (`PRICE_CACHE_TTL_MS`);
- la ricerca usa `https://query1.finance.yahoo.com/v1/finance/search` con cache di 24 ore;
- **nessuno storico è conservato da nessuna parte**: né in MongoDB né altrove;
- `Componente` ha `valutazioni` (valore + data + nota), che è la storia delle *dichiarazioni* dell'utente, non dei prezzi di mercato.

Da rispondere:

1. quale chiamata dà i prezzi di chiusura **mensili** (che `range` e che `interval`), e che forma ha la risposta;
2. i limiti pratici: quanti ticker si possono chiedere, con quale frequenza, se servono `User-Agent`, cookie o crumb, e che cosa succede quando la fonte non risponde (429, timeout);
3. se il prezzo è aggiustato per dividendi e split o no, e che cosa comporta per una curva di valore;
4. **in che valuta** arriva il prezzo (`meta.currency`) e che cosa serve quando la valuta dello strumento non è l'euro;
5. dove conservare la serie: una collezione nuova (una riga per ticker e mese) o un campo sul documento `Instrument`, e quanto costa rileggerla per disegnare i grafici.

Esito atteso: la chiamata esatta con la forma del dato, i limiti, e la raccomandazione su dove conservare lo storico con il relativo costo di lettura.

## Answer

Nota completa dell'investigatore (30 KB): [`../assets/02-storico-prezzi-titoli.md`](../assets/02-storico-prezzi-titoli.md). Qui l'essenziale operativo.

**Il primo fatto non è una buona notizia.** Le quattro chiamate di prova a `query1.finance.yahoo.com/v8/finance/chart/...` hanno risposto **HTTP 406 Not Acceptable**, tutte e quattro, in modo riproducibile, con corpo vuoto. Un client non-browser viene respinto prima di arrivare al codice. `server/routes/instruments.js:6` usa `User-Agent: 'Mozilla/5.0 (compatible)'` — esattamente il tipo di stringa che gli edge classificano come bot — e `GET /:ticker/price` (`:135-136`) va dritto a `response.json()` senza controllare `response.ok`. È quindi plausibile che il **motore titoli sia già rotto in produzione**, in silenzio, perché il fallimento degrada sul prezzo vecchio conservato. Va misurato: biglietto «Il motore titoli risponde davvero?». Finché non è misurato, la forma esatta del JSON resta «contratto noto, non verificato dal vivo».

**La chiamata.** Backfill: `?range=max&interval=1mo&events=div%2Csplit` (una richiesta per ticker, una volta nella vita). Aggiornamento: `?range=3mo&interval=1mo`. `interval=1mo` non è valido con `range=1d`/`5d`; i range validi sono `3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max`. `interval=1d`, quello in uso oggi, **non** dà chiusure mensili.

**Quattro trappole di forma.** I `timestamp` sono in **secondi** epoch (non millisecondi). Gli array sono allineati **per indice** (`close[i]` ↔ `timestamp[i]`): non esistono oggetti-giorno. I buchi sono **`null` dentro l'array**, non assenze: vanno scartate insieme la coppia `(timestamp[i], close[i])`, altrimenti un `NaN` finisce in Mongo. E il fallimento può arrivare con **HTTP 200**: se il ticker non esiste, `chart.result` è `null` e `chart.error` è valorizzato — `instruments.js:138-139` legge solo `result[0].meta` e ottiene `undefined`, sempre in silenzio.

**La chiave del mese.** `new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'UTC', … })` → `'AAAA-MM'`, la **stessa chiave dell'asse** già usata in `server/services/patrimonio.js` (`chiaveMese`, `MESE_ROMA`, `elencoMesi`). Attenzione al fuso: si usa il fuso della borsa (`meta.exchangeTimezoneName`), non `Europe/Rome`, altrimenti una barra di New York del 31 luglio slitta ad agosto e il grafico si sposta di un mese.

**Aggiustato o no.** La risposta porta **due serie**: `close` (grezzo) e `adjclose` (aggiustato per dividendi e frazionamenti). Regola: `close` per il **valore del conto** — una fotografia si fa col prezzo vero, ed è quello che mostra l'intermediario — e `adjClose` per il **grafico di performance** del singolo titolo, dove la continuità su dividendi e split è ciò che rende leggibile la curva. Conservarle entrambe costa nulla. Con `close` la quantità deve seguire i frazionamenti, e i dati ci sono già: `events.splits` porta `splitRatio`, `numerator`, `denominator`, `date`. Quindi la domanda aperta nel biglietto «Il titolo dentro un conto investimenti» ha risposta: **la quantità non si aggiorna a mano, si ricava**.

**La valuta.** `meta.currency`, ISO 4217, con due trappole: **`GBp`/`GBX` sono pence, non sterline** (dividere per 100 — è il caso che fa valere cento volte tanto un ETF di Londra), e gli **indici** non sono importi. Oggi la somma multi-valuta è già un errore silenzioso: `Fotografia` somma tutto in un unico `patrimonio` e `services/patrimonio.js` non converte niente. Servono **cambi mensili** (`EURUSD=X`, `EURGBP=X`, `EURCHF=X` con `interval=1mo`) conservati a parte, e il prezzo resta nella valuta dello strumento: il prezzo è un fatto, il cambio è un'opinione sostituibile. È diventato il biglietto «Un titolo in un'altra valuta dentro un conto in euro».

**Dove conservarlo.** Collezione nuova `PriceHistory`, **una riga per ticker e mese**: `{ ticker, month: 'AAAA-MM', close, adjClose, currency, source, fetchedAt }`, indice unico `{ticker, month}` (upsert idempotente e additivo). **Non** un campo su `Instrument`: quel documento viene restituito intero al client dalla ricerca (`instruments.js:95`) e letto a ogni richiesta di prezzo. Collezione **globale, non per utente**, come `Instrument`: il prezzo non appartiene all'utente, e moltiplicarlo per utente moltiplicherebbe le richieste a Yahoo. Costo: dieci ticker per dieci anni ≈ 1.200 righe ≈ 150 KB, una query con `lean()` per grafico — millisecondi, meno di quanto già costa `GET /api/patrimonio/serie`. La serie **calcolata** del conto non si salva: si ricalcola (una sola verità, come dice l'ADR-0012 per la Fotografia).

**Quando la fonte non risponde.** Tre regole: mai scrivere `0` (uno zero silenzioso distrugge la curva e sembra un dato); mai un 500 (una fonte esterna giù non è un errore dell'utente); dichiarare la provenienza del punto (si porta avanti l'ultimo prezzo noto, ma marcato, perché l'asse non deve avere buchi). E i pezzi che oggi mancano del tutto: `AbortSignal.timeout(5–8 s)` (nel repo l'unico `AbortController` è in `server/utils/appleTokens.js:38`), il controllo di `response.ok` e del `Content-Type` **prima** di `json()`, il backoff con jitter sul 429 (l'IP di uscita di Render è **condiviso** con altri tenant, quindi la quota non è solo nostra), la cache negativa 24 h per i ticker inesistenti, la concorrenza 2–3 con mutex per ticker. Rete di sicurezza già in casa: una Componente `dichiarata` vale la sua ultima `valutazione` (`services/patrimonio.js:228-230`) — un titolo senza prezzo non deve sparire dal conto né valere zero.

**Da non fare:** nessun cron (su Render non è affidabile) e nessuna chiamata di rete dentro `calcolaPatrimonio`; l'aggiornamento è un «aggiorna in lettura con TTL» su una rotta separata, più un gesto esplicito «aggiorna i prezzi».

## Comments

Investigatore `fusion_research`: riuscito. Le sette misure che restano da fare dal vivo sono diventate il biglietto «Il motore titoli risponde davvero?»; la collezione e il lettore sono diventati «Scaricare e conservare lo storico dei prezzi»; la valuta è diventata «Un titolo in un'altra valuta dentro un conto in euro».
