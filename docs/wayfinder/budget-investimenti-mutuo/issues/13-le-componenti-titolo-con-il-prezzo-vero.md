# Le Componenti-titolo con il prezzo vero

Type: task
Status: open
Blocked by: 06, 22, 23, 24

## Question

Che cosa fare: fare in modo che una Componente-titolo valga **quantità × prezzo di mercato**, con il prezzo che arriva dal motore titoli.

Fatti verificati:

- `server/services/patrimonio.js` → `valoreComponente()` tratta `mercato` **come** `dichiarata`: legge `valutazione ?? costoAcquisto ?? 0`, con il commento «il prezzo arriva dal motore titoli nella Fetta 2». La stessa cosa fa `serieComponente()` → `serieDichiarata()`, che disegna una scaletta di dichiarazioni;
- `Componente` ha `nome`, `valorizzazione`, `costoAcquisto`, `dataCosto`, `valutazione`, `valutazioni[]`, `realizzo`, `chiusa` — e **non** ha ticker né quantità;
- il motore titoli sta in `server/routes/instruments.js` e il prezzo sul documento `Instrument` (`lastPrice`, `priceUpdatedAt`, cache 15 minuti).

Da fare:

- i campi nuovi sulla Componente secondo il biglietto «Il titolo dentro un conto investimenti» (ticker/strumento, quantità, prezzo di carico) e la regola di valore per `mercato`;
- la **serie mensile** di una Componente-titolo: non più una scaletta di dichiarazioni, ma il valore mese per mese dallo storico dei prezzi (come deciso per il grafico) moltiplicato per la quantità posseduta in quel mese;
- la lettura dei prezzi dallo storico, con la sua cache, senza rallentare `calcolaPatrimonio` (`server/services/patrimonio.js` è il posto unico dove il patrimonio si calcola: lì non si fanno chiamate di rete);
- il caso in cui il prezzo **manca** (ticker appena inserito, fonte giù): che valore mostra la Voce, e come lo dichiara.

Verifica: `node --check`, `npm run build`, e il confronto con la realtà: il valore di un conto investimenti con titoli veri deve corrispondere al valore che l'intermediario mostra, a meno del cambio se il titolo non è in euro (vedi il biglietto «Lo storico dei prezzi dei titoli»).

## Answer

<!-- da scrivere alla chiusura -->
