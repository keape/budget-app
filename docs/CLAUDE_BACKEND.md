# Budget365 — Backend Context (Node.js/Express)

## Stack
**Location**: `/server/`
**Tech**: Express 4, MongoDB, Mongoose 7, JWT (jsonwebtoken 9), bcryptjs, nodemailer
**Port**: 5001 (override with `PORT` env var)
**Entry**: `server/index.js`

## API Routes (all prefixed `/api`)
```
GET  /api/health                          Server + DB status
POST /api/auth/register                   New user registration
POST /api/auth/login                      Login, returns JWT
POST /api/auth/send-otp                   Send OTP email
POST /api/auth/verify-otp                 Verify OTP code
POST /api/auth/forgot-password            Trigger password reset email
POST /api/auth/change-password            Change password (auth required)
POST /api/auth/social-login               Social login: `{ provider, idToken }` (google e apple entrambi verificati)
POST /api/auth/update-email               Update email (auth required)
DEL  /api/auth/delete-account             Delete account (auth required)
*    /api/spese                           CRUD expenses
*    /api/entrate                         CRUD income
*    /api/budget-settings                 Budget config CRUD
*    /api/categorie                       Category management
*    /api/transazioni-periodiche          Recurring transactions CRUD
*    /api/automation                      Google Sheets webhook
GET  /api/savings/months                  List SavingsMonth docs for user
POST /api/savings/ensure-month            Create SavingsMonth for past month (idempotent) { anno, mese }
POST /api/savings/auto-close              Create/update SavingsMonth for previous month (fire-and-forget)
GET  /api/savings/months/:id/allocations  Instrument allocations for month
POST /api/savings/months/:id/allocations  Add allocation
DEL  /api/savings/months/:id/allocations/:allId  Delete allocation
GET  /api/savings/plan                    User target allocation plan
PUT  /api/savings/plan                    Update plan
GET  /api/savings/portfolio               Cumulative portfolio across all months
GET  /api/patrimonio                     Patrimonio, gruppi, voci con serie mensile, tipi e Fotografie (la GET scrive la Fotografia del mese)
GET  /api/patrimonio/fotografie          Storico delle Fotografie, senza scrivere
POST /api/patrimonio/fotografie          Scrive la Fotografia di un mese { anno, mese? }
GET  /api/voci/:id                        Scheda di un conto: valore, serie mese per mese, suoi Movimenti e `conteggi` per tipo
*    /api/voci                           Voci patrimoniali (conti, beni): CRUD + POST /:id/componenti. DELETE con `?conMovimenti=true` cancella anche i suoi Movimenti (vedi ADR-0010)
*    /api/componenti                     Componenti di una Voce: PATCH (nome, costo, nuova Valutazione, chiusura), DELETE
*    /api/tipi-voce                      Catalogo dei Tipi dell'utente: CRUD (la specie non si modifica)
*    /api/trasferimenti                  Movimenti tra due Voci: GET, POST, DELETE — fuori dal budget
*    /api/rettifiche                     Variazioni di una sola Voce (delta con segno): GET, POST, DELETE — fuori dal budget
```

### Patrimonio (`/server/services/patrimonio.js`)
Unico posto dove si calcola il patrimonio: il valore di una Voce è la somma delle sue Componenti, e la valorizzazione della Componente decide come si ottiene (`movimenti`: Spese + Entrate − Trasferimenti uscenti + entranti + Rettifiche; `dichiarata`/`mercato`: ultima Valutazione, altrimenti costo di acquisto). Il servizio garantisce anche le precondizioni — catalogo Tipi iniziale, Conto principale, Componente predefinita — e ripara i Movimenti orfani assegnandoli al Conto principale. **Spese ed Entrate hanno sempre `voceId` + `componenteId`**: le rotte li risolvono da sé quando il client non li manda.

