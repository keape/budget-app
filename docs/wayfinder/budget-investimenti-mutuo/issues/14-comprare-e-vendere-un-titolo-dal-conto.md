# Comprare e vendere un titolo dalla scheda del conto

Type: task
Status: open
Blocked by: 06, 13

## Question

Che cosa fare: dare alla scheda di un conto investimenti i gesti che oggi mancano — **aggiungere un titolo**, comprarne altre quote, venderlo.

Fatti verificati:

- la rotta per aggiungere una Componente esiste (`POST /api/voci/:id/componenti`, `server/routes/voci.js`) e accetta nome, valorizzazione, valutazione, costo di acquisto, data, documento; esistono anche `PATCH /api/componenti/:id` e `DELETE /api/componenti/:id` (che cancella solo se la Componente non ha movimenti: una con movimenti si chiude);
- il frontend **non la usa**: `src/ContoDettaglio.js` mostra «Componenti del conto» solo se sono già più di una (intorno alla riga 873) e non offre nessun modo di aggiungerne;
- il selettore di titoli esiste già: `src/components/InstrumentSearch.js` (usato da `src/Savings.js`).

Da fare, secondo il biglietto «Il titolo dentro un conto investimenti»:

- il form di aggiunta (ticker dal selettore, quantità, prezzo, data) e la modifica di una Componente esistente;
- la vendita: chiudere la Componente con il Realizzo e far entrare il ricavato nella liquidità del conto (o come quel biglietto decide);
- la lista delle Componenti visibile **sempre**, non solo quando sono più di una: un conto investimenti con un titolo solo oggi non lo mostra;
- l'uso del componente `src/components/Modale.js` e delle notifiche (`useNotifications` da `src/contexts/NotificationContext.js`) come fanno `Patrimonio.js` e `ContoDettaglio.js`;
- i formattamenti da `src/utils/patrimonioFormat.js` (importi, etichette dei mesi).

Verifica: `node --check`, `npm run build`, e un giro a mano: aggiungere un titolo vero a un conto vero, vedere il valore della Voce salire di quantità × prezzo, poi venderlo e vedere il Realizzo e il ricavato.

## Answer

<!-- da scrivere alla chiusura -->
