# I Movimenti vivono in una collezione per tipo e nominano Voce e Componente

---
Status: accepted
---

I quattro Movimenti non stanno in una collezione unica con un campo `tipo`. **Spesa** ed **Entrata** restano le collezioni che sono già (con l'aggiunta del conto), mentre **Trasferimento** e **Rettifica** hanno collezioni proprie. Ogni movimento nomina la Voce e la Componente su cui è registrato: `voceId`, `voceSpecie`, `componenteId`.

## Considered Options

- **Una sola collezione `movimenti` con campo `tipo`** (scartata): più elegante e una sola CRUD, ma l'app iOS già pubblicata legge le rotte `/api/spese` e `/api/entrate` dalla sua build in App Store: servirebbero una facciata di compatibilità e la riscrittura di ogni aggregazione del budget, in una fetta che deve restare piccola e usabile subito.
- **Collezione unica solo per Trasferimenti e Rettifiche** (scartata): sarebbero convissuti un movimento che appartiene al budget e uno che non vi appartiene nella stessa raccolta, con la differenza affidata a un filtro da ricordare a ogni query.
- **Una collezione per tipo (scelta)**: l'esclusione dal budget diventa strutturale — le query del budget non vedono proprio Trasferimenti e Rettifiche — e i portafogli e i grafici esistenti continuano a leggere le stesse raccolte di prima.

## Consequences

- Il movimento nomina **anche la Componente** e non solo la Voce: la valorizzazione appartiene alla Componente (ADR-0002), quindi una Voce con più Componenti a movimenti sarebbe ambigua. Oggi la Componente predefinita della Voce si risolve da sé, e chi scrive un movimento non deve saperlo.
- Quattro collezioni, quattro CRUD, una regola di scrittura sola.
- Ogni rotta che crea Movimenti deve risolvere la Voce. Verificate: sono tre — `server/routes/spese.js`, `server/routes/entrate.js`, `server/routes/transazioniPeriodiche.js` (che genera i movimenti delle ricorrenze).
- Siccome un Movimento senza Componente non comparirebbe in nessun saldo, il calcolo del patrimonio ripara da sé i movimenti orfani assegnandoli al Conto principale (`riparaMovimentiOrfani`): una rotta dimenticata degrada in un numero meno preciso, non in un numero che sparisce.
- Le rotte `/api/spese` e `/api/entrate` restano compatibili nel formato di risposta: l'app iOS pubblicata continua a funzionare senza aggiornamenti.
