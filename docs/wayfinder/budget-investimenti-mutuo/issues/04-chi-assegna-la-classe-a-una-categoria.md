# Chi assegna la classe a una categoria

Type: grilling
Status: resolved
Assignee: Pi (sessione di grilling)

## Question

Quando una categoria esiste e non ha ancora una classe, **chi decide** se è fissa, flessibile o non mensile — e con quale aiuto?

Sotto-domande, da risolvere in conversazione con l'utente (una domanda per volta, come vuole la skill `grilling`):

- la classe si chiede **quando si crea la categoria** (una terza scelta obbligatoria nel form) o resta vuota finché l'utente non la sistema?
- l'app **propone** una classe in base al nome (un piccolo elenco di nomi ricorrenti: affitto, palestra, abbonamento… → fissa) e l'utente conferma o corregge? Chi tiene quell'elenco, e si vede che è una proposta?
- una categoria **senza classe** che cosa mostra: una sezione a parte «da classificare», o si comporta come flessibile?
- cambiare classe a una categoria dopo mesi di dati è una decisione qualunque o una decisione da confermare (cambia il confronto dei mesi passati)?
- chi **rivede** le classi nel tempo: c'è un promemoria una volta l'anno, o resta una cosa che si sistema a mano?

Esito atteso: la regola con cui nasce la classe di una categoria, e che cosa succede a una categoria senza classe. La classe è un'etichetta che non fa scrivere movimenti all'app (deciso in fase di disegno), quindi qui non si decide nulla sulla scrittura automatica.

## Answer

**La regola.** Una categoria di uscita **nasce con la sua classe**, e la classe si chiede nel punto stesso in cui nasce la categoria: il form «Aggiungi Categoria» di `src/BudgetSettings.js:280`, l'unico posto in cui un nome nuovo entra nei documenti di budget (negli altri form la categoria si sceglie da un elenco: `src/Transazioni.js:658`, `src/Filtri.js:1478`). Il form già chiede nome e previsto del mese; la classe è la terza scelta, **obbligatoria**. Le **entrate** non hanno il campo (le classi valgono solo per le uscite). La categoria della rata che il backend crea da sé (`server/routes/debiti.js:169-217`: `categoriaRata || tipo.nome || 'Altre spese'`) è **fissa per regola**, e il ripiego `'Altre spese'` deve esistere davvero fra le categorie.

**La proposta.** Il campo arriva già riempito **solo quando l'app sa**: un piccolo dizionario di nomi ricorrenti (`affitto, mutuo, acqua, elettricità, abbonamenti… → fissa`), custodito nel **backend** perché è una regola del dominio, non un pezzo di interfaccia, e perché la stessa proposta dovrà servire alle app mobili dopo il collaudo. Per un nome che il dizionario non conosce — cioè per la maggior parte dei nomi veri — la casella resta **vuota** e la scelta è esplicita: alla creazione il vuoto blocca il salvataggio. La ragione è che la classe non è una proprietà del nome ma di **che cosa ci si mette dentro**: «Vela» è fissa se dentro c'è l'ormeggio mensile, non mensile se c'è l'alaggio annuale. La proposta non può quindi che essere un suggerimento correggibile, e un suggerimento sbagliato costa un'occhiata.

**La categoria senza classe.** Sopravvive solo come **stato transitorio** delle categorie che esistono già; la prima classificazione lo chiude. Restano visibili come «da classificare», con un rimando che non scompare (biglietto «La prima classificazione delle categorie esistenti»). Che cosa facciano **nei numeri** nel frattempo — se valgano come flessibili o restino fuori dai totali — non si decide qui: appartiene a «Che numero si confronta in ogni classe».

**Cambiare classe.** La classe è una proprietà **attuale** della categoria: non ha data di decorrenza né storia, e cambiandola i mesi passati si **rileggono** con la classe nuova. Il cambio però **avvisa prima di salvare**, dicendo che cosa si sposta (quanti mesi, quali totali): una lettura già guardata non deve cambiare sotto gli occhi in silenzio. È la stessa natura della lente della Quota di possesso (ADR-0014): si applica in lettura, non riscrive niente nei dati.

**Chi la rivede.** Ciò che invecchia è l'etichetta, non la categoria che nasce senza classe: **una volta l'anno** la Home avvisa e riapre la schermata della prima classificazione con le classi attuali, da confermare o correggere in un giro solo. Stesso schema del controllo annuale del residuo del mutuo (ADR-0017), senza euristiche che indovinino i casi sospetti. Il meccanismo degli avvisi esiste già (`src/Home.js:3,36`, `addMultipleNotifications` da `src/contexts/NotificationContext.js`).

**Respinti, e perché**

- *«la proposta impara dalle classifiche già fatte»* — non c'è niente da imparare: il nome di una categoria è **unico per utente e tipo**, quindi una categoria nuova non riporta mai un nome già classificato, e la memoria resterebbe vuota proprio dove servirebbe (la prima classificazione, quando nessuna categoria è ancora classificata);
- *«flessibile preselezionato come proposta»* — risparmia un tocco ma lascia una categoria fissa letta come flessibile in silenzio, e per non farlo servirebbe un secondo stato da contare (proposta contro confermata);
- *«classe con data di decorrenza»* — i mesi passati resterebbero come erano, ma servirebbero una storia della classe e due regole di lettura, e il previsto annuale delle non mensili mal si concilia con una data di decorrenza: una categoria che diventa non mensile a maggio non avrebbe un previsto annuale per l'anno in corso.

