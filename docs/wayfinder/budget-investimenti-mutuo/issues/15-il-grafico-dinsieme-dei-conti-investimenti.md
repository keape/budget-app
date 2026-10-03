# Il grafico d'insieme dei conti investimenti

Type: task
Status: open
Blocked by: 08, 13

## Question

Che cosa fare: costruire la vista d'insieme decisa dal biglietto «Progetto: il grafico d'insieme degli investimenti», dove quel biglietto ha deciso che stia.

Pezzi che esistono già e vanno riusati, non riscritti:

- `src/components/SerieChart.js` — grafico a area di una serie mensile (patrimonio complessivo o singolo conto);
- `src/components/PatrimonioBreakdown.js` — grafico a blocchi impilati (un blocco per Tipo, Attività sopra lo zero e Debiti sotto);
- `src/components/SelettorePeriodo.js` e `SelettoreVista.js`, con `PERIODI`, `filtraPeriodo`, `tagliaAsse`, `barreDelPatrimonio` e `coloriPerTipo` in `src/utils/patrimonioFormat.js` — il periodo è **lo stesso** in tutte le viste del patrimonio, e deve restarlo;
- i grafici del singolo conto stanno in `src/ContoDettaglio.js` (usano la serie completa che arriva da `conSerieCompleta` in `server/routes/patrimonio.js`): con i titoli dentro il conto, quella serie cambia da sola — verificarlo, non rifarlo;
- `src/Patrimonio.js` chiede le serie lunghe a parte (`GET /api/patrimonio/serie`) la prima volta che si apre la vista che le usa, e le butta a ogni ricarica: la vista nuova deve fare lo stesso, senza appesantire la lista dei conti.

Verifica: `node --check`, `npm run build`, e un giro a mano: la curva d'insieme deve muoversi solo nei mesi in cui il valore dei titoli si è mosso, e la somma dei conti investimenti deve dare il punto corrispondente della curva.

## Answer

<!-- da scrivere alla chiusura -->
