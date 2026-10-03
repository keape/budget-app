# I due tassi e il controllo annuale

Type: task
Status: open
Blocked by: 16

## Question

Che cosa fare: eseguire **P3 e P5** di `docs/PIANO-MUTUO.md` — il piano del Debito con i due tassi, e il controllo annuale del residuo.

Dal piano:

- **P3** — `server/services/debiti.js`: `piano()` accetta `durataAnni` e `ratePagate` e restituisce **entrambi** i tassi (dell'atto e ricavato), quale comanda e la differenza in euro al mese; nuova funzione `rateRestantiDopoVersamento(residuo, rata, tasso)`. `GET /api/debiti/:id` porta i due tassi e la scelta. `src/ContoDettaglio.js` li mostra affiancati con la differenza e quanto costa (`docs/adr/0017`).
- **P5** — `GET /api/debiti/:id` espone `ultimoControlloResiduo` e «controllo dovuto» quando è passato più di un anno; la correzione usa la rotta che esiste già (`POST /api/debiti/:id/residuo`, che scrive la Rettifica). `src/ContoDettaglio.js` mostra il promemoria con il residuo stimato, il campo per quello della banca e la differenza **prima** di confermare.

Perché stanno insieme: il controllo annuale è la contropartita del Tasso ricavato — se il tasso dell'atto comanda e dentro la rata c'è un premio assicurativo, il residuo derivato si scosta, e quel promemoria è ciò che impedisce allo scostamento di restare silenzioso (`docs/adr/0017`, `0018`).

Verifica (dal piano): lo script nuovo `server/scripts/verifica-piano-mutuo.js` sul modello di `diagnostica-saldo.js`, che stampa il piano per il residuo, la rata e le rate reali, e deve dare interessi 254 e capitale 303 quando il Tasso ricavato coincide con la rata della banca; `node --check`, `npm run build`, e il controllo che si veda una volta all'anno con la descrizione «scostamento del calcolo».

## Answer

<!-- da scrivere alla chiusura -->
