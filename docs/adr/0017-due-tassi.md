# Due tassi, e la scelta è di chi ha acceso il Debito

---
Status: accepted
---

Un Debito con piano di ammortamento può avere due tassi, e sono due cose diverse: il **Tasso dell'atto** (il nominale scritto nel contratto) e il **Tasso ricavato** (quello che rende vera l'uguaglianza fra residuo, rata e rate restanti, e che contiene tutto ciò che la banca ha messo dentro la rata — premio assicurativo compreso). Quando il Debito li ha entrambi, la scheda li mostra affiancati, dice di quanto differiscono e quanto costa la differenza, e **l'utente sceglie quale comanda** il calcolo, debito per debito.

La scelta è sua perché i due tassi non sono la stessa cosa e non c'è un criterio unico che dica quale sia quello giusto: il Tasso ricavato riproduce la divisione della banca (e quindi un residuo che non deriva), il Tasso dell'atto è il numero del contratto (e quindi l'unico confrontabile con quello che ha scritto la banca in una lettera). Il prezzo della libertà è che due Debiti configurati allo stesso modo possono comportarsi diversamente: la scheda deve dire quale comanda e quanto costa, non lasciarlo ricordare.

## Considered Options

- **Comanda sempre il Tasso ricavato**: il residuo non deriva e la rata automatica riproduce la banca; ma il numero del contratto diventa decorativo, e un utente che lo confronta con la scheda pensa che l'app abbia sbagliato.
- **Comanda sempre il Tasso dell'atto**: nessuna sorpresa rispetto al contratto; ma con una rata che contiene il premio l'app rimborsa ogni mese più capitale di quanto faccia la banca, e il residuo scende più del vero.

## Consequences

- Nel caso pulito — rata fatta solo di interessi e capitale — i due tassi coincidono e la scelta non produce nessuna differenza: la scelta esiste solo nel caso sporco.
- La differenza fra i due tassi è una **misura di quello che c'è dentro la rata**: se è zero, dentro non c'è niente.
- Chi sceglie il Tasso dell'atto sceglie un residuo che deriva: la correzione con il residuo vero diventa necessaria, non facoltativa.
- Se dentro la rata c'è un premio fisso, il Tasso ricavato lo assorbe per sempre: non c'è nessun campo da aggiornare quando il premio cambia, si aggiorna il tasso ricavato (o si corregge il residuo).
