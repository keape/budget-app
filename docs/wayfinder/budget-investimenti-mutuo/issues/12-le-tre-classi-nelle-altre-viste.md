# Le tre classi nelle altre viste

Type: task
Status: open
Blocked by: 01, 09, 17

## Question

Che cosa fare: portare le tre classi (dove ha senso) nelle **altre viste** che oggi leggono il budget per categoria, partendo dalla checklist del biglietto «L'elenco dei punti che leggono il budget per categoria».

Il biglietto esiste perché il rischio qui non è tecnico ma di **dimenticanza**: se una sola aggregazione continua a sommare le categorie come prima, un totale non torna con la somma delle sue parti.

Punti attesi dalla checklist (da confermare con quel biglietto): `src/Home.js` (totali di oggi, settimana, mese, categoria più spesa), `src/components/MonthlySummaryChart.js`, `src/components/PatrimonioRiepilogo.js`, `src/Transazioni.js` e `src/Filtri.js` (form di inserimento, filtri, riepilogo), `src/BudgetSettings.js` (riepilogo annuale), `server/routes/widget.js`, `server/routes/spese.js` (`GET /totale-mese`), `server/routes/entrate.js`.

Da decidere caso per caso se la classe **serve** lì o se basta la categoria: dove non serve, scriverlo nel biglietto invece di aggiungerla per simmetria.

Verifica: per ogni punto della checklist, o è cambiato o è motivato il perché no; `npm run build`; e il controllo che i totali delle viste laterali coincidano con la pagina del budget nello stesso mese.

## Answer

<!-- da scrivere alla chiusura -->
