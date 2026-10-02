# Le voci patrimoniali sono contenitori di componenti

---
Status: accepted
---

Ogni Voce patrimoniale è composta da una o più **Componenti**, ed è la somma delle loro valorizzazioni: un conto Gioielli contiene i singoli pezzi, un conto investimenti contiene i titoli e la liquidità non ancora investita, un mutuo contiene il suo residuo. La conseguenza strutturale è che la modalità di valorizzazione (a movimenti, a mercato, dichiarata) appartiene alla **Componente**, non alla Voce: nello stesso conto investimenti convivono titoli a mercato e liquidità a movimenti. La scelta è stata fatta esplicitamente dall'utente, contro la raccomandazione di un valore unico per voce, perché vuole che l'aggiunta di un bene («se ne aggiungo un altro il movimento deve essere rendicontato e se ne deve dare evidenza») sia tracciata e ricostruibile pezzo per pezzo.

## Considered Options

- **Valore unico per Voce** (raccomandata, scartata): meno lavoro e nessuna scheda da compilare; i pezzi sarebbero rimasti nelle note del movimento. Scartata per preferenza dell'utente. Era reversibile in senso additivo, quindi non c'era un costo di cambio.
- **Componenti solo per i conti investimenti**, valore unico per immobili, veicoli e beni di valore: scartata perché introduceva due regole diverse per la stessa cosa.

## Consequences

- La valorizzazione di una Voce non è più un attributo della Voce ma della sua Componente. Il modello delle tre modalità (movimenti, mercato, dichiarata) resta, ma si applica un livello più in basso.
- Serve una scheda per Componente (nome, valore, data, eventuale documento) e le viste di patrimonio devono saper scendere dal totale alla Voce al singolo pezzo.
- Una Componente si vende da sola: si chiude al suo Realizzo, la differenza rispetto all'ultima Valutazione è una Plusvalenza, e il ricavato entra nella Voce che incassa.
- Il conto investimenti è il caso in cui questa scelta si incrocia con il modulo Risparmi esistente: i "titoli" di una Componente sono gli Strumenti già tracciati da quel modulo, che oggi non conoscono né il broker né la liquidità non investita.
- Il finto conto corrente strumentale (uno Strumento di tipo `conto_corrente` su cui il modulo accumula il risparmio transitato: in positivo quando il risparmio era destinato al conto, in negativo quando il mese chiudeva in perdita) viene smontato: il suo saldo accumulato diventa il saldo del Conto principale. Prima di toccare i dati di produzione va verificato quanti utenti e quante allocazioni sono coinvolti.
- Il motore titoli resta separato e viene **incapsulato** come motore delle Componenti-titolo dentro i conti investimenti, invece di essere riscritto sul modello a Componenti: si tocca il meno possibile un modulo che funziona e i portafogli esistenti continuano a essere calcolati dalla stessa logica.
- Le Allocazioni e le Vendite già registrate non conoscono il broker: si crea un conto investimenti di partenza e vi si assegna tutto lo storico, sul modello del Conto principale per i movimenti.
