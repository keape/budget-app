# Budget365 - Claude Code Context

## Project Overview
Multi-platform personal budget app:
- **Web React** (`/src/`) — React 18, Tailwind, Recharts, Vercel
- **Backend** (`/server/`) — Node.js/Express 4, MongoDB/Mongoose, Render
- **React Native** (`/budget365iOS/`) — RN 0.80.2 + React 19.1.0, iOS + Android
- **Expo** (`/BudgetAppExpo/`) — simplified Expo ~53 version

## Repository Structure
```
/
├── src/                    # React web frontend
├── server/                 # Node.js/Express backend
├── budget365iOS/           # React Native app (TypeScript)
├── BudgetAppExpo/          # Expo app
├── docs/                   # Extended Claude context (auto-injected by hook)
│   ├── CLAUDE_MOBILE.md    # React Native: screens, Metro, Xcode, conventions
│   ├── CLAUDE_BACKEND.md   # API routes, models, middleware, deployment
│   └── CLAUDE_FRONTEND.md  # Pages, components, hooks, routing, conventions
├── package.json            # Frontend deps + npm scripts
├── tailwind.config.js
├── vercel.json             # Routes /api/* to server/index.js
├── render.yaml             # Render blueprint (secrets as sync: false, no credentials inside)
└── .env                    # Local env vars
```

## Sub-file Context Map
The hook inietta automaticamente il sub-file rilevante. Se non iniettato, leggo io:
- **Mobile task** → `Read docs/CLAUDE_MOBILE.md`
- **Backend/API task** → `Read docs/CLAUDE_BACKEND.md`
- **Frontend web task** → `Read docs/CLAUDE_FRONTEND.md`

## Development Commands

### Backend (port 5001)
```bash
npm run server              # From root
cd server && npm start      # Direct
```

### Frontend Web (port 3000)
```bash
npm start                   # Dev server (hot reload)
npm run build               # Production build
npx serve -s build -l 3000  # Test prod build
npm test                    # React Testing Library
```

### React Native
```bash
cd budget365iOS
nohup node start-metro.js &              # Metro (NOT npm start)
npx react-native run-ios --scheme Budget365 --mode Debug  # iOS simulator
npx react-native run-android             # Android
```

### Full-Stack Dev
```bash
npm run server   # Terminal 1 — backend port 5001
npm start        # Terminal 2 — frontend port 3000
```

