> Copia della relazione unita dai cinque modelli (`fusion_research`), prodotta il 2026-10-02 risolvendo il biglietto «Lo storico dei prezzi dei titoli». Il run grezzo (prompt dei candidati, risposte separate, eventi) resta in `.pi/fusion/01a0fe31-c4b0-71a0-87fa-34231641949e-67332/research-496450dd5175e311ff380ff2c7e6f1be`, percorso non versionato: questo file è la copia che vive con la mappa.

# Nota tecnica — Storico dei prezzi (chiusure mensili) dall'API chart di Yahoo Finance

## 0. Stato della verifica — leggere prima

Le quattro URL dichiarate sono state richieste più volte ciascuna e **hanno tutte risposto `HTTP 406 Not Acceptable`**, in modo riproducibile. Nessun corpo JSON è stato ottenuto.

Quindi, con precisione:

- **Verificato:** il 406 sistematico; la forma del codice esistente (`server/routes/instruments.js`); i modelli; il fatto che nessuno storico prezzi sia conservato da nessuna parte (lo dice esplicitamente `models/Fotografia.js`).
- **Non verificato dal vivo:** la forma esatta del JSON, il numero di punti per range, il valore reale di `meta.currency`, la presenza di `adjclose`.

Questo non è un dettaglio: **è il primo fatto rilevante del punto (3)**. Un client HTTP non-browser oggi viene respinto da `query1.finance.yahoo.com` prima di arrivare al codice dell'applicazione. Il rifiuto può dipendere dagli header, dall'IP o dal muro di consenso europeo — e quindi **può divergere tra il portatile in Italia e il server su Render (USA)**. Va misurato in entrambi i posti.

Il comando che trasforma i dubbi in misure (da eseguire dove gira il backend, e poi una volta in locale):

```bash
curl -sS -D /tmp/h.txt -o /tmp/aapl.json \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' \
  -H 'Accept: application/json,text/plain,*/*' \
  'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=2y&interval=1mo&events=div%2Csplit'
head -1 /tmp/h.txt
node -e '
const j=require("/tmp/aapl.json"), r=j.chart.result[0];
console.log("n =", r.timestamp.length, "| currency =", r.meta.currency);
console.log("chiavi indicators:", Object.keys(r.indicators));
console.log("primo :", new Date(r.timestamp[0]*1000).toISOString().slice(0,10));
console.log("ultimo:", new Date(r.timestamp.at(-1)*1000).toISOString().slice(0,10));
console.log("close :", r.indicators.quote[0].close.slice(0,3));
console.log("adjcl.:", r.indicators.adjclose?.[0]?.adjclose?.slice(0,3));
console.log("eventi:", Object.keys(r.events||{}));'
```

Da ripetere su `VWCE.DE` con `range=5y&interval=1mo` per leggere `meta.currency` e la lunghezza dello storico europeo.

**Da qui in avanti:** ciò che è marcato *osservato* viene da questa sessione o dal repository; ciò che è marcato *contratto* è la forma nota dell'endpoint `v8/finance/chart`, da confermare col comando qui sopra.

---

## 1. La chiamata per le chiusure mensili

### 1.1 URL da usare

```
Backfill (una volta per ticker, tutta la storia):
https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range=max&interval=1mo&includeAdjustedClose=true

Backfill limitato (dalla prima registrazione del conto):
https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1mo&period1={epoch}&period2={epoch}

Aggiornamento periodico (solo la coda che può cambiare):
https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range=3mo&interval=1mo

Prezzo corrente (quello che il codice usa già):
https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range=1d&interval=1d
```

Regole di accoppiamento: `interval=1mo` **non** è valido con `range=1d`/`5d`. I range utilizzabili con `1mo` sono `3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max`. `range=max&interval=1mo` restituisce la storia mensile dalla quotazione: è la scelta giusta per il backfill, perché una chiamata copre decenni invece di doverne concatenare cinque. `interval=1d` (quello in uso oggi) **non** dà chiusure mensili: dà una serie giornaliera che dovreste aggregare voi.

Parametri opzionali utili: `includeAdjustedClose=true` (default), `events=div%2Csplit` (aggiunge il blocco `events`), `includePrePost=false`.

### 1.2 Forma della risposta

