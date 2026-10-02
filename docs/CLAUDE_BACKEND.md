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
```

## Authentication Middleware
```js
const { authenticateToken } = require('./routes/auth');
// Validates Authorization: Bearer <token>
// Sets req.user = { userId, username }
```

## Admin/Maintenance Endpoints
These routes are guarded by `ENABLE_ADMIN_ROUTES=true` and return 404 by default. Enable only in local/dev, run the needed maintenance action, then disable again. Do not enable in Render/production except during a short, intentional maintenance window.

- `GET /api/debug-env` — confirms env vars set (no values exposed)
- `POST/GET /api/migrate-budget-data` — migrates budget data between collections
- `ALL /api/debug-budget-data` — views budget collection content
- `ALL /api/emergency-remove-index` — drops BudgetSettings unique index
- `POST /api/fix-transactions` — normalizes importo signs (also requires auth)
- `POST /api/test-auth` — verifies auth middleware (also requires auth)
- `POST /api/budget-settings/emergency-fix` — removes duplicate budget docs (also requires auth)
- `POST /api/budget-settings/remove-unique-index` — removes legacy budget unique index (also requires auth)

Frontend emergency buttons are gated by `REACT_APP_ENABLE_ADMIN_ROUTES` (see `AGENTS.md`).

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
| `TransazionePeriodica` | userId, importo, categoria, descrizione, tipo_ripetizione (8 types), configurazione, data_inizio, data_fine, attiva, transazioni_generate |
| `SavingsMonth` | userId, anno, mese (0-indexed), income, expenses, savings, status ('closed'), closedAt |
| `InstrumentAllocation` | userId, savingsMonthId, instrumentId, amount, quantity?, priceAtAllocation? |
| `AllocationPlan` | userId, allocations [{instrumentId, targetPercentage}] |
| `Otp` | OTP code storage |

**importo convention**: `Spesa.importo` always **negative**; `Entrata.importo` always **positive**.

## Services (`/server/services/`)
- `emailService.js` — Singleton. nodemailer. Falls back to console mock if `EMAIL_USER`/`EMAIL_PASS` absent.

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
- MongoDB URI stripped of surrounding quotes at startup (handles Render env var quoting quirk)
- Backend starts without MongoDB (graceful degradation; auth + health still work)
- Admin/debug endpoints are operational utilities but must stay behind `ENABLE_ADMIN_ROUTES`
- `render.yaml` must keep secret env vars as `sync: false`; real values belong in Render, not Git

## Testing
```bash
cd server
node test-server.js      # Manual endpoint testing
node test-email.js       # Email service test
node test-production.js  # Production smoke test
```

## Deployment
- **Platform**: Render, rootDir `./server`. One production backend only.
- **Backend (keep)**: web service `budget-app-ios-backend` → `https://budget-app-ios-backend.onrender.com`. Used by the iOS app, the Expo app and the web app.
- **Web app (keep)**: static site `budget_app` → `https://budget-app-cd5o.onrender.com`.
- **Retired**: the Node service `budget-app` (old `budget-app-ao5r.onrender.com`) is a duplicate backend with no consumers; and `budget-app-backend.onrender.com` does not exist any more (Render answers `no-server`), so that host must not reappear in code, docs or bundle defaults.
- **Start**: `node index.js`; **health check**: `/api/health`
- **Never delete or rename `budget-app-ios-backend`**: the published iOS app pins its host in `budget365iOS/src/config.ts`.
- **Alt**: `vercel.json` routes `/api/*` to `server/index.js` (legacy; Vercel currently serves the API only, not the React UI)
- **Required non-secret Render env**: `CORS_ORIGINS`, `ENABLE_ADMIN_ROUTES=false`
