# La rata si registra con i numeri della banca

---
Status: accepted
---

Della rata la persona conosce due numeri: la **rata** e la **quota interessi**, quella stampata dalla banca (piano di ammortamento, app della banca, estratto conto). La **quota capitale è la differenza**. Basta questo: non serve il tasso, non serve la scadenza, e il premio assicurativo che eventualmente sta dentro la quota interessi **non si cerca e non si scorpora** — resta dentro il costo, con la categoria della rata.

La ragione è aritmetica: se la banca ha addebitato 557 e ha scritto «interessi 254», allora quello che è sceso dal residuo è 303 sia che i 254 contengano un premio sia che non lo contengano. Il residuo resta esatto in ogni caso, e nessun errore si cumula. Il calcolo dell'app (residuo × tasso) resta come **proposta e come previsione** — quanto manca, quanto costerà ancora — non come verità. ADR-0004 diceva che il Debito calcola la rata da sé: questa è la forma che quella promessa prende nei numeri.

## Considered Options

- **Scorporare il premio assicurativo** (una terza quota, con categoria propria): budget più fine di un'informazione utile, ma il dato da cercare non sta in nessun posto chiaro ed è la complicazione che si è voluta evitare.
- **Registrare la rata intera come Spesa e correggere il residuo a mano**: nessun calcolo da sbagliare, ma il capitale versato non è un costo e farlo passare per tale abbassa il Patrimonio più del vero, senza che niente lo segnali.

## Consequences

- Il tasso diventa un dato **facoltativo e informativo**: serve a prevedere («quanto mi costerà ancora»), non a registrare. Chi non lo conosce non è escluso da niente.
- Il TAEG non entra nel modello: è un indice di costo complessivo che mescola tasso e assicurazione, e nessuno dei due serve per dividere una rata.
- Se un domani servisse il costo assicurativo separato nel budget, la strada è leggere il premio da fuori (una riga dell'estratto conto, una Spesa a sé), non aggiungere un campo al Debito.
- La differenza è anche il controllo: se rata − interessi non è un numero plausibile, il numero letto è quello sbagliato, e si vede subito.
