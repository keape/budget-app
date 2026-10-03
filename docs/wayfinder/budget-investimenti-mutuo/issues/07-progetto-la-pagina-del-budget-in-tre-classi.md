# Progetto: la pagina del budget in tre classi

Type: prototype
Status: open
Blocked by: 05

## Question

Che **forma** ha la pagina del budget quando le categorie sono in tre classi?

Il biglietto «Che numero si confronta in ogni classe» decide le regole; qui si fa un artefatto grezzo da guardare e da criticare, non codice di produzione: un file HTML usa-e-getta (o un disegno, se la domanda è più strutturale che visiva) da mettere in `assets/` e da linkare qui.

Da mettere in chiaro, guardandolo:

- come convivono la lettura **mensile** (fisse e flessibili) e quella **annuale** (non mensili) nella stessa pagina: due riquadri, due schede, o un blocco sopra e uno sotto;
- che cosa si vede **per prima**: il totale del mese, la somma delle fisse, oppure le categorie;
- il grafico: quello di oggi è una barra per categoria (previsto contro speso). Con tre classi serve ancora, e che cosa mostra per le non mensili;
- l'interruttore **uscite / entrate / tutte**: con le classi solo sulle uscite, che cosa mostra «tutte»;
- che cosa vede una **categoria senza classe** (dipende dal biglietto «Chi assegna la classe a una categoria»);
- come si legge lo **scostamento** nella stessa occhiata: colore, segno, numero grande;
- la pagina sul telefono (le tabelle attuali hanno una versione `ResponsiveTable`).

La pagina esiste già: `src/Budget.js` (128 righe) con `BudgetHeader`, `BudgetSummary`, `BudgetChart`, `BudgetTable` e gli hook `useBudgetData` / `useBudgetCalculations`. Il prototipo dice che cosa di quella struttura resta e che cosa sparisce.

Esito atteso: il prototipo in `assets/`, la scelta della forma discussa con l'utente, e le decisioni registrate nel biglietto.

## Answer

<!-- da scrivere alla chiusura -->
