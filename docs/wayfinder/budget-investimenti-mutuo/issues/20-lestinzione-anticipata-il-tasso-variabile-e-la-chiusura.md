# L'estinzione anticipata, il tasso variabile e la chiusura

Type: task
Status: open
Blocked by: 18

## Question

Che cosa fare: eseguire **P6 e P7** di `docs/PIANO-MUTUO.md` — i casi rari, e la chiusura del piano.

Dal piano:

- **P6** — `POST /api/debiti/:id/versamento` (un Trasferimento dal conto al Debito, **non** una Spesa) con la domanda «accorciare la durata o abbassare la rata», e lo stato «decisione in sospeso» quando la risposta non c'è ancora, con il `PATCH` per scioglierla (`docs/adr/0019`); il tasso variabile si registra scrivendo la rata nuova nel `PATCH`, e il Tasso ricavato si ricalcola (`docs/adr/0020`).
- **P7** — aggiornare `docs/CLAUDE_BACKEND.md` (rotte nuove, campi nuovi, la lente della quota), `docs/CLAUDE_FRONTEND.md` (scheda del bene, modulo di creazione, avvisi) e `CLAUDE.md` (una riga nel blocco Patrimonio: legame, Quota di possesso, rata automatica), restando nei limiti (100 righe `CLAUDE.md`, 120 i sub-file); poi `graphify update .`.

Verifica (dal piano): un versamento parziale con riduzione della durata **accorcia** la scadenza; con riduzione della rata la scadenza **resta**; il budget non si muove in nessuno dei due casi; `node --check` sui file toccati, `npm run build`, e un collaudo finale con i numeri veri del mutuo.

Con questo biglietto il piano del mutuo è eseguito: le decisioni di `docs/adr/0012`–`0020` vivono nel codice, e la documentazione lo dice.

## Answer

<!-- da scrivere alla chiusura -->
