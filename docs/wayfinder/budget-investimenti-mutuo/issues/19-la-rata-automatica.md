# La rata automatica

Type: task
Status: open
Blocked by: 18

## Question

Che cosa fare: eseguire **P4** di `docs/PIANO-MUTUO.md` — la rata che si registra da sé.

Dal piano:

- `POST /api/debiti/rate-mancanti`: per ogni Debito attivo con piano e Tasso, scrive le rate non ancora registrate **dalla rata successiva all'ultima già scritta fino a oggi**, ognuna alla data del suo mese, con i due Movimenti (quota interessi = Spesa sul conto che paga, quota capitale = Trasferimento); si ferma a residuo zero; risponde con l'elenco di quello che ha scritto.
- Chiusura da sé: quando il residuo arriva a zero, `archiviata = true`; il legame `gravaSu` resta salvato e torna a valere alla riapertura (`docs/adr/0018`).
- `src/Home.js` e `src/Patrimonio.js` la chiamano all'apertura, come `src/Transazioni.js` fa con le ricorrenze, e mostrano l'avviso «N rate registrate» con l'elenco e il rimando al controllo sull'estratto conto, usando `src/contexts/NotificationContext.js`.
- Tasso variabile: si scrive la rata nuova nel `PATCH` e il Tasso ricavato si ricalcola (`docs/adr/0020`) — questo pezzo del piano è qui, non serve un campo nuovo.

- la **categoria** della quota interessi: oggi nasce da `categoriaRata || tipo.nome || 'Altre spese'` (`server/routes/debiti.js:169-217`). Il biglietto «Chi assegna la classe a una categoria» ha deciso che quella categoria è **fissa per regola** e che il ripiego `'Altre spese'` deve esistere davvero fra le categorie: con la scrittura automatica quella scelta smette di essere un caso isolato e va presa una volta qui, non ricontrollata ogni volta.

Regola di sicurezza dal piano: la scrittura automatica mette numeri calcolati nel patrimonio, quindi ogni passo dev'essere annullabile con un gesto — `DELETE /api/debiti/:id/rate/:rataId` esiste già e va verificato.

Verifica (dal piano): nessuna rata scritta due volte (il controllo sul mese c'è già), nessuna rata con residuo a zero, un'assenza di tre mesi scrive tre rate con le date giuste; `node --check`, `npm run build`, e un giro a mano con un Debito di prova che si annulla subito.

## Answer

<!-- da scrivere alla chiusura -->
