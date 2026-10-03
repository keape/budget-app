# Il modello del Debito e la sua creazione

Type: task
Status: open

## Question

Che cosa fare: eseguire **P0 e P1** di `docs/PIANO-MUTUO.md` (il modello del Debito e la creazione/scheda).

Il piano è già deciso e scritto: qui non si ridiscute niente. Le regole stanno in `docs/adr/0012`–`0020` e nel lessico di `GLOSSARY.md` (Debito collegato, Quota di possesso, Quota di proprietà, Durata, Rate pagate, i due tassi).

In sintesi, dal piano:

- **P0** — `quotaPossesso` su `Attivita` e `Debito`; su `Debito`: `gravaSu`, `durataAnni`, `ratePagate`, `tassoScelto`, `ultimoControlloResiduo`. `tasso` resta il Tasso dell'atto; il Tasso ricavato resta calcolato, non salvato; `scadenza` resta il dato interno con cui si contano le rate restanti. Nessuna migrazione: i Debiti esistenti si rileggono senza modifiche.
- **P1** — `POST/PATCH /api/voci` accettano i campi nuovi, ricavano la scadenza da durata + rate pagate + giorno della rata, e rifiutano un `gravaSu` che punta a una Voce che non è un'Attività; `GET /api/voci/:id` restituisce il Debito collegato e la Quota di proprietà; `src/Patrimonio.js` («Nuovo conto») chiede durata e rate già pagate al posto della data dell'ultima rata; `src/ContoDettaglio.js` mostra valore, Debiti collegati e Quota di proprietà.

Verifica (dal piano): `node --check server/models/Debito.js`, i Debiti esistenti si rileggono identici, `npm run build`, e un giro a mano: creare la casa, creare il mutuo collegato, vedere `280.000 − 150.000 = quota mia`.

Attenzione: questo biglietto **non** tocca le aggregazioni del budget — quelle arrivano con «La lente della quota di possesso», che è un biglietto a sé perché è il passo delicato.

## Answer

<!-- da scrivere alla chiusura -->