**Serie mensili.** Ogni Voce porta la sua `sparkline` (ultime 12 mensilità) e il `deltaMese`; `dettaglioVoce` restituisce la `serie` intera, i `movimenti` e i `conteggi`. La serie di un conto **non** viene dalle Fotografie ma dalla somma cumulata dei suoi Movimenti (`flussiMensiliPerComponente`, mesi in `Europe/Rome`), quindi ha storia anche per i mesi in cui nessuno ha aperto l'app; per una Componente dichiarata la curva è la sequenza delle sue Valutazioni. La curva del **patrimonio complessivo** resta invece quella delle Fotografie (ADR-0009); `serieRicostruita` è solo il ripiego finché non ci sono due Fotografie.

**Conti chiusi.** `calcolaPatrimonio` legge tutte le Voci ma somma solo quelle non `archiviata`; le chiuse tornano in `chiuse` per l'elenco `Conti chiusi` e per la loro scheda, che resta apribile. Chiusura ed eliminazione: ADR-0010.

## Authentication Middleware
```js
const { authenticateToken } = require('./routes/auth');
// Validates Authorization: Bearer <token>
// Sets req.user = { userId, username }
```

## Admin/Maintenance Endpoints
These routes are guarded by `ENABLE_ADMIN_ROUTES=true` and return 404 by default; the current list is in `AGENTS.md`. Enable only in local/dev, run the needed maintenance action, then disable again. Never in Render/production except during a short, intentional window.

### Social login (`/api/auth/social-login`)
- **Google**: verifies the idToken via `oauth2.googleapis.com/tokeninfo` and rejects a non-verified email. Optional `GOOGLE_CLIENT_IDS` (comma-separated, web + iOS client ids) enables the audience check; without it any audience is accepted.
- **Apple**: la firma dell'idToken è verificata con le chiavi pubbliche di Apple (`server/utils/appleTokens.js`): firma RS256, `iss = https://appleid.apple.com`, `exp`. L'`aud` è controllata solo se `APPLE_CLIENT_IDS` (comma-separated) è configurata, e deve elencare sia il bundle id iOS (`com.keape.budget365`) sia il Services ID web. `APPLE_JWKS_URL` esiste solo per i test locali. Prima si usava `jwt.decode`, quindi un token fabbricato con l'email di un altro utente dava una sessione valida sul suo account: non reintrodurre quella lettura senza verifica.
- Both: existing users are matched/linked by `email`, then by `googleId`/`appleId`.

## CORS Allowed Origins
Set allowed origins with comma-separated `CORS_ORIGINS` in `server/.env` or Render:

```env
CORS_ORIGINS=https://budget-app-cd5o.onrender.com,https://budget-app-keape.vercel.app,https://budget-app-three-gules.vercel.app,http://localhost:3000
```

`https://budget-app-cd5o.onrender.com` is the web app (Render static site `budget_app`) and must always stay in the list.

If `CORS_ORIGINS` is absent, `server/index.js` falls back to its `defaultCorsOrigins` allowlist: `localhost:3000`, the web app origin above, and the two historical Vercel domains.

