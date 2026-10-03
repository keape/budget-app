# Budget365

Applicazione di finanza personale (web, iOS, Expo): registra i movimenti di denaro, gestisce budget mensili per categoria, amministra un portafoglio di investimenti ed espone il patrimonio complessivo di una persona.

## Language

**Patrimonio**:
Il valore netto di una persona in un dato momento: la somma delle Attività meno la somma dei Debiti.
_Avoid_: saldo totale, capitale, net worth, asset complessivo

**Voce patrimoniale**:
Una singola riga del Patrimonio: un'Attività o un Debito. Ogni voce ha un nome e un valore.
_Avoid_: asset, posizione, cespite

**Attività**:
Cosa di valore che appartiene alla persona: denaro, titoli, immobili, veicoli, beni di valore, crediti. Il Tipo distingue il denaro dai beni materiali.
_Avoid_: asset, attivo

**Componente**:
Una delle parti di cui una Voce patrimoniale è composta; il valore della Voce è la somma delle sue Componenti (i singoli pezzi di un conto Gioielli, i titoli e la liquidità di un conto investimenti). La Componente che riceve i Movimenti della Voce è la sua Componente **predefinita**, e l'app la trova da sé quando l'utente sceglie il conto e non il singolo pezzo.
_Avoid_: pezzo, sotto-voce

**Costo di acquisto**:
Il prezzo pagato per acquisire una Componente, con la sua data. Resta distinto dalla Valutazione: il primo dice quanto è costata, la seconda quanto vale.

**Tipo**:
L'etichetta che raggruppa le Voci. Il catalogo iniziale è, nell'ordine in cui si mostra: **Attività** — Contanti, Conti correnti, Investimenti, Immobili, Veicoli, Beni di valore, Crediti, Altri asset; **Debiti** — Mutui, Debiti (i finanziamenti), Carte di credito, Altre liability. L'utente può crearne, rinominarne, riordinarne e cancellarne. Il tipo dice se un'Attività è denaro o bene materiale e, per i Debiti, se hanno un piano di ammortamento. Non determina come si valuta una Voce: lo decide la Componente. La **specie** di un Tipo (Attività o Debito) si dichiara alla creazione e non si cambia: è la barriera che impedisce a un debito di diventare un'attività per sbaglio. L'ordine in cui i Tipi compaiono è un dato del Tipo (`ordine`), non una regola del programma.
_Avoid_: categoria, classe

**Gruppo**:
Uno dei tre raggruppamenti con cui la vista generale mostra le Voci: **Denaro**, **Beni**, **Debiti**. Deriva dal Tipo (denaro o bene materiale) e dalla specie (i Debiti stanno sempre nei Debiti). Non è una specie del modello: è un modo di guardarlo.

**Conto**:
Parola d'uso per una Voce patrimoniale, soprattutto quando è denaro o investimenti: "Conto cash", "Conto investimenti". Non è una specie del modello: le specie sono Attività e Debito.
_Avoid_: account, wallet

**Conto principale**:
L'Attività di tipo Contanti o Conti correnti che riceve i Movimenti già registrati e che il sistema propone come origine dei Trasferimenti.

**Conto chiuso**:
Un conto archiviato: fuori dal Patrimonio e dall'elenco dei conti aperti, ma con tutti i suoi Movimenti conservati e leggibili. Si può riaprire. Diverso dall'**eliminazione**, che cancella il conto e i suoi Movimenti e non si annulla.

**Conto investimenti**:
Un'Attività di tipo Investimenti: contiene i titoli di un intermediario e la liquidità non ancora investita (Interactive Brokers, Directa, Fineco).
_Avoid_: conto titoli, deposito titoli, conto broker

**Bene**:
Parola d'uso per un'Attività che non è denaro: immobili, veicoli, beni di valore.
_Avoid_: asset, proprietà, cespite

**Debito**:
Somma dovuta il cui residuo si legge dai suoi Movimenti: mutui, finanziamenti, carte di credito. È la seconda specie di Voce patrimoniale e sottrae dal Patrimonio.
_Avoid_: liability, passività

