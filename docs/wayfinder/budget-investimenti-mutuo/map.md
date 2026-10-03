# Il budget in tre classi, i titoli con il prezzo vero e il mutuo da eseguire

`wayfinder:map`

## Destination

Tre cose **funzionanti e collaudate nel web** (iOS ed Expo restano fuori):

1. il budget letto in tre classi — fisse, flessibili, non mensili — con la classe appesa a una categoria che è un oggetto dell'utente, non un nome ripetuto in ogni mese;
2. i titoli dentro i conti investimenti, con ticker, quantità, costo e prezzo vero, il loro grafico d'insieme e il grafico di ogni conto;
3. il piano del mutuo già deciso (`docs/PIANO-MUTUO.md`, P0–P7) eseguito.

La mappa si chiude quando le tre cose funzionano e sono state provate a mano sui dati veri.

## Notes

- **L'esecuzione sta dentro la mappa.** I biglietti di tipo `task` non decidono soltanto: costruiscono, collaudano e aggiornano la documentazione.
- **Un biglietto = una sessione.** Non si risolve più di un biglietto per sessione; i biglietti di ricerca fanno eccezione, girano in background e si chiudono insieme.
- **Web soltanto** (ADR-0008). iOS ed Expo sono fuori perimetro.
- **Ma l'app iOS consuma le rotte `/api/savings/*`** e l'ADR-0008 impegna a non cambiarne il formato delle risposte: sul binario degli investimenti «buttare» significa **smettere di scrivere**, non cancellare. Le pagine web si possono cambiare; le risposte delle rotte che iOS usa no.
- **Un file, un mestiere per volta.** La lente della Quota di possesso (mutuo) e i due biglietti del budget toccano gli **stessi punti** (`src/Home.js`, `src/hooks/useBudgetData.js`, `server/routes/widget.js`, i riepiloghi mensili): la lente viene prima, e chi arriva secondo ripassa la stessa lista senza riscriverla. Fuori da lì i tre binari — mutuo, budget, investimenti — procedono in parallelo.
- **La numerazione è l'ordine in cui i biglietti sono stati scritti, non la priorità.** I biglietti nati da una ricerca (21, 22, 23) portano numeri alti pur essendo a monte di altri: la frontiera si legge da `Status` e `Blocked by`, non dal numero.
- **Il mutuo è già deciso**: `docs/adr/0012`–`0020` e `docs/PIANO-MUTUO.md`. Non si ridiscute, si esegue (biglietti «Il modello del Debito…» in poi).
- **Decisioni prese in fase di disegno, non più in discussione**:
  1. la classe di una categoria è un'**etichetta**: non scrive movimenti da sé;
  2. le tre classi valgono **solo per le uscite**;
  3. una categoria **non mensile** ha un **previsto annuale** e si misura sull'anno;
  4. la classe vive su una **entità Categoria per utente** (una collezione nuova), non dentro i documenti dei mesi;
  5. i titoli dentro un conto usano il **motore titoli esistente** (`Instrument`), con prezzo vero;
  6. il passato del grafico dei titoli viene dallo **storico di mercato scaricato**, non da prezzi dichiarati.
- **Lessico e decisioni si scrivono subito, non a fine sessione**: `GLOSSARY.md` (solo lessico, niente implementazione) e `docs/adr/` (una ADR solo quando la decisione è difficile da rovesciare, sorprendente senza contesto e frutto di un vero confronto). Skill: `domain-modeling`.
- **Skill di conversazione**: `grilling` (una domanda per volta) e `domain-modeling`, per i biglietti di tipo `grilling` e `prototype`. Per la forma dei prototipi: `impeccable`; per i diagrammi: `archify`.
- **A ogni biglietto eseguito**: `node --check` sui file server toccati, `npm run build`, aggiornare `CLAUDE.md` (≤ 100 righe) e `docs/CLAUDE_BACKEND.md` / `docs/CLAUDE_FRONTEND.md` (≤ 120 righe), poi `graphify update .`.
- **Guardrail del repo**: `Spesa.importo` sempre negativo e `Entrata.importo` sempre positivo, anche nelle rotte di modifica; niente rotte di manutenzione fuori dal locale; nessun URL di deploy scritto a mano; `debugLog`/`logError` invece di `console.log` nelle rotte.
- **Il collaudo si fa sui numeri veri** (le categorie reali, i titoli reali, il mutuo reale), non su dati di prova.

## Decisions so far

- [L'elenco dei punti che leggono il budget per categoria](issues/01-elencare-i-punti-che-leggono-il-budget-per-categoria.md): i punti che leggono le categorie sono tre gruppi (i previsti, lo scostamento per categoria, i totali); l'elenco dei nomi **diverge** fra la pagina delle impostazioni (lista scritta a mano nel frontend) e tutte le altre pagine; rinomina ed eliminazione girano su tutti i documenti mese; la categoria della rata è l'unico nome che il backend crea da sé.
- [Lo storico dei prezzi dei titoli](issues/02-lo-storico-dei-prezzi-dei-titoli.md): la chiamata è `range=max&interval=1mo` per il backfill e `range=3mo&interval=1mo` per gli aggiornamenti, il mese si legge dal timestamp **nel fuso della borsa**, `close` per il valore del conto e `adjClose` per la performance, una riga per ticker e mese in una collezione **globale**; e **Yahoo ha risposto 406** alle chiamate di prova — il motore titoli potrebbe essere già rotto in produzione, in silenzio.
- [Che cosa è riusabile del modulo Risparmio](issues/03-che-cosa-e-riusabile-del-modulo-risparmio.md): l'aritmetica della posizione (quantità × prezzo, carico, latente) è già scritta e si incapsula nel ramo `mercato` di `valoreComponente`; i due moduli però danno **oggi due valori diversi per lo stesso titolo**, la vendita non si incastra col Realizzo, e `Instrument`/`InstrumentSale` non sono nemmeno in backup.
- [Chi assegna la classe a una categoria](issues/04-chi-assegna-la-classe-a-una-categoria.md): la classe nasce **obbligatoria** con la categoria (il form «Aggiungi Categoria» è l'unico punto dove un nome nuovo entra nel budget), proposta da un dizionario di nomi ricorrenti nel backend e con la casella **vuota** quando il dizionario non sa; «da classificare» resta solo per le categorie che esistono già; la classe è una proprietà **attuale**, senza storia, e cambiarla rilegge i mesi passati con un avviso prima di salvare; si ripassa **una volta l'anno**.

## Not yet specified

- Che cosa vuol dire «quanto posso spendere questo mese» quando il previsto annuale delle non mensili entra nel conto: fog finché la pagina del budget non è disegnata.
- Se le tre classi diventino la base di un rendiconto annuale o di un budget-obiettivo.
- Se le non mensili vadano **messe da parte** mese per mese (un accantonamento) o solo misurate a fine anno.
- Che fine fa la pagina **Risparmio** sul web (la vista del piano): fog finché la migrazione dei dati vecchi non è decisa.

## Out of scope

- **iOS ed Expo** (ADR-0008): portare il budget a tre classi e il grafico dei titoli nelle app è un lavoro a sé, dopo il collaudo web.
- **La condivisione del patrimonio fra utenti** (ADR-0013): sessione a sé.
- **La scrittura automatica delle spese fisse**: la classe «fissa» è un'etichetta; se un giorno servirà farlo scrivere all'app, è una decisione nuova.
- **Le classi sulle entrate**: deciso che valgono solo per le uscite.
