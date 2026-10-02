# Attività e Debito sono due collezioni distinte

---
Status: accepted
---

Le due specie dell'ADR-0005 sono realizzate come **due collezioni distinte** (`Attivita` e `Debito`), non come una sola collezione con un campo che dice la specie. La conseguenza è che ogni riferimento a una Voce — da un Movimento, da una Componente, da una Fotografia — porta con sé la specie: la coppia `voceSpecie` + `voceId`, dove `voceSpecie` è la collezione in cui la Voce vive. Nella Fetta 1 esiste solo `Attivita`; la collezione `Debito` arriva con la Fetta 3, che le porta residuo, tasso e rate.

## Considered Options

- **Una sola collezione con un campo `specie`** (scartata): è l'opzione che l'ADR-0005 aveva già respinto per un altro motivo — «la differenza tra un bene e un debito torna a essere un campo, e un errore su un tipo sposta il patrimonio di tutte le voci di quel tipo in un colpo solo». Il valore di un simile risparmio è una lettura in meno nel calcolo del patrimonio; il costo è che la barriera fra denaro e debito diventa un valore da rispettare invece di un vincolo del database.
- **Due collezioni con una relazione (una Voce generica e una scheda Debito collegata)**: due letture per mostrare un debito e una tabella in più, senza alcun vantaggio rispetto alle due collezioni piene.

## Consequences

- Il segno di una Voce non ha bisogno di un attributo: le Attività sommano, i Debiti sottraggono. Non esiste un campo da cambiare per trasformare un debito in un'attività.
- Il **Tipo non decide la specie di una Voce**: la specie è dell'entità. Il Tipo la dichiara solo alla creazione, e la specie di un Tipo non si modifica (vedi `server/routes/tipiVoce.js`).
- Ogni riferimento a una Voce porta il discriminatore. In cambio, il patrimonio si calcola in un solo punto (`server/services/patrimonio.js`) con due letture e una fusione.
- Il calcolo del patrimonio deve continuare a sommare le due collezioni in un unico posto: nessuna rotta calcola il patrimonio per conto proprio.
