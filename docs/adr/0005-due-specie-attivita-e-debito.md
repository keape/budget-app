# Due specie patrimoniali: Attività e Debito

---
Status: accepted
---

Il Patrimonio è modellato con due entità: **Attività** (denaro, titoli, immobili, veicoli, beni di valore, crediti) e **Debito**. Sostituisce l'ADR-0001, che prevedeva tre specie. La ragione del cambiamento è che la decisione sul mutuo ha dato a un Debito una meccanica sua — tasso, rata, rate residue, quote capitale e interessi calcolate dal sistema — mentre un Conto e un Bene, dopo il passaggio al modello delle Componenti (ADR-0002), si comportano in modo identico: entrambi valgono la somma delle loro Componenti, entrambi ricevono Trasferimenti e Rettifiche, entrambi si chiudono allo stesso modo. Tenere due implementazioni identiche non proteggeva da nessun errore reale, mentre tenere separato il Debito protegge dall'errore che conta: che un debito venga trattato come un bene.

## Considered Options

- **Tre specie (ADR-0001, superato)**: Conto, Bene, Debito. Scelto una prima volta per esplicitezza, prima che il modello delle Componenti togliesse ai Conti e ai Beni ogni differenza di comportamento.
- **Una sola entità con la meccanica del debito agganciata al tipo**: massima economia di codice, ma la differenza tra un bene e un debito torna a essere un campo, e un errore su un tipo sposta il patrimonio di tutte le voci di quel tipo in un colpo solo.

## Consequences

- Il segno di una Voce deriva dall'entità: le Attività sommano, i Debiti sottraggono. Non serve un attributo *natura*.
- La distinzione tra denaro e beni materiali dentro le Attività non è più strutturale: la porta il Tipo, e serve a raggruppare le viste (Denaro, Beni, Debiti). Un tipo creato dall'utente deve dichiarare se è denaro o bene materiale, perché da quella scelta dipende il gruppo in cui compare.
- I Movimenti ammessi dipendono dal Tipo: una Spesa o un'Entrata ha senso sulle Attività di tipo denaro e su un Debito (dove alza il debito: è il caso della carta di credito), non sui beni materiali, che ricevono Trasferimenti e Rettifiche.
- Un Debito porta campi e meccanica che le Attività non hanno: residuo, tasso, rate residue, piano di ammortamento (ADR-0004).