**Residuo**:
Quanto si deve ancora su un Debito. È il valore della sua Componente, cioè **l'opposto della somma dei suoi Movimenti** (ADR-0011): l'erogazione di un mutuo lo alza, la quota capitale della rata lo abbassa, una spesa fatta con la carta lo alza, un rimborso lo abbassa. Non è un campo, e non si dichiara al posto dei Movimenti: si corregge con il residuo vero.
_Avoid_: saldo (il saldo è di un conto), importo del debito, capitale residuo

**Erogazione**:
Il denaro che un Debito mette a disposizione quando nasce o quando si allarga: un Trasferimento dal Debito al conto che lo incassa. Non è un'Entrata e non entra nel budget — il patrimonio non cambia, cambiano le sue due parti.
_Avoid_: prestito, accreditamento, liquidità

**Movimento**:
Qualunque scrittura registrata su una Voce patrimoniale: una Spesa, un'Entrata, un Trasferimento o una Rettifica. Appartiene sempre a una Voce e alla sua Componente predefinita.
_Avoid_: transazione, operazione, riga

**Spesa**:
Un'uscita di denaro classificata per categoria.

**Entrata**:
Un ingresso di denaro classificato per categoria.

**Trasferimento**:
Lo spostamento di valore tra due Voci patrimoniali. Non è una Spesa né un'Entrata e non entra nel budget.

**Rettifica**:
Una variazione del valore di una sola Voce, senza controparte: una rivalutazione, un interesse addebitato, la correzione di una stima.

**Realizzo**:
Il prezzo effettivamente incassato dalla vendita di una Voce patrimoniale; può differire dall'ultima Valutazione.

**Plusvalenza**:
La differenza tra il Realizzo e l'ultima Valutazione di una Voce venduta; è una Minusvalenza quando il Realizzo è inferiore.

### Valorizzazione

**Valorizzazione a movimenti**:
La Componente vale la somma dei suoi Movimenti (la liquidità di un Conto).

**Valorizzazione a mercato**:
La Componente vale il suo prezzo corrente, che cambia senza intervento dell'utente (un titolo).

**Valorizzazione dichiarata**:
La Componente vale il valore indicato dall'utente, che resta valido finché non lo aggiorna (un immobile, un gioiello, il residuo di un mutuo).

**Valutazione**:
Un valore dichiarato con la sua data. L'insieme delle Valutazioni di una Componente ne forma lo storico.

**Fotografia mensile**:
Il valore del Patrimonio registrato alla chiusura di un mese. Quella del mese in corso è **provvisoria**: viene riscritta a ogni ricalcolo e diventa definitiva quando il mese successivo la sostituisce. Lo storico comincia dal mese in cui la Fotografia ha iniziato a essere scritta.

**Ripartizione**:
La vista del Patrimonio che mostra di che cosa è fatto, mese per mese: un blocco per Tipo sopra lo zero (le Attività) e uno sotto (i Debiti). È la stessa storia della **Curva** guardata dall'altro lato — la Curva dice quanto vale il Patrimonio, la Ripartizione dice di che cosa è composto — e le due viste condividono il **periodo** (ultimo mese, 90 giorni, da inizio anno, sempre). Quando i mesi sono troppi per disegnarli tutti, le barre diventano annuali e ognuna porta il valore dell'**ultimo mese dell'anno**, non la somma dell'anno: un saldo si legge, non si somma.
_Avoid_: breakdown, composizione, torta

### Debiti

**Rata**:
Il pagamento periodico di un Debito. Si divide in due quote e genera due Movimenti: la quota interessi è una Spesa sul conto che paga, la quota capitale è un Trasferimento dal conto al Debito.
_Avoid_: mensilità, installamento

**Durata**:
Per quanto è stato acceso un Debito con piano di ammortamento, in anni (10, 15, 20, 25, 30, o comunque la si scriva). È il dato che l'utente conosce sempre, anche quando non conosce né il tasso né la data dell'ultima rata.

**Rate pagate**:
Quante rate sono già state pagate quando il Debito viene registrato. Chi sta pagando la 57ª rata ne ha pagate 56: si conta quella pagata, non quella in corso. Insieme alla Durata dice quante rate restano.

**Estinzione anticipata**:
Il versamento di capitale che abbassa il residuo fuori dalla Rata. È **parziale** quando resta un residuo (e la banca accorcia la durata o abbassa la rata), **totale** quando il residuo arriva a zero e il Debito si chiude. Non è una Spesa: il capitale non è un costo.
_Avoid_: rimborso anticipato, prepayment, saldo anticipato

