# La prima classificazione delle categorie esistenti

Type: task
Status: open
Blocked by: 09

## Question

Che cosa fare: far **classificare una volta** le categorie che esistono già, secondo la regola decisa nel biglietto «Chi assegna la classe a una categoria».

Perché è un biglietto a sé: la prima classificazione non è una schermata qualunque, è il momento in cui i dati vecchi diventano leggibili nel nuovo modo, e va fatta **una volta sola**, vedendo tutte le categorie insieme. Le categorie senza classe devono restare visibili come «da classificare», altrimenti spariscono dalla lettura senza che nessuno se ne accorga.

Da fare:

- la schermata (dentro `src/BudgetSettings.js`, che già gestisce nome, icona, archiviazione, o dove il biglietto «Progetto: la pagina del budget in tre classi» decide) con l'elenco delle categorie e la classe a tre scelte, più il previsto annuale per le non mensili;
- la proposta automatica per nome, se il biglietto «Chi assegna la classe» la prevede, dichiarata come proposta e correggibile;
- il conteggio di quante restano senza classe, con un rimando che non scompaia;
- le **entrate restano fuori** (deciso: le classi valgono solo per le uscite).

Verifica: dopo il giro nessuna categoria di uscita resta senza classe, oppure quelle che restano sono elencate e visibili; `npm run build`; un giro a mano sulle categorie vere dell'utente.

## Answer

<!-- da scrivere alla chiusura -->
