# Budget365 Agent Instructions

This repository contains a multi-platform personal budget app:
- Web React frontend in `src/`
- Express/MongoDB backend in `server/`
- React Native app in `budget365iOS/`
- simplified Expo app in `BudgetAppExpo/`

Read `CLAUDE.md` first for the project map. For backend/API work, also read `docs/CLAUDE_BACKEND.md`.

## Security Rules
- Do not commit environment files or credentials. `.env`, `.env.production`, `server/.env`, `server/scripts/.env`, `server/credentials.json`, `social-agent/.env`, and `render-ios.env` must stay untracked.
- If secrets were previously tracked, rotate the affected secrets instead of assuming `.gitignore` is enough.
- Do not expose debug, migration, or emergency repair endpoints in production.
- Do not add raw `console.log` debug output in backend routes. Use `debugLog` from `server/utils/logger.js`; it is silent in production.
- Use `logError` from `server/utils/logger.js` for route errors so production logs avoid verbose stack/payload dumps.
- `/api/auth/social-login` with `provider: 'apple'` verifies the idToken signature against Apple's public keys (`server/utils/appleTokens.js`), together with `iss` and `exp`, and with the `aud` when `APPLE_CLIENT_IDS` is set. Do not go back to `jwt.decode` on this route: an unverified token is a session for any account whose email is known (authentication bypass, verified fixed 2026-10-02).

## Data Rules
- `Spesa.importo` must always be stored as a negative number, including update routes: `-Math.abs(Number(importo))`.
- `Entrata.importo` must always be stored as a positive number, including update routes: `Math.abs(Number(importo))`.
- Do not rely on the frontend to normalize signs; enforce this in backend routes.

## Deploy Configuration
- Do not hardcode deployment URLs in application code when an environment variable can carry them.
- Single production backend for iOS, web and Expo: `https://budget-app-ios-backend.onrender.com` (Render service `budget-app-ios-backend`, rootDir `./server`). Do not reintroduce per-platform backends.
- Web app: React build served as the Render static site `budget_app` → `https://budget-app-cd5o.onrender.com`. API URL is controlled by `REACT_APP_API_URL`; if absent, `src/config.js` falls back to `http://localhost:5001` in development and to the single backend above in production. React inlines this value at build time, so changing it requires a rebuild.
- Google Sign-In on the web login page (`src/Login.js`) uses `REACT_APP_GOOGLE_CLIENT_ID`, also inlined at build time. It must be a **Web application** OAuth client from the iOS app's Google Cloud project; the iOS client id is rejected in browsers. The site origin must be listed in Google Cloud → Credentials → Authorized JavaScript origins. Backend: optional `GOOGLE_CLIENT_IDS` (comma-separated) enables the audience check on `/api/auth/social-login`.
- Apple Sign-In on the web login page (`src/Login.js`) uses `REACT_APP_APPLE_SERVICES_ID`: the **Services ID** from Apple Developer → Identifiers → Services IDs, not the iOS bundle id (`com.keape.budget365`). Its Return URL must be `<site origin>/login`, and the page that starts the access must have the same origin, so the Apple button cannot be tested on localhost. No `.p8` key is needed (the id-token is verified, there is no code exchange). Inlined at build time. Backend: optional `APPLE_CLIENT_IDS` (comma-separated) enables the audience check and must list both the Services ID and the iOS bundle id.
- Backend CORS is controlled by comma-separated `CORS_ORIGINS`. If absent, `server/index.js` uses its `defaultCorsOrigins` allowlist, which must keep the web app origin.
- Render backend env should include `CORS_ORIGINS`, `FRONTEND_URL`, `MONGODB_URI`, `JWT_SECRET`, email vars, and `ENABLE_ADMIN_ROUTES=false`.
- iOS and Expo apps hardcode the backend URL (`budget365iOS/src/config.ts`, `BudgetAppExpo/App.tsx`). The published iOS app pins that host, so the Render service behind it must never be deleted or renamed without shipping a new app build first.

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