```jsonc
{ "chart": {
    "result": [ {
      "meta": {
        "currency": "USD",              // ← la valuta (vedi §4)
        "symbol": "AAPL",
        "exchangeName": "NMS", "fullExchangeName": "NasdaqGS",
        "instrumentType": "EQUITY",     // EQUITY | ETF | MUTUALFUND | INDEX | CRYPTOCURRENCY
        "timezone": "EDT", "exchangeTimezoneName": "America/New_York",
        "gmtoffset": -14400,
        "regularMarketPrice": 195.0,    // prezzo vivo (quello che il codice legge oggi)
        "regularMarketTime": 1690000000,
        "chartPreviousClose": 194.5, "previousClose": 194.5,
        "firstTradeDate": 345479400,
        "dataGranularity": "1mo", "range": "max",
        "validRanges": ["1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"]
      },
      "timestamp": [ 1672531200, 1675209600, 1677628800, /* … */ ],   // ← epoch SECONDI
      "indicators": {
        "quote": [ { "open":[…], "high":[…], "low":[…],
                     "close":[…],          // ← prezzo NON aggiustato
                     "volume":[…] } ],
        "adjclose": [ { "adjclose":[…] } ]  // ← prezzo aggiustato (vedi §2)
      },
      "events": {
        "dividends": { "1672531200": { "amount":0.23, "date":1672531200 } },
        "splits":    { "1593480600": { "splitRatio":"4:1", "numerator":4, "denominator":1 } }
      }
    } ],
    "error": null
} }
```

Quattro cose che rompono il codice se non si sanno:

- **`timestamp` sono secondi epoch, non millisecondi.** `new Date(ts * 1000)`.
- **Gli array sono allineati per indice**, non per coppia: `close[i]` appartiene a `timestamp[i]`. Non esistono oggetti-giorno.
- **I buchi sono `null` dentro l'array**, non assenze: `close[i]` può essere `null` mentre `timestamp[i]` esiste. Un `null` non filtrato diventa `NaN` in Mongo e rompe il grafico: vanno scartate **insieme** la coppia `(timestamp[i], close[i])`.
- **Il fallimento può arrivare con HTTP 200.** Se il ticker non esiste: `{"chart":{"result":null,"error":{"code":"Not Found","description":"No data found, symbol may be disabled, delisted, or not yet traded"}}}`. Il codice attuale (`instruments.js:138-139`) legge `json?.chart?.result?.[0]?.meta` e in quel caso ottiene `undefined` — comportamento pericolosamente *silenzioso*. Va controllato **anche** `chart.error`.

### 1.3 Quanti punti, e come si ricava la chiave del mese

Conteggi attesi (*contratto*, da confermare col comando del §0):

| Chiamata | Punti attesi | Nota |
|---|---|---|
| `range=1d&interval=1d` | 1 | barra di oggi, ancora in corso |
| `range=1mo&interval=1d` | ~21–23 | un punto per giorno di borsa |
| `range=2y&interval=1mo` | ~24–25 | mesi dell'intervallo, più eventuale barra parziale in testa |
| `range=5y&interval=1mo` | ~60–61 | idem |
| `range=max&interval=1mo` | `mesi dalla quotazione` | AAPL: ~500+; VWCE.DE (nato 2019): ~70–80 |

La regola è «**mesi dell'intervallo, più al più una barra parziale in coda**»: non fidarsi del numero esatto, ricavarlo dalla risposta (`result[0].timestamp.length`). E `timestamp.length === quote[0].close.length` sempre.

**Semantica del timestamp mensile — e perché non serve risolverla prima.** Non è pacifico se Yahoo stampi la barra mensile al *primo* giorno di contrattazione del mese o all'*ultimo* giorno negoziato. Non serve saperlo: in entrambi i casi

```js
new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'UTC', year:'numeric', month:'2-digit' })
```

produce `'AAAA-MM'` corretto, perché sia il primo sia l'ultimo giorno cadono nello stesso mese. Il punto è **un altro**: il fuso. Usare il **fuso della borsa** (`meta.exchangeTimezoneName` / `meta.gmtoffset`) e non `Europe/Rome`: una barra di New York datata 31 luglio 20:00 EDT è già 1 agosto a Roma, e la chiave slitterebbe di un mese. È l'unico punto in cui un errore di un giorno produce un grafico spostato di un mese. Da verificare dal vivo con il comando del §0 (guardare se il primo timestamp cade il 1 del mese o a fine mese): in entrambi i casi la regola regge, ma vale la pena saperlo.

