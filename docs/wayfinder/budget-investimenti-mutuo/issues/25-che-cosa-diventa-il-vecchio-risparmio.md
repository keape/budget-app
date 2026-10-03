# Che cosa diventa il vecchio Risparmio

Type: grilling
Status: open
Blocked by: 06, 24, 26

## Question

Che cosa succede, dato per dato, al modulo Risparmio quando i titoli vivono dentro i conti investimenti?

Il volume è minimo (7 `SavingsMonth`, 1 `AllocationPlan`, 5 `InstrumentAllocation`), quindi la difficoltà non è la migrazione: sono le decisioni. Fatti dal biglietto «Che cosa è riusabile del modulo Risparmio».

Da decidere in conversazione con l'utente (una domanda per volta):

- le allocazioni già registrate diventano **Componenti-titolo** dentro un conto investimenti di partenza, sul modello del Conto principale (`server/scripts/migrate-fetta1-voci.js:66-96`). Ma i Trasferimenti: **retrodatati** (come vorrebbe l'ADR-0003) o **no**? Retrodatarli toglierebbe denaro al Conto principale ricostruendo uscite mai registrate, e cambierebbe i saldi storici; non farlo lascia lo storico senza Movimenti. È una decisione di prodotto, non tecnica.
- le vendite: si chiudono le Componenti con il `realizzo`, o si aggiunge `componenteId` a `InstrumentSale` e la vendita resta il documento fiscale? (La decisione sulla vendita parziale è nel biglietto «Il titolo dentro un conto investimenti».)
- `SavingsMonth`: si smette di scriverlo, o si continua per l'app iOS? I quattro mesi a zero che cosa sono stati: rumore da dimenticare?
- `AllocationPlan`: si riaggancia a Voce/Componente come livello di confronto (lo conferma l'ADR-0003); `monthlyTargets` e `PUT /plan/monthly-target` si buttano o restano per iOS? **Serve prima la verifica dei consumatori iOS** (biglietto «Mettere al sicuro Instrument e InstrumentSale, e contare i dati veri» non la copre: va guardato `budget365iOS/src/screens/SavingsScreen.tsx`).
- la pagina **Risparmio** sul web: resta la vista del piano, o il piano migra nella scheda del conto e la pagina sparisce?
- le due allocazioni senza `quantity` (2.000 € nel backup): che valore hanno in Componenti?

Esito atteso: che cosa diventa ogni collezione e ogni rotta del vecchio modulo, che cosa si congela e che cosa si smette di scrivere — ricordando che le risposte delle rotte `/api/savings/*` non si possono cambiare finché l'app iOS le consuma (ADR-0008).

## Answer

<!-- da scrivere alla chiusura -->
