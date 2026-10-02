# Tre specie patrimoniali distinte: Conto, Bene, Debito

---
Status: superseded by ADR-0005
---

Il patrimonio di una persona è modellato con tre entità separate — **Conto** (denaro di cui si registrano i movimenti), **Bene** (cosa di valore rivalutata dall'utente), **Debito** (somma dovuta, residuo dichiarato) — invece che con un'unica entità dotata di un attributo *natura* (attivo/passivo) e di un *tipo*. Il Patrimonio è `Σ Conti + Σ Beni − Σ Debiti`. La scelta è stata fatta esplicitamente dall'utente contro la raccomandazione di un'unica entità: le tre specie si mostrano diversamente, e il segno nel calcolo deriva dalla specie senza bisogno di un attributo dedicato.

## Considered Options

- **Una sola entità con `natura` e `tipo`** (raccomandata, scartata): una sola schermata e una sola logica di calcolo, con l'aggiunta di un nuovo tipo come puro dato. Scartata per preferenza dell'utente.
- **Due entità, Attività e Passività**: scartata perché non separa il denaro movimentato dai beni rivalutati.
- **Tre entità (scelta)**: massima esplicitezza, al costo di tre blocchi di codice e tre interfacce da mantenere allineate su ogni piattaforma (web ora, iOS in seguito).

## Consequences

- Le tre specie differiscono per **segno** e per **valorizzazione predefinita**, non per meccanica: tutte e tre possono ricevere Movimenti. La carta di credito è un Debito e i movimenti su di essa ne alzano o abbassano il residuo; l'acquisto di un gioiello alza il valore del conto che lo contiene. Il segno con cui una voce entra nel Patrimonio lo decide la specie: Conti e Beni sommano, Debiti sottraggono.
- Un Conto con saldo negativo e un Debito hanno lo stesso effetto sul Patrimonio: la differenza è di presentazione e di valorizzazione predefinita, non di calcolo.
- Il segno di ogni voce deriva dalla specie, quindi non serve un attributo *natura*.
- Tre collezioni, tre CRUD e tre schermate da mantenere allineate su ogni piattaforma (web ora, iOS in seguito).