E il **mese in corso è provvisorio**: la sua `close` è l'ultimo prezzo finora, non la chiusura del mese. Va riscritto — ma, vedi §3, **non serve affatto chiederlo a Yahoo**: è `quantità × meta.regularMarketPrice`, già nella cache dei 15 minuti.

---

## 2. Aggiustato o no: `close` vs `adjclose`, e cosa comporta

Ci sono **due serie** nella stessa risposta, e la differenza decide se la curva è giusta:

- `indicators.quote[0].close` — **non aggiustato**: è il prezzo come fu stampato in borsa quel giorno.
- `indicators.adjclose[0].adjclose` — **aggiustato per dividendi e frazionamenti**, retro-corretto: l'ultimo valore coincide col `close`, i valori passati sono riabbassati.

| | Con `close` (grezzo) | Con `adjclose` |
|---|---|---|
| Un frazionamento 4:1 | la curva **crolla del 75%** il giorno dello split, se la quantità in app non è aggiornata | curva continua, nessun gradino |
| Un dividendo | la curva non stacca nulla: il prezzo stacca, il dividendo non entra | la curva sale come se il dividendo fosse reinvestito |
| Il livello del passato | è **il valore vero che l'intermediario mostrava** | è **più basso del vero** (è una curva di rendimento totale) |

**Decisione (definitiva, salvo diversa scelta di prodotto):**

- **Curva del valore delle posizioni nel conto → `close` non aggiustato.** Il valore di fine mese è `quantità posseduta in quel mese × prezzo di chiusura di quel mese`: è una fotografia del conto, e una fotografia si fa col prezzo vero. È anche ciò che dice il biglietto 13: «il valore che l'intermediatore mostra, a meno del cambio».
- **Grafico del singolo titolo (performance) → `adjClose`.** Lì la continuità visiva su dividendi e split è la cosa che rende leggibile la curva.
- **Conservare entrambe le colonne** (`close` e `adjClose`) in ogni riga: costo marginale nullo e consente di cambiare idea senza riscaricare nulla. `adjClose` può mancare su alcuni intervalli (tipicamente intraday) o essere `null`: leggerlo con optional chaining e, se assente, `adjClose = close`.

**Il prezzo da pagare con `close`:** la **quantità deve seguire i frazionamenti**, altrimenti la curva del conto mostra un buco che l'intermediario non mostra. Yahoo fornisce gli eventi già pronti in `result[0].events.splits` (`splitRatio: "4:1"`, `numerator`, `denominator`, `date`) e `events.dividends` (da chiedere con `&events=div%2Csplit`). Quindi: leggere `events.splits` al momento del backfill e applicare il rapporto alle quantità in quel mese. È la stessa domanda aperta nel biglietto `06-il-titolo-dentro-un-conto-investimenti.md` («la quantità si modifica a mano quando arriva un frazionamento?»): la risposta tecnica è che **non serve farlo a mano**, i dati ci sono.

Se invece si sceglie di non toccare mai la quantità, allora l'unica serie coerente è `adjClose` — **ma va dichiarato che quella curva non è più il valore del conto**, e che i valori passati *cambiano* quando arrivano nuovi dividendi o split (è una ricostruzione a posteriori, non un dato storicizzato). In quel caso non si mescolino le due politiche: o si ri-aggiorna tutto lo storico a ogni backfill, o si congela `adjClose` alla prima scrittura.

Un'ultima nota: i dividendi **non** entrano nel valore del conto con `close`. La liquidità incassata è una Voce separata, non un prezzo. Va deciso dove compare, ma non va nascosta dentro la serie dei prezzi.

---

## 3. Limiti pratici osservati e frequenza delle richieste

### 3.1 Cosa è stato osservato

**HTTP 406 su tutte e quattro le URL dichiarate, riproducibile, corpo vuoto.** Il client non-browser viene respinto. Questo cambia la valutazione del codice esistente:

