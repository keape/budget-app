# Mettere al sicuro Instrument e InstrumentSale, e contare i dati veri

Type: task
Status: open

## Question

Che cosa fare: due cose, prima di toccare qualsiasi cosa del motore titoli.

**1. Mettere in cassaforte le due collezioni scoperte.** `server/backup.js:15-24` salva `User, Spesa, Entrata, BudgetSettings, TransazionePeriodica, SavingsMonth, InstrumentAllocation, AllocationPlan`: **`Instrument` e `InstrumentSale` non sono in nessun backup**. `Instrument` è la sola copia di ticker e prezzi; `InstrumentSale` è l'unico registro delle vendite. Aggiungerle al backup e farne uno subito.

**2. Contare i dati veri sul database di produzione** — i numeri del backup del repo sono di aprile e non bastano (l'ADR-0002 chiede già questo conteggio prima di toccare la produzione). Le query sono in fondo al §3 della relazione [`../assets/03-riusabile-modulo-risparmio.md`](../assets/03-riusabile-modulo-risparmio.md), quella del biglietto «Che cosa è riusabile del modulo Risparmio»); in sintesi:

- `savingsmonths`: quanti per utente, e **quanti duplicati** per `(utente, anno, mese)` (l'indice non è unico, `server/models/SavingsMonth.js:44`: i doppioni sono possibili);
- `savingsmonths` con `income = expenses = savings = 0`: quanti mesi vuoti;
- `allocationplans`: quanti documenti, e se `monthlyTargets` è mai stato scritto;
- `instrumentallocations`: per utente, quante righe **senza `quantity`** e quanti euro valgono;
- `instrumentsales`: per utente, quante vendite e quante quote — **oggi nessuno può rispondere**;
- `instruments`: quanti senza `lastPrice`, e che valute ci sono;
- **gli orfani**: `DELETE /api/auth/delete-account` (`server/routes/auth.js:483-517`) cancella solo `Spesa`, `Entrata`, `BudgetSettings`, `TransazionePeriodica` e `User`: le collezioni del Risparmio (e quelle patrimoniali) restano attaccate a utenti che non esistono più.

Esito atteso: i numeri veri scritti qui, il backup fatto, e la risposta a «quante vendite esistono». Da lì dipende la migrazione del vecchio Risparmio (biglietto «Che cosa diventa il vecchio Risparmio»).

## Answer

<!-- da scrivere alla chiusura -->