## Database Models (`/server/models/`)
| Model | Key Fields |
|-------|-----------|
| `User` | username (unique), password (bcrypt), email, googleId, appleId, resetPasswordToken/Expires |
| `Spesa` | userId, descrizione, importo (**negative**), categoria, data; index `{userId, data}` |
| `Entrata` | userId, descrizione, importo (**positive**), categoria, data; index `{userId, data}` |
| `BudgetSettings` | userId, anno, mese (0–11 JS), spese (Map), entrate (Map) |
| `TransazionePeriodica` | userId, importo, categoria, descrizione, tipo_ripetizione (8 types), configurazione, data_inizio, data_fine, attiva, transazioni_generate, **voceId** |
| `TipoVoce` | userId, nome, specie (`attivita`\|`debito`), denaro, pianoAmmortamento, sistema, archiviato; unico `{userId, nome}` |
| `Attivita` | Voce patrimoniale che somma: userId, nome, tipoId, note, archiviata |
| `Componente` | userId, voceSpecie + voceId, nome, valorizzazione (`movimenti`\|`mercato`\|`dichiarata`), predefinita, costoAcquisto, valutazione + storico `valutazioni`, chiusa, realizzo |
| `Trasferimento` | userId, da/a (`voceSpecie`+`voceId`+`componenteId`), importo (positivo), data, descrizione, origine |
| `Rettifica` | userId, voceSpecie + voceId + componenteId, importo (delta con segno), data, descrizione, origine |
| `Fotografia` | userId, anno, mese (0-indexed), patrimonio, attivita, debiti, voci[], chiusa; unico `{userId, anno, mese}` |
| `SavingsMonth` | userId, anno, mese (0-indexed), income, expenses, savings, status ('closed'), closedAt |
| `InstrumentAllocation` | userId, savingsMonthId, instrumentId, amount, quantity?, priceAtAllocation? |
| `AllocationPlan` | userId, allocations [{instrumentId, targetPercentage}] |
| `Otp` | OTP code storage |

**importo convention**: `Spesa.importo` always **negative**; `Entrata.importo` always **positive**. `Trasferimento.importo` è sempre positivo (la direzione la dà la coppia da → a); `Rettifica.importo` è un delta con segno.

## Services (`/server/services/`)
- `emailService.js` — Singleton. nodemailer. Falls back to console mock if `EMAIL_USER`/`EMAIL_PASS` absent.
- `patrimonio.js` — unico motore del Patrimonio (valore delle Componenti, gruppi, Fotografie, precondizioni). Vedi la sezione Patrimonio più sopra.

## Conventions
- **Routes**: one file per resource in `/server/routes/`, exports router
- **Auth export**: `module.exports = { router, authenticateToken }` from `routes/auth.js`
- **User scoping**: all queries filter by `req.user.userId`
- **Error handling**: centralized Express error middleware at bottom of `server/index.js`
- **Response format**: always JSON `{ success: boolean, data?, error?, message? }`
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection` set globally
- **Route logging**: import `{ debugLog, logError }` from `server/utils/logger.js`; `debugLog` is silent in production, `logError` avoids verbose production stack/payload dumps.
- **Import signs**: backend routes must enforce `Spesa.importo = -Math.abs(Number(importo))` and `Entrata.importo = Math.abs(Number(importo))` on create and update.

## Known Notes
- `BudgetSettings` has **no unique index** (intentionally removed — was causing 409 errors)
- MongoDB URI stripped of surrounding quotes at startup; backend starts without MongoDB (graceful degradation)
- Admin/debug endpoints are operational utilities but must stay behind `ENABLE_ADMIN_ROUTES`

## Testing
```bash
cd server
node test-server.js                             # Manual endpoint testing
node scripts/migrate-fetta1-voci.js             # Migrazione voci: prova, non scrive
node scripts/migrate-fetta1-voci.js --conferma  # Migrazione voci: esegue (produce file di rollback)
```

## Deployment
- **Platform**: Render, rootDir `./server`. One production backend only: `budget-app-ios-backend` → `https://budget-app-ios-backend.onrender.com` (iOS + Expo + web). **Never delete or rename it**: the published iOS app pins its host in `budget365iOS/src/config.ts`. **Web app**: static site `budget_app` → `https://budget-app-cd5o.onrender.com`.
- **Start**: `node index.js`; **health check**: `/api/health`. `render.yaml` keeps secrets as `sync: false`; real values belong in Render, not Git.
- **Retired**: the Node service `budget-app` (`budget-app-ao5r.onrender.com`) is a duplicate with no consumers; `budget-app-backend.onrender.com` no longer exists, so that host must not reappear in code, docs or bundle defaults.
- **Required non-secret Render env**: `CORS_ORIGINS`, `ENABLE_ADMIN_ROUTES=false`