- `YAHOO_USER_AGENT = 'Mozilla/5.0 (compatible)'` (`instruments.js:6`) è **esattamente** il tipo di User-Agent che gli edge moderni classificano come bot. È plausibile — **da verificare, non verificato qui** — che la stessa `const` produca 406 anche dal codice dell'app, e che il motore titoli sia già rotto in produzione senza che nessuno se ne accorga, perché i fallimenti degradano silenziosamente sul prezzo vecchio. **Prima prova da fare:** una chiamata sola dal server di produzione, e guardare il codice di stato.
- Il ripiego `query8` (`instruments.js:175`) non salva da un 406: è la stessa applicazione dietro un altro nome. Se il rifiuto è sull'User-Agent, cambiare host non cambia nulla. `query1`, `query2`, `query8` sono **lo stesso servizio su hostname diversi** (bilanciamento e ridondanza, non tier diversi): ruotarli è un rimedio contro un front-end degradato, non contro un 406.
- Asimmetria da sanare nel codice esistente: `query8` è usato in **un solo** posto (`GET /:ticker`), con TTL 24 h (`CACHE_TTL_MS`); `GET /:ticker/price` usa `query1` senza alcun ripiego, con TTL 15 min (`PRICE_CACHE_TTL_MS`). **Due cache e due timestamp per lo stesso prezzo**: da unificare.

### 3.2 Il resto dei limiti

