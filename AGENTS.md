# Budget365 Agent Instructions

This repository contains a multi-platform personal budget app:
- Web React frontend in `src/`
- Express/MongoDB backend in `server/`
- React Native app in `budget365iOS/`
- simplified Expo app in `BudgetAppExpo/`

Read `CLAUDE.md` first for the project map. For backend/API work, also read `docs/CLAUDE_BACKEND.md`.

## Security Rules
- Do not commit environment files or credentials. `.env`, `.env.production`, `server/.env`, `server/scripts/.env`, `server/credentials.json`, and `social-agent/.env` must stay untracked.
- If secrets were previously tracked, rotate the affected secrets instead of assuming `.gitignore` is enough.
- Do not expose debug, migration, or emergency repair endpoints in production.
- Do not add raw `console.log` debug output in backend routes. Use `debugLog` from `server/utils/logger.js`; it is silent in production.
- Use `logError` from `server/utils/logger.js` for route errors so production logs avoid verbose stack/payload dumps.

## Data Rules
- `Spesa.importo` must always be stored as a negative number, including update routes: `-Math.abs(Number(importo))`.
- `Entrata.importo` must always be stored as a positive number, including update routes: `Math.abs(Number(importo))`.
- Do not rely on the frontend to normalize signs; enforce this in backend routes.

## Deploy Configuration
- Do not hardcode deployment URLs in application code when an environment variable can carry them.
- Web frontend API URL is controlled by `REACT_APP_API_URL`. If absent, `src/config.js` falls back to `http://localhost:5001` in development and `https://budget-app-backend.onrender.com` in production.
- Backend CORS is controlled by comma-separated `CORS_ORIGINS`. If absent, `server/index.js` uses the legacy default allowlist.
- Render backend env should include `CORS_ORIGINS`, `FRONTEND_URL`, `MONGODB_URI`, `JWT_SECRET`, email vars, and `ENABLE_ADMIN_ROUTES=false`.
- Vercel frontend env should include `REACT_APP_API_URL=https://budget-app-backend.onrender.com` and `REACT_APP_ENABLE_ADMIN_ROUTES=false`.

## Admin/Maintenance Routes
Backend maintenance routes are disabled by default and return 404 unless:

```env
ENABLE_ADMIN_ROUTES=true
```

Use this only in local/dev, run the required maintenance task, then disable it again. Leave it absent or `false` in Render/production.

Guarded backend routes include:
- `/api/debug-env`
- `/api/migrate-budget-data`
- `/api/debug-budget-data`
- `/api/emergency-remove-index`
- `/api/test-auth`
- `/api/fix-transactions`
- `/api/budget-settings/emergency-fix`
- `/api/budget-settings/remove-unique-index`

The frontend emergency buttons in `src/BudgetSettings.js` are hidden unless React is started/built with:

```env
REACT_APP_ENABLE_ADMIN_ROUTES=true
```

Only enable the frontend flag together with the backend flag in local/dev.

## Verification
For this security area, run:

```bash
node --check server/index.js
node --check server/routes/budgetSettings.js
npm run build
```
