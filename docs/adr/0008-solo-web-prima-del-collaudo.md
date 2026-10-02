# Solo web finché il modello non è collaudato

---
Status: accepted
---

Il modello del Patrimonio si realizza prima sul **web** e solo dopo su iOS ed Expo. Il costo di questa scelta è una finestra in cui le due app mostrano cose diverse: sul web si vedono i conti, il patrimonio e i Trasferimenti, sull'app iOS pubblicata no. La finestra dura finché il modello non è collaudato sull'uso vero.

## Considered Options

- **Web e iOS insieme**: il modello dati andrebbe congelato due volte, perché ogni correzione emersa dall'uso web costerebbe una migrazione anche sui dati mobile; il costo è dominato dall'interfaccia — circa 5.571 righe di schermate iOS che toccano i movimenti, contro 14 file web.
- **Web prima, iOS dopo il collaudo (scelta)**: il modello si congela una volta sola, e le correzioni costano solo al web.

## Consequences

- Le rotte già esistenti (`/api/spese`, `/api/entrate`, `/api/widget`, `/api/savings`) non cambiano formato di risposta: l'app iOS pubblicata continua a funzionare, semplicemente non mostra il patrimonio.
- Niente vincolo di compatibilità all'indietro sui campi **nuovi** delle risposte: il web è l'unico consumatore.
- Il piano di allocazione del risparmio (percentuali per Strumento) resta **sospeso**: sarà un modulo a sé, in una sessione dedicata. Fino ad allora le Allocazioni e le Vendite già registrate restano dove sono e il conto investimenti di partenza per lo storico non è ancora stato creato.