**Tasso ricavato**:
Il tasso che rende vera l'uguaglianza fra residuo, rata e rate restanti. Contiene tutto quello che la rata contiene oltre agli interessi — premio assicurativo compreso — e per questo riproduce la divisione che ha fatto la banca.
_Avoid_: tasso effettivo, tasso implicito, TAEG

**Tasso dell'atto**:
Il tasso nominale annuo scritto nel contratto di mutuo. È il numero pulito: non sa niente di quello che la banca ha messo dentro la rata oltre agli interessi.
_Avoid_: tasso contrattuale, tasso nominale

**Quota capitale**:
La parte della Rata che abbassa il residuo del Debito. Non è un costo: è denaro che si sposta dal conto al debito.

**Quota interessi**:
La parte della Rata che è un costo e non abbassa il residuo. È un dato della banca, non un calcolo: si legge dal piano di ammortamento o dall'estratto conto, e se dentro c'è anche un premio assicurativo resta lì. La differenza fra la Rata e la Quota interessi è la Quota capitale.

**Debito collegato**:
Il Debito che grava su una specifica Attività: il mutuo sulla casa che ha finanziato. Un Debito senza collegamento non grava su niente in particolare. Serve a leggere la Quota di proprietà e a non confondere due mutui con due case.
_Avoid_: mutuo associato, debito garantito

**Quota di possesso**:
La parte di una Voce che appartiene alla persona, quando la Voce è di più persone: una casa cointestata, un mutuo cointestato. Patrimonio e budget mostrano la quota, non l'intero — il valore dichiarato della Voce resta quello vero (il valore di mercato della casa intera), e la percentuale è solo la lente con cui si legge. Dice di chi è una cosa, non da quando: non ha una data.
_Avoid_: percentuale, split, contitolarità

**Quota di proprietà**:
La parte del valore di un'Attività che è davvero della persona: il valore della Voce meno i Debiti collegati. Non è una Componente e non è un valore dichiarato: si legge, e cresce da sé perché è il Debito a scendere. Il valore dell'Attività resta quello di mercato e non si muove con le rate.
_Avoid_: equity, capitale proprio, quota mia

### Investimenti

**Strumento**:
Titolo, ETF, fondo o conto trattato dal modulo investimenti; ha un prezzo aggiornato.

**Portafoglio**:
L'insieme delle posizioni detenute, calcolato dalle Allocazioni e dalle vendite.

**Allocazione**:
Il risparmio di un mese assegnato a una Voce patrimoniale. Assegnarlo registra il Trasferimento dal conto di origine alla destinazione.

### Budget

**Categoria**:
L'etichetta con cui si classificano le Spese e le Entrate: ristoranti, alimentari, casa, stipendio. Ha un nome, un tipo (uscite o entrate), una Classe — solo per le uscite — e, per le non mensili, un Previsto annuale. È una cosa dell'utente, una per nome: rinominarla o eliminarla è un'operazione sola, non una passata su tutti i mesi.
_Avoid_: voce di budget, tipo di spesa, etichetta

**Classe della categoria**:
Come una categoria di uscita si comporta nel tempo: **fissa**, **flessibile** o **non mensile**. È una lettura, non una regola che scrive: una categoria fissa non registra movimenti da sé.

**Categoria fissa**:
Una categoria di uscita che si ripete uguale ogni mese: affitto, abbonamenti, telefono, palestra, assicurazioni, la rata di un debito. Il previsto è lo stesso ogni mese.

**Categoria flessibile**:
Una categoria di uscita che cade ogni mese ma con importo diverso: ristoranti, alimentari, shopping, vestiario, arredamento, spese varie. Anche qui il previsto è mensile, e il mese si legge come scostamento da quello.

**Categoria non mensile**:
Una categoria di uscita che non torna ogni mese: regali, vacanze, un intervento in casa, un computer, dal dentista, spese finanziarie. Il previsto è annuale e il confronto si fa sull'anno; il mese mostra solo quanto è uscito.

**Previsto annuale**:
Il numero che una categoria non mensile dichiara per l'anno (per esempio 3.000 € per regali e vacanze). Si confronta con quanto è uscito da gennaio a oggi, e il mese non lo divide in dodicesimi.
_Avoid_: budget annuale (è il previsto di una categoria sola, non il totale dell'anno)