- **429 / 999** — limitazione **per IP**, non per chiave (non ci sono chiavi). Su Render il piano gratuito **condivide l'IP in uscita** con altri tenant: la quota non è solo nostra, e il 429 arriva prima di quanto si aspetterebbe in locale. Va gestito con backoff esponenziale + jitter, rispetto di `Retry-After`, e **stop del giro** invece di ritentare a raffica. Il corpo di un 429 spesso **non è JSON** (pagina di errore dell'edge).
- **Cookie e crumb** — l'endpoint `v8/finance/chart` è storicamente il più permissivo e **non** richiede crumb. Lo richiedono `v7/finance/quote` e, sempre più spesso, `v1/finance/search` (che l'app usa, `instruments.js:57`). Se comparisse `401/403 "Invalid Crumb"`, la ricetta è: cookie da `https://fc.yahoo.com`, poi `https://query1.finance.yahoo.com/v1/test/getcrumb` con lo stesso cookie-jar, poi `&crumb=…`. **Non implementarlo in anticipo**: è una complicazione da aggiungere solo se osservata.
- **Muro del consenso (IP europeo)** — da un IP UE Yahoo può rispondere con una pagina HTML di consenso invece del JSON. Conseguenza concreta: **il comportamento in locale e su Render può divergere**, e un test che passa in locale può fallire in produzione o viceversa.
- **Nessun timeout, oggi.** `instruments.js` non usa `AbortSignal`/`AbortController` (l'unico `AbortController` del repo è in `server/utils/appleTokens.js:38`). Un socket Yahoo appeso tiene aperta la richiesta Express: su un piano gratuito si accumulano. Serve `AbortSignal.timeout(5000–8000)` su ogni chiamata — il pattern è già in casa.
- **Nessun controllo di `response.ok`, oggi.** In `GET /:ticker/price` (`instruments.js:135-136`) la `fetch` è seguita direttamente da `response.json()`; se Yahoo risponde con HTML (406, 429, muro di consenso), il parse **lancia**, il `catch` esterno (`:152`) restituisce **HTTP 500** — invece di servire il prezzo in cache. La rotta di ricerca invece ha un `try/catch` annidato (`:56-103`) e degrada correttamente. Va copiato il comportamento buono: **controllare `response.ok` e il `Content-Type` prima di `json()`**.
- **Dettaglio minore ma reale:** in `instruments.js:135` il ticker passa da `encodeURIComponent`, in `:175` **no**. Con `VWCE.DE`, `BRK-B`, `EURUSD=X` funziona lo stesso, ma è una divergenza gratuita.
- **L'API chart non è un'API pubblica con contratto e SLA**: è un endpoint interno del sito. Va progettata assumendo che possa cambiare o sparire.

### 3.3 Frequenza e ampiezza raccomandate

Il repo ha già una posizione chiara e va rispettata: **su Render un cron non è affidabile** (`server/routes/patrimonio.js:16`) e **il patrimonio non fa chiamate di rete** (biglietto `13`). Quindi niente cron e niente fetch dentro `calcolaPatrimonio`.

1. **Backfill: una richiesta per ticker, una volta sola nella vita.** `interval=1mo&range=max&events=div%2Csplit`. Venti titoli = venti richieste, mai più.
2. **Aggiornamento: `range=3mo&interval=1mo`, non `range=max`.** I mesi chiusi non cambiano; cambiano solo il mese in corso e, raramente, le ultime barre per rettifiche del fornitore. Si passa da una risposta da centinaia di punti a una da tre.
3. **Il mese in corso non si chiede affatto:** è `quantità × meta.regularMarketPrice`, già disponibile nella cache a 15 minuti. Ne segue che le barre mensili si chiedono **solo per i mesi chiusi** — che sono immutabili — cioè al più una volta al mese per ticker. Una verifica settimanale/mensile con `range=3mo` è il margine di sicurezza per le revisioni retroattive.
4. **Pattern: aggiorna-in-lettura con TTL**, lo stesso della Fotografia del mese corrente (`patrimonio.js:656`) — ma su una rotta separata, non dentro il calcolo del patrimonio. TTL 12–24 h, più un gesto esplicito «aggiorna i prezzi» per l'utente impaziente.
5. **Serializzare e sparpagliare:** mutex in-process per ticker (due utenti non devono scaricare lo stesso titolo due volte), concorrenza massima 2–3, jitter di 300–800 ms tra ticker, tetto per giro (~20 ticker), salto dei ticker già freschi (`lastHistoryFetchAt`). Mai `Promise.all` su tutti i ticker.
6. **Cache negativa 24 h per i ticker "not found"**, così un simbolo sbagliato non viene martellato a ogni apertura.
7. **Sempre: su fallimento servire il dato conservato**, mai un errore, mai uno zero.

---

## 4. In che valuta arriva il prezzo

Il campo è **`chart.result[0].meta.currency`**. Il codice lo legge già, correttamente, per il prezzo corrente (`instruments.js:140`): la stessa identica posizione vale per la serie mensile. È una stringa ISO 4217 — `"USD"`, `"EUR"`, `"CHF"` — con **due eccezioni che vanno conosciute**:

- **`"GBp"` (o `"GBX"`) = pence, non sterline.** Per gli strumenti quotati alla Borsa di Londra il prezzo è in centesimi di sterlina: `GBP = GBp / 100`. Senza questa divisione un ETF LSE vale cento volte tanto (in `meta` il campo `priceHint` vale 2 in quel caso). Va verificato su un ticker `.L`.
- **Gli indici** (`^GSPC`, `^FTSEMIB`) possono avere `meta.currency` nullo o non negoziabile: un indice non è un importo. Non usare un indice come Componente-titolo.

**Cosa implica per conti in euro.** `Instrument.currency` esiste già e viene popolata dal campo `quote.currency` della **ricerca** (`instruments.js:74`) — ma la fonte autorevole per una *serie di prezzi* è `meta.currency` della chart, e le due possono discordare (tipicamente proprio su GBp/GBP). Regola: **per la serie vince `meta.currency`**, e va salvata **su ogni riga**, non solo sullo strumento, così un cambio di valuta o di borsa è visibile invece che sommato in silenzio. Nota anche che `meta.currency` è la valuta **della quotazione**, non dell'ETF: lo stesso strumento comprato su Xetra e su Londra può avere valute diverse.

**Oggi la somma multi-valuta è già un errore silenzioso**: `Fotografia` somma i valori in un unico `patrimonio` e `services/patrimonio.js` non fa nessuna conversione. Un titolo USD sommato a uno EUR gonfia il Patrimonio e il grafico non lo mostra.

Per convertire servono **cambi mensili, non un tasso puntuale**, e si prendono dallo stesso motore, con la stessa cadenza:

```
https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?range=max&interval=1mo
https://query1.finance.yahoo.com/v8/finance/chart/EURGBP=X?range=max&interval=1mo
https://query1.finance.yahoo.com/v8/finance/chart/EURCHF=X?range=max&interval=1mo
```

Allora `valore_EUR(m) = quantità(m) × close(m) × cambio(m)`. Il verso del rapporto va **verificato una volta** sul valore della serie: `EURUSD=X` è quotato in **USD per EUR** (~1,09), quindi `EUR = USD / tasso`; `EURGBP=X` in GBP per EUR (~0,85), quindi `EUR = GBP / tasso`. La serie dei cambi si conserva nello stesso formato dello storico titoli.

**Dove salvare il prezzo:** nella **valuta dello strumento**, grezzo, con accanto il codice valuta — e convertire in lettura col cambio mensile conservato a parte. Salvare il prezzo già convertito in euro distrugge il dato originale: se il cambio va corretto, o se serve il grafico del singolo titolo nella sua valuta, si dovrebbe riscaricare tutto. Così il prezzo resta un fatto e il cambio è un'opinione, sostituibile.

**Regola minima accettabile finché la conversione non esiste:** mostrare la valuta accanto a ogni posizione e **non sommare** titoli non in EUR (oppure etichettare il totale come "valuta mista") invece di produrre una cifra falsa. Il biglietto 13 dice già «a meno del cambio se il titolo non è in euro» — questa è la parte che manca per renderlo vero.

---

## 5. Dove conservare lo storico in MongoDB

### 5.1 Raccomandazione: **collezione nuova, una riga per ticker e mese**

```js
// server/models/PriceHistory.js
const priceHistorySchema = new mongoose.Schema({
  ticker:    { type: String, required: true, uppercase: true, trim: true },
  month:     { type: String, required: true },   // 'AAAA-MM', stessa chiave dell'asse
  close:     { type: Number, required: true },   // prezzo di chiusura NON aggiustato
  adjClose:  { type: Number },                   // aggiustato (dividendi + frazionamenti)
  currency:  { type: String, required: true },   // meta.currency di QUELLA riga
  source:    { type: String, default: 'yahoo' },
  fetchedAt: { type: Date, default: Date.now }
});
priceHistorySchema.index({ ticker: 1, month: 1 }, { unique: true });
priceHistorySchema.index({ ticker: 1, month: -1 });
```

Tre scelte, e perché:

- **`month` è la stringa `'AAAA-MM'`.** Non è un capriccio: è già la chiave dell'asse dei grafici in `server/services/patrimonio.js` — `chiaveMese()`, `meseCorrenteChiave()`, `elencoMesi()`, e l'aggregazione `MESE_ROMA = { $dateToString: { format: '%Y-%m', … } }`. Usare la stessa chiave significa che la serie dei prezzi si aggancia all'asse **senza aritmetica sulle date**, e che `elencoMesi()` può riempire i buchi senza conversioni. Attenzione: nel repo convivono **due convenzioni di mese** — `Fotografia` usa `anno` + `mese` **0-indexato** (`min: 0, max: 11`), `SavingsMonth` usa `mese` apparentemente **1-indexato**. La stringa evita del tutto la trappola.
- **L'indice unico `{ticker, month}`** rende l'aggiornamento un `upsert` idempotente: riscrivere i tre mesi della coda è un'operazione sicura, ripetibile e **additiva** (non cancella mai).
- **`close` e `adjClose` insieme, `currency` per riga.** Vedi §2 e §4. La collezione è **globale, non per utente**: il prezzo di un titolo non appartiene all'utente (stessa scelta già fatta per `Instrument`, `ticker` unico). Aggiungere `userId` moltiplicherebbe le richieste a Yahoo per il numero di utenti — esattamente ciò che porta al 429. La per-utente-ness sta nelle quantità (`InstrumentAllocation`, già indicizzato).

### 5.2 Perché **non** un campo su `Instrument`, e perché non un array di mesi

- `Instrument` viene restituito **intero** al client dall'endpoint di ricerca: `return res.json({ success: true, data: combined })` (`instruments.js:95`) dove `combined` sono documenti `Instrument` completi. Incorporare la storia significherebbe **spedire centinaia di righe di prezzi al browser a ogni ricerca**.
- `Instrument.find()` è letto anche altrove, e il documento `Instrument` viene letto a ogni richiesta di prezzo: un documento che cresce senza limite appesantisce una rotta calda.
- L'aggiornamento di un mese nuovo dentro un array richiede `$push` con `arrayFilters` o un read-modify-write; la coppia chiave-valore rende l'upsert banale e atomico.
- Un array di mesi costringe a leggere **sempre l'intera serie** anche per una finestra di 12 mesi, senza possibilità di filtrare sul server. Con la riga per mese si fa un range-scan su indice; il vincolo dei 16 MB per documento, con l'array, è lontano ma non strutturalmente escluso.

### 5.3 Quanto costa rileggerlo

Numeri concreti: una riga pesa ~120–150 byte. Dieci ticker × dieci anni = **1.200 documenti ≈ 150 KB** in tutto. Il grafico del patrimonio su N mesi per T titoli è **una** query:

```js
const righe = await PriceHistory
  .find({ ticker: { $in: tickers }, month: { $gte: da, $lte: a } })
  .lean();                                  // niente idratazione Mongoose
const prezzi = new Map();                   // ticker → Map(mese → close)
for (const r of righe) { /* … */ }
```

Un range-scan su indice, 1.200 documenti, `lean()`: **millisecondi su una tier gratuita**, e meno di quanto già costa oggi `GET /api/patrimonio/serie`, che aggrega Spese, Entrate, Trasferimenti e Rettifiche (`flussiMensiliPerComponente`, `patrimonio.js:246`). Il pattern è già quello che il repo usa: costruire `Map` in memoria (`perComponente`).

Poi `valore(m) = quantità(t, m) × prezzi.get(t).get(m) × cambio.get(m)`. **Nessuna chiamata di rete dentro `calcolaPatrimonio`.**

**Dove passare i dati al client:** riusare `GET /api/patrimonio/serie`, che già restituisce la serie mensile completa per conto e viene chiesta a parte (`server/routes/patrimonio.js:72-95`; e il biglietto 15 dice di non appesantire la lista dei conti). La serie dei titoli sale sullo stesso carro: nessun giro in più, nessun costo sulla Home.

**Cosa NON salvare in Mongo:** la serie *calcolata* del valore del conto. Il repo ha una posizione precisa — «un dato solo» (ADR-0012), e la **Fotografia è una misura dichiarata**, non un valore derivato. La curva va ricalcolata da prezzi × quantità, così non diventa una seconda verità che diverge. Se una quantità viene corretta a posteriori, la curva calcolata cambia (giusto) mentre la Fotografia no (giusto, è il passato). Tenerle distinte è la stessa distinzione che il repo ha già fatto — **non** costruire la curva del conto dalle Fotografie esistenti, e **non** usare le Fotografie come se fossero prezzi.

**Dove passare i dati al client:** riusare `GET /api/patrimonio/serie` (già citata), che viene chiesta a parte e non appesantisce la lista dei conti.

---

## 6. Quando la fonte non risponde, o non conosce il ticker

| Situazione | Cosa si vede | Cosa deve fare l'app |
|---|---|---|
| **406** (osservato qui) | nessun JSON | User-Agent browser reale + `Accept: application/json,text/plain,*/*`; ripiego `query1→query2→query8`; **servire lo storico conservato** |
| **429 / 999** | corpo vuoto o HTML | backoff esponenziale + jitter, rispettare `Retry-After`, **fermare il giro**, servire lo storico conservato |
| **401/403 "Invalid Crumb"** | JSON d'errore | cookie + crumb (ricetta §3.2), **solo se osservato** |
| **Muro di consenso** (IP UE) | HTML al posto del JSON | `response.json()` lancia → **non deve diventare un 500**: controllare `response.ok` e il content-type prima di parsare |
| **Ticker inesistente** | **HTTP 404** con `chart.error.code = "Not Found"`, `result: null`; a volte **HTTP 200** con `chart.error` valorizzato | controllare **sia** `response.ok` **sia** `chart.error` **sia** `result == null`. Rifiutare il ticker in inserimento (via ricerca), non scoprirlo al momento del grafico. Distinguerlo dal guasto di rete: cache negativa 24 h + messaggio «simbolo non riconosciuto, controlla la borsa (es. suffisso `.DE`/`.MI`/`.L`)» |
| **Titolo delistato** | `result[0]` esiste ma la serie **finisce** alla data di delisting | **non** tirare la linea piatta fino a oggi: fermarla all'ultimo mese noto e marcarla |
| **Titolo illiquido** | `timestamp` con `close: null` | saltare la coppia `(timestamp, null)`, non trattarla come 0 |
| **Ticker con 0 punti nel range** | `timestamp` assente/vuoto | non scrivere nulla; l'upsert deve restare **additivo**, mai cancellare lo storico esistente |
| **Timeout / DNS / TLS** | `fetch` lancia | uguale a fonte giù: servire l'ultimo dato in Mongo e mostrare «aggiornato al …» |

**Le tre regole che l'app non deve violare:**

1. **Mai scrivere 0.** Uno zero in un mese distrugge la curva del patrimonio in modo silenzioso e sembra un dato. Un prezzo mancante è un dato mancante, non un prezzo nullo.
2. **Mai un 500, mai una pagina rotta.** Una fonte esterna giù non è un errore dell'utente. Il massimo consentito è un dato marcato come vecchio.
3. **Dichiarare la provenienza del punto.** L'asse non deve avere buchi — è una decisione già presa nel repo (`elencoMesi()`). Quindi, per un mese senza prezzo, si **porta avanti l'ultimo prezzo noto**, ma il punto va marcato (`carriedFrom: 'AAAA-MM'`) e distinto da un punto osservato. La linea resta piatta — che è la verità — e l'app sa dire *perché*.

**Rete di sicurezza già in casa (da usare, non da reinventare):** una Componente con `valorizzazione: 'dichiarata'` vale la sua ultima `valutazione` (`services/patrimonio.js:228-230`). Un titolo senza quotazione può quindi ricadere sul valore che l'utente dichiara, invece di sparire dal Patrimonio o valere zero. Vale la pena scriverlo nel biglietto 13: un titolo senza prezzo **non** deve sparire dal conto né valere zero.

**Diagnostica:** un endpoint `GET /api/instruments/:ticker/diagnostica` che restituisce `lastSyncAt`, codice HTTP dell'ultimo tentativo, numero di punti e valuta è il modo per accorgersi in un minuto che Yahoo ha cambiato le carte, senza leggere i log di Render.

---

## 7. Cose da verificare prima di scrivere codice

Nell'ordine, perché ognuna può cambiare le successive:

1. **Da dove parte il 406.** Una chiamata dal server di produzione con lo User-Agent attuale: se risponde 406, il motore titoli è già rotto oggi e il §3 va riscritto di conseguenza.
2. **Il conteggio dei punti** per `range=2y&interval=1mo` e `range=5y&interval=1mo`, col comando del §0.
3. **La data del primo timestamp mensile** (inizio o fine mese).
4. **`meta.currency` su `VWCE.DE`** (atteso `EUR`) e su un ticker LSE (atteso `GBp`): è il caso che rompe la somma dei conti.
5. **Il verso di `EURUSD=X`**, una volta, sul valore della serie.
6. **Presenza di `adjclose`** su `interval=1mo` e presenza di `events.splits` (per la gestione delle quantità).
7. **Un caso reale di split** su un titolo in portafoglio: verificare che `close` grezzo + quantità aggiustata ricostruisca il valore che mostra il broker.

**In una riga ciascuno:** (1) `range=max&interval=1mo` per il backfill, `range=3mo&interval=1mo` per gli aggiornamenti; timestamp in secondi, array allineati per indice con `null` da filtrare. (2) `close` per il valore del conto — gestendo i frazionamenti sulle quantità da `events.splits` — e `adjClose` per il grafico di performance; conservarli entrambi. (3) Header da browser obbligatori, 429 per IP condiviso, niente crumb per `chart`, `query1/2/8` sono lo stesso servizio; backfill una volta, poi al più una richiesta per ticker al mese, serializzate, con timeout, backoff e cache negativa. (4) `meta.currency`, attenzione a `GBp`; salvata su ogni riga; senza cambi mensili nessun conto in euro può sommare valute diverse. (5) Una riga per `(ticker, month)` con indice unico, `close`/`adjClose`/`currency`, `lean()` e una query per grafico; mai rete sul percorso di lettura, mai la curva calcolata in Mongo. (6) 404 «Not Found» ≠ guasto di rete ≠ 429; mai sovrascrivere lo storico, mai inventare prezzi, degradare al valore conservato (o dichiarato) e mostrare la data del dato.