# La nuova entità Categoria, con la migrazione dei nomi

Type: task
Status: open
Blocked by: 04, 05

## Question

Che cosa fare: creare l'entità **Categoria** (una collezione per utente) e portarci dentro i nomi che oggi vivono dentro ogni documento `BudgetSettings`.

Fatti verificati:

- oggi una categoria **non esiste come oggetto**: è una chiave dentro `spese` o `entrate` del documento del mese (`server/models/BudgetSettings.js`, `Map` di numeri). Lo stesso nome si ripete in ogni mese, e rinominare o eliminare significa girare su tutti i documenti dell'utente (`server/routes/categorie.js`, `POST /rename` e `POST /delete`, con la normalizzazione dei nomi a mano);
- icone e archiviazione stanno già in due collezioni di appoggio per nome: `CategoryIcon` e `CategoriaArchiviata`;
- l'elenco delle categorie si legge con `GET /api/categorie`, che le ricava dai documenti di budget; e ci sono script di manutenzione in `server/scripts/` (per esempio `configura-categorie-entrata.js`, `sposta-movimenti-categoria.js`).

Da fare:

- il modello (nome, tipo, classe, previsto annuale, icona, archiviata — i campi esatti secondo i biglietti «Chi assegna la classe a una categoria» e «Che numero si confronta in ogni classe»), con il vincolo di unicità per utente + tipo + nome;
- le rotte di lettura, creazione, rinomina, modifica (classe, previsto, icona), archiviazione ed eliminazione che scrivono **in un posto solo**; la rinomina deve restare coerente con i nomi già scritti sui movimenti e sui documenti di budget (che restano stringhe): decidere se si riscrivono o se si tiene una mappa dei nomi vecchi;
- la **migrazione** dei nomi esistenti, come script in `server/scripts/` con il suo file di rollback (stile `migrate-fetta1-voci.js`): legge tutti i `BudgetSettings` dell'utente e crea le categorie mancanti, senza classi;
- `CategoriaArchiviata` e `CategoryIcon` si accorpano o restano? Decidere e scriverlo.

Verifica: prima e dopo la migrazione l'elenco delle categorie dev'essere **identico** (nomi e conteggi) e il numero di documenti letti dev'essere lo stesso; `node --check` sui file toccati; `npm run build`; un giro a mano: rinominare una categoria e vederla cambiata in tutti i mesi, senza girare su dodici documenti.

## Answer

<!-- da scrivere alla chiusura -->
