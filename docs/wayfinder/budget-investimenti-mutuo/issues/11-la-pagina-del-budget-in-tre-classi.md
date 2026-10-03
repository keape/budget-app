# La pagina del budget in tre classi

Type: task
Status: open
Blocked by: 07, 09, 17

## Question

Che cosa fare: costruire la pagina del budget nella forma decisa dal biglietto «Progetto: la pagina del budget in tre classi», e far parlare le rotte del budget in tre classi.

Da fare:

- le rotte che servono (oggi `server/routes/budgetSettings.js` legge e scrive gli importi mensili dentro il documento del mese, e `server/routes/categorie.js` legge l'elenco dei nomi): aggiungere la lettura per classe e il previsto annuale, senza rompere il formato vecchio finché la migrazione non è chiusa;
- `src/Budget.js` e i suoi pezzi (`BudgetHeader`, `BudgetSummary`, `BudgetChart`, `BudgetTable`) nella forma nuova, più gli hook `useBudgetData` / `useBudgetCalculations` (attenzione: `useBudgetData` oggi legge tutti i mesi dell'anno per calcolare medie e confronti — con le classi, quella lettura cambia);
- la riga di spiegazione sotto il grafico, come fanno `Patrimonio.js` e `ContoDettaglio.js` quando la curva non arriva abbastanza indietro: la pagina deve dire **da quando** misura;
- il collaudo sui misi dell'utente, non su dati di prova.

Verifica: `node --check` sui file server toccati, `npm run build`, e un giro a mano che confronti i totali della pagina nuova con una somma fatta a mano su due o tre mesi reali: la somma delle classi deve dare il totale, e il totale delle uscite non deve cambiare rispetto a oggi.

## Answer

<!-- da scrivere alla chiusura -->
