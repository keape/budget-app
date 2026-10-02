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
L'etichetta che raggruppa le Voci. Il catalogo iniziale è, nell'ordine in cui si mostra: **Attività** — Contanti, Conti correnti, Investimenti, Immobili, Veicoli, Beni di valore, Crediti, Altri asset; **Debiti** — Mutui, Finanziamenti, Carte di credito, Altre liability. L'utente può crearne, rinominarne, riordinarne e cancellarne. Il tipo dice se un'Attività è denaro o bene materiale e, per i Debiti, se hanno un piano di ammortamento. Non determina come si valuta una Voce: lo decide la Componente. La **specie** di un Tipo (Attività o Debito) si dichiara alla creazione e non si cambia: è la barriera che impedisce a un debito di diventare un'attività per sbaglio. L'ordine in cui i Tipi compaiono è un dato del Tipo (`ordine`), non una regola del programma.
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
Somma dovuta il cui residuo è indicato dall'utente, calcolato dalle rate o modificato dai suoi Movimenti: mutui, finanziamenti, carte di credito.
_Avoid_: liability, passività

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

### Debiti

**Rata**:
Il pagamento periodico di un Debito.

**Quota capitale**:
La parte della Rata che abbassa il residuo del Debito.

**Quota interessi**:
La parte della Rata che è un costo e non abbassa il residuo.

### Investimenti

**Strumento**:
Titolo, ETF, fondo o conto trattato dal modulo investimenti; ha un prezzo aggiornato.

**Portafoglio**:
L'insieme delle posizioni detenute, calcolato dalle Allocazioni e dalle vendite.

**Allocazione**:
Il risparmio di un mese assegnato a una Voce patrimoniale. Assegnarlo registra il Trasferimento dal conto di origine alla destinazione.
