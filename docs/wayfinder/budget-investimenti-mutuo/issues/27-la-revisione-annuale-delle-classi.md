# La revisione annuale delle classi

Type: task
Status: open
Blocked by: 09, 10

## Question

Che cosa fare: il **promemoria annuale** deciso nel biglietto «Chi assegna la classe a una categoria», che riapre una volta l'anno la schermata di «La prima classificazione delle categorie esistenti» con le classi attuali da confermare o correggere.

Il biglietto nasce dalla conversazione su «Chi assegna la classe a una categoria» e non era nella mappa: lì si è deciso che la classe nasce **obbligatoria** con la categoria (quindi non si accumulano categorie non classificate) e che è una proprietà **attuale**, senza storia. Ciò che allora invecchia non è la categoria ma **l'etichetta**: quella che pagavi ogni mese e ora esce due volte l'anno resta letta come fissa, e niente lo dice. Il controllo annuale è la controparte di quel rischio, come il controllo del residuo lo è per il Tasso ricavato (`docs/adr/0017`).

Da fare:

- **dove si registra quando la revisione è stata fatta l'ultima volta** — un campo sull'utente o sulla Categoria, oppure una piccola collezione: è la sola cosa che questo biglietto deve ancora decidere, e va decisa guardando il codice che esiste (`server/models/User.js`, `server/routes/auth.js`), non inventando una collezione per un dato solo;
- l'**avviso** nella Home, con `addMultipleNotifications` da `src/contexts/NotificationContext.js` — `src/Home.js:3,36` mostra già come si fa — che riapre la schermata con le classi attuali già selezionate, in un giro solo;
- la **chiusura del giro** aggiorna la data, così l'avviso non torna prima di un anno; rinunciare al giro non aggiorna niente;
- **nessuna euristica** che indichi la categoria sospetta: deciso che il promemoria è un appuntamento, non un sospetto calcolato. Se un giorno servirà, è una decisione nuova;
- la stessa schermata serve due mestieri (prima classificazione e revisione): decidere se è **un componente riusato** o due, senza duplicarla;
- chi esegue «Le tre classi nelle altre viste» e «La rata automatica» tocca `src/Home.js`: vale la nota della mappa (un file, un mestiere per volta), quindi guardare chi è arrivato prima prima di scriverci.

Verifica: la data si aggiorna **solo** chiudendo il giro; l'avviso non compare due volte nello stesso anno; con un giro rinunciato la data resta vecchia; `node --check` sui file server toccati, `npm run build`, e un giro a mano forzando la data a un anno fa.

## Answer

<!-- da scrivere alla chiusura -->
