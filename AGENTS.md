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
