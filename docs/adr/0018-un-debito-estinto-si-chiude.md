# Un Debito estinto si chiude da sé

---
Status: accepted
---

Quando il residuo arriva a zero — per l'ultima rata o per un'estinzione anticipata — il Debito **si chiude da sé**: esce dalle voci attive e va fra i conti chiusi (ADR-0010), con tutti i suoi Movimenti leggibili e la possibilità di riaprirlo se la banca presenta ancora qualcosa. Il **collegamento con l'Attività si scioglie**: la scheda della casa non mostra più la Quota di proprietà, perché non c'è più un debito da sottrarre, e il valore di mercato è anche la quota di chi la possiede. La rata automatica si ferma: senza residuo non c'è rata da scrivere.

Numericamente questa decisione non cambia niente — un Debito con residuo zero vale zero e non sposta il Patrimonio — quindi è una decisione su **dove si trova** la cosa e su **cosa mostra la casa**, non sui numeri. Vale la pena prenderla proprio per questo: è l'unico momento in cui la storia che l'utente voleva vedere («la casa diventa mia») si vede.

## Considered Options

- **Resta in elenco con residuo zero**: nessuno stato da gestire; ma fra le voci attive compare un debito che non esiste più, e dopo qualche anno sono tre o quattro.
- **Chiusura a mano, con una domanda**: nessuna sorpresa; ma è un gesto in più su una cosa che non ha alternative — un mutuo estinto non è un mutuo aperto.

## Consequences

- La chiusura è **reversibile**: un Debito riaperto riprende il collegamento e ricomincia a contare, e il residuo è quello che i Movimenti dicono.
- Un'estinzione anticipata è lo stesso evento, solo in anticipo: la rata automatica si ferma e il residuo vero va scritto come sempre.
- Un'Attività senza Debiti collegati non mostra nessuna Quota di proprietà (sarebbe uguale al valore): coerente con ADR-0012.
- La chiusura automatica vale per i Debiti con residuo che arriva a zero **per Movimenti**, non per una Rettifica scritta a mano che porta il residuo a zero: quella è una correzione, non un'estinzione.
