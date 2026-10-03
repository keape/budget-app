# Progetto: il grafico d'insieme degli investimenti

Type: prototype
Status: open
Blocked by: 06

## Question

Che **forma** ha la vista d'insieme degli investimenti, e dove vive?

Si cerca una vista «dall'alto»: i conti investimenti con i titoli che contengono, e il loro andamento nel tempo. Il biglietto «Il titolo dentro un conto investimenti» decide che cos'è un titolo; qui si disegna la vista e si sceglie dove sta.

Da decidere guardando il prototipo (file HTML usa-e-getta in `assets/`, oppure un diagramma con la skill `archify`):

- **dove vive**: una pagina nuova «Investimenti», in cima a `Patrimonio.js`, o dentro `Savings.js`? Oggi il grafico d'insieme del patrimonio sta in `Patrimonio.js` (Curva o Ripartizione, con `SelettoreVista` e `SelettorePeriodo`);
- che cosa disegna: **una curva sola** del valore dei conti investimenti (come `SerieChart` fa per il patrimonio), una **linea per ogni titolo**, oppure una curva con i titoli impilati (come `PatrimonioBreakdown` fa per i Tipi);
- il **periodo**: gli stessi quattro di oggi (ultimo mese, 90 giorni, da inizio anno, sempre), riusando `SelettorePeriodo` e `filtraPeriodo` da `src/utils/patrimonioFormat.js`;
- che cosa si legge accanto al grafico: il valore di oggi, la differenza dall'acquisto (guadagno o perdita), il peso di ogni titolo;
- il **punto di partenza della curva**: se lo storico non arriva abbastanza indietro, la curva comincia tardi — come si dichiara (la pagina del patrimonio già lo fa con una nota sotto il grafico);
- la vista sul telefono.

Esito atteso: il prototipo in `assets/`, la forma scelta con l'utente, e la decisione su dove vive la vista.

## Answer

<!-- da scrivere alla chiusura -->
