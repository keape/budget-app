# La lente della quota di possesso

Type: task
Status: open
Blocked by: 16

## Question

Che cosa fare: eseguire **P2** di `docs/PIANO-MUTUO.md` — la lente della Quota di possesso.

È il passo più delicato del piano, e il piano lo dice: **una funzione sola, applicata in lettura, mai una riscrittura**. Una Voce cointestata al 50% deve entrare nel patrimonio e nel budget per la sua quota, senza che nessun numero venga riscritto nei dati.

I punti da passare dalla lente sono elencati in `docs/PIANO-MUTUO.md` §P2 e sono **gli stessi** che il biglietto «L'elenco dei punti che leggono il budget per categoria» sta verificando: `server/services/patrimonio.js` (`costruisci()`: valore, serie, gruppi, attività, debiti, patrimonio), `server/routes/widget.js`, `server/routes/spese.js` (`GET /totale-mese`), `src/hooks/useBudgetData.js`, `src/Home.js`, `src/components/MonthlySummaryChart.js`, `src/Filtri.js`, `src/Transazioni.js`, più la formattazione in `src/utils/patrimonioFormat.js` («140.000 di 280.000»).

Regola dal piano: le **Fotografie continuano a registrare i valori interi**, la lente si applica in lettura — così la Curva non ha gradini e niente si riscrive.

Verifica (dal piano): la somma delle parti deve dare il totale in ogni vista (Home, budget mensile, statistiche, rendiconto, Curva, Ripartizione), e un conto al 100% non deve cambiare **nessun** numero rispetto a prima.

Nota di sequenza: «Le tre classi nelle altre viste» e «La pagina del budget in tre classi» sono bloccate da questo biglietto perché toccano gli stessi file. Chi arriva secondo riparte dalla stessa lista di punti, senza rifare il lavoro fatto qui.

## Answer

<!-- da scrivere alla chiusura -->