**Dove si esegue.** Il campo e la proposta: «La prima classificazione delle categorie esistenti» (la schermata) e «La nuova entità Categoria, con la migrazione dei nomi» (i campi: nome, tipo, classe, previsto annuale, icona, archiviata). L'avviso di revisione annuale: biglietto nuovo, «La revisione annuale delle classi». La categoria della rata: «La rata automatica» e «Il modello del Debito e la sua creazione».

**Lessico e ADR.** `GLOSSARY.md:161-179` ha già «Categoria», «Classe della categoria», «Categoria fissa / flessibile / non mensile» e «Previsto annuale» — e «Categoria fissa» cita già «la rata di un debito», che conferma la regola di sopra: niente da aggiungere. **Nessuna ADR**: la decisione è reversibile (la classe vive su un'entità per utente, cambiarla è una modifica di riga) e non sorprende chi arriva dopo, quindi manca il primo dei tre requisiti.

## Comments

Registro delle decisioni prese in conversazione (2026-10-02).

**1. La classe è una scelta obbligatoria del form di creazione, con proposta.**
Dove nasce una categoria, oggi, è un punto solo: il form «Aggiungi Categoria» di `src/BudgetSettings.js:280` (nome + previsto del mese), l'unico posto in cui un nome nuovo entra nei documenti di budget. Negli altri form la categoria si sceglie da un elenco, non si scrive (`src/Transazioni.js:658`, `src/Filtri.js:1478` sono `<select>`). Perciò la terza scelta non aggiunge un passaggio a un flusso nuovo: si aggiunge a quel form.

- la classe è **obbligatoria alla creazione** per le uscite; le **entrate** non hanno il campo (le classi valgono solo per le uscite);
- l'app **propone** la classe in base al nome, già selezionata e correggibile;
- «da classificare» resta perciò uno **stato transitorio** delle categorie che esistono già, che la prima classificazione chiude;
- la categoria della rata creata dal backend (`server/routes/debiti.js:169-217`: `categoriaRata || tipo.nome || 'Altre spese'`) è **fissa per regola**, e il ripiego `'Altre spese'` deve esistere davvero fra le categorie (vedi «L'elenco dei punti che leggono il budget per categoria»).

**2. La classe è una proprietà attuale della categoria; il cambio è immediato ma avvisato.**
Non esiste una storia della classe e non esiste una data di decorrenza: la classe dice come si guarda quella spesa, non come era allora. È la stessa natura della lente della Quota di possesso (ADR-0014): si applica in lettura, non riscrive niente nei dati.

- cambiando la classe, i mesi passati si **rileggono** con la classe nuova;
- perciò il cambio **avvisa prima di salvare**, e l'avviso dice che cosa si sposta (quanti mesi, quali totali), invece di lasciar cambiare sotto gli occhi un totale già letto;
- nessun campo di storia sulla Categoria, nessuna seconda regola di lettura;
- l'alternativa scartata (classe «dal mese X») è stata respinta anche perché il **previsto annuale** delle non mensili mal si concilia con una data di decorrenza: una categoria che diventa non mensile a maggio non avrebbe un previsto annuale per l'anno in corso.

**3. La proposta è un dizionario di nomi ricorrenti, custodito nel backend, che preseleziona solo quando sa.**
La classe non è una proprietà del nome ma di **che cosa ci si mette dentro**: «Vela» è fissa se dentro c'è l'ormeggio mensile, non mensile se c'è l'alaggio annuale. Quindi la proposta è un suggerimento, mai una decisione, e l'errore costa un'occhiata e un tocco perché il campo resta modificabile.

- il dizionario è piccolo (`affitto, mutuo, acqua, elettricità, abbonamenti… → fissa`), sta nel **backend** ed è una regola del dominio, non un pezzo di interfaccia: la stessa proposta serve al web e, dopo il collaudo, alle app mobili. Non è una seconda lista di nomi accanto a quella di `src/BudgetSettings.js:29-32`, che il biglietto «L'elenco dei punti che leggono il budget per categoria» chiede di togliere: quella è una lista di *nomi esistenti*, questa è un elenco di *suggerimenti*;
- per un nome che il dizionario **non** conosce la casella resta **vuota**, e la scelta è esplicita: alla creazione il vuoto blocca il salvataggio (la classe è obbligatoria, decisione 1), nella prima classificazione la categoria resta in «da classificare» finché non la si sistema, e la schermata conta quante ne restano;
- **respinta: «la proposta impara dalle classifiche già fatte».** Non c'è niente da imparare: una categoria nasce una volta e il nome è **unico per utente e tipo** (biglietto «La nuova entità Categoria, con la migrazione dei nomi»), quindi una categoria nuova non riporta mai un nome già classificato. La memoria resterebbe vuota proprio dove servirebbe — la prima classificazione, quando nessuna categoria è ancora classificata — e soccorrerebbe solo una categoria archiviata e poi ricreata con lo stesso nome;
- **respinta: «flessibile preselezionato come proposta».** Sarebbe più veloce ma lascerebbe una categoria fissa letta come flessibile in silenzio, e per non farlo servirebbe un secondo stato da contare (proposta vs confermata) sulla schermata.

**Annotato:** la sotto-domanda «una categoria senza classe che cosa *mostra*» si spezza in due. La parte visiva è già decisa dal biglietto «La prima classificazione delle categorie esistenti» (restano visibili come «da classificare», con un rimando che non scompare); la parte numerica — se nel frattempo valga come flessibile o resti fuori dai totali — appartiene a «Che numero si confronta in ogni classe».
