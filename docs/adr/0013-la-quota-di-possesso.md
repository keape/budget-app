# La quota di possesso si dichiara; i cointestatari in app sono un progetto a sé

---
Status: accepted
---

Una Voce patrimoniale può essere di più persone (una casa cointestata, un mutuo cointestato): la persona dichiara la sua **Quota di possesso** (100% per tutto ciò che è solo suo, 50% sulla casa e sul mutuo), e da lì in poi patrimonio e budget leggono la quota invece dell'intero. Il cointestatario **non è un utente dell'app**: la condivisione fra utenti — membri di un conto, inviti, percentuali di ciascuno, permessi di scrittura — è una sessione di lavoro separata, perché oggi il confine di sicurezza del backend è il `userId` su ogni documento e ogni lettura filtra su quello. Sostituirlo con un modello di appartenenza significa riscrivere quel filtro in ogni punto; sbagliarlo significa mostrare a un utente i dati di un altro.

La quota di possesso resta il dato giusto in entrambi i mondi: quando il cointestatario avrà un account, la sua metà sarà la stessa percentuale letta dall'altro lato, e niente di quanto scritto adesso andrà buttato.

## Considered Options

- **Condivisione fra utenti fatta subito**: la rata diventa un movimento solo e due budget (la Spesa degli interessi è una, e ognuno ne conta la sua quota). È la forma finale, ma il lavoro è il doppio o il triplo e il punto delicato è tutto nel filtro di appartenenza.
- **Due conti speculari, uno per persona, senza percentuali**: zero lavoro, ma i due patrimoni divergono in silenzio — uno registra la rata, l'altro no — e nessuno dei due sa quale sia quello giusto.

## Consequences

- Ogni Voce ha una Quota di possesso, con 100% come valore normale: le Voci che esistono già sono tutte al 100%, e la quota entra in gioco solo dove serve dichiararla.
- La Quota di possesso è una **lente di lettura**, non una scrittura: la Spesa della rata resta in archivio con l'importo vero che ha pagato la banca. Chi divide è chi legge, e c'è un punto solo che lo fa — come il segno dei Debiti (ADR-0011).
- La quota vale anche per i Debiti: la casa è mia al 50% e il mutuo grava su di me al 50%, e le due percentuali possono differire (un mutuo pagato tutto da uno dei due, una casa intestata a metà).
- La Fotografia mensile e la Curva ereditano la quota senza saperlo: leggono il Patrimonio, che è già al netto. Anche le Fotografie già scritte si leggono in quota, senza essere riscritte: la curva non ha nessun gradino nel mese in cui la quota viene dichiarata.
- La scheda di un conto cointestato deve dire che sta mostrando una quota, altrimenti il numero sembra sbagliato rispetto al documento della banca.