## Environment Variables
**Root `.env`**:
- `MONGODB_URI`, `JWT_SECRET` — stessi valori usati dal backend avviato dalla root
- `REACT_APP_API_URL` — web frontend backend API URL override
- `REACT_APP_ENABLE_ADMIN_ROUTES` — shows web emergency maintenance buttons only when `true`
- `REACT_APP_GOOGLE_CLIENT_ID` — OAuth client **web** per "Accedi con Google" (build-time; l'iOS client id non vale nel browser)

**Deploy**: un solo backend di produzione, `budget-app-ios-backend` (iOS + web + Expo); webapp su sito statico Render. Dettagli in `docs/CLAUDE_BACKEND.md` → Deployment.

**Backend `server/.env` / Render env**:
- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — JWT signing secret
- `PORT` — server port (default 5001)
- `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`
- `FRONTEND_URL` — frontend URL used for password reset links
- `CORS_ORIGINS` — comma-separated allowed origins, e.g. `https://budget-app-cd5o.onrender.com,https://budget-app-keape.vercel.app,https://budget-app-three-gules.vercel.app`
- `ENABLE_ADMIN_ROUTES` — must be absent/`false` in production
- `GOOGLE_CLIENT_IDS` — opzionale, client id OAuth (web + iOS) ammessi come audience dei token Google

**Admin/maintenance route guard**:
- Backend maintenance/debug routes are disabled by default. Enable only in local/dev by setting `ENABLE_ADMIN_ROUTES=true` in `server/.env`.
- If the web UI needs to show emergency maintenance buttons, also set `REACT_APP_ENABLE_ADMIN_ROUTES=true` in the frontend env and rebuild/restart React.
- Never enable these in Render/production unless performing a short, intentional maintenance window; leave absent or `false` after use.
- Guarded routes include `/api/debug-env`, `/api/migrate-budget-data`, `/api/debug-budget-data`, `/api/emergency-remove-index`, `/api/test-auth`, `/api/fix-transactions`, `/api/budget-settings/emergency-fix`, `/api/budget-settings/remove-unique-index`.

**Social login**: `/api/auth/social-login`. Google verifica l'idToken con `tokeninfo`; Apple lo verifica con le chiavi pubbliche di Apple (`server/utils/appleTokens.js`): firma, `iss`, `exp` e — se `APPLE_CLIENT_IDS` è configurata — `aud`. Dettagli in `docs/CLAUDE_BACKEND.md`.

## Patrimonio (dominio)
Il modello del patrimonio è descritto da `GLOSSARY.md` (lessico) e da `docs/adr/0002`–`0011`; il codice lo implementa in `server/models/{TipoVoce,Attivita,Debito,Componente,Trasferimento,Rettifica,Fotografia}.js`, `server/services/{patrimonio,debiti}.js` e `server/routes/{voci,componenti,tipiVoce,patrimonio,trasferimenti,rettifiche,debiti}.js`. Regole da non violare: il valore di una Voce è la somma delle sue Componenti; Attività e Debito sono due collezioni distinte; il residuo di un Debito è l'opposto della somma dei suoi Movimenti (ADR-0011); Spesa/Entrata/Trasferimento/Rettifica stanno in collezioni separate e solo le prime due entrano nel budget; il patrimonio si calcola in un unico posto (`services/patrimonio.js`). Il **piano di allocazione resta sospeso** e iOS/Expo sono fuori perimetro fino al collaudo web.

## Cross-Platform Conventions
- **JWT storage**: `localStorage` (web) / `AsyncStorage` (mobile)
- **API response**: `{ success: boolean, data?, error?, message? }`
- **BudgetSettings `mese`**: 0-indexed (0 = Jan, 11 = Dec) — JS Date convention
- **`importo`**: `Spesa` always **negative**, `Entrata` always **positive**; enforce signs in backend create/update routes
- **Auth header**: `Authorization: Bearer <token>` on all protected endpoints
- **Backend route logging**: use `debugLog`/`logError` from `server/utils/logger.js`; avoid raw debug `console.log` in routes

## Known Notes (Cross-cutting)
- Root `package.json` `postinstall` runs `cd server && npm install` automatically
- Backend starts without MongoDB (graceful degradation)
- `render.yaml` uses `sync: false` for secrets; keep real secret values in Render/Vercel dashboards, not in Git

## App Store Upload
Skill `appstore-upload` (`.claude/skills/appstore-upload/SKILL.md`). Bug log: `.claude/CLAUDE_xcode.md`.
Trigger: quando l'utente vuole pubblicare su App Store o TestFlight.

## CLAUDE.md Maintenance Rules
- **Target**: main CLAUDE.md ≤ 100 righe; ogni sub-file ≤ 120 righe
- **Trigger aggiornamento sub-file**: nuova screen, route, model, o convenzione aggiunta
- **Pruning**: quando aggiungo entry rimuovo sezioni obsolete di dimensione equivalente
- **Commit sub-file** sempre dopo aggiornamento (resetta stale detection del hook)

## graphify

Knowledge graph in `graphify-out/`. Per domande sul codice: `graphify query "<domanda>"`, `graphify path "<A>" "<B>"`, `graphify explain "<concetto>"` (sottografo mirato, più piccolo di GRAPH_REPORT.md). `graphify-out/wiki/index.md` per la navigazione ampia; GRAPH_REPORT.md solo per la revisione d'insieme. Dopo una modifica: `graphify update .` (solo AST, nessun costo API).
