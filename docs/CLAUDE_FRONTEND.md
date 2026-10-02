# Budget365 — Frontend Context (React Web)

## Stack
**Location**: `/src/`
**Tech**: React 18, React Router v6, Tailwind CSS, Axios, Recharts
**Port**: 3000 (development)

## Pages (flat structure in `/src/`)
- `App.js` — Root component, defines all routes
- `Home.js` — Dashboard (main view)
- `Transazioni.js` — Transaction list
- `Budget.js` — Budget view with charts
- `BudgetSettings.js` — Budget configuration
- `Filtri.js` — Filters and reporting
- `Login.js`, `Register.js` — Authentication
- `ForgotPassword.js`, `ResetPassword.js`, `ChangePassword.js` — Password management
- `AboutUs.js` — About page
- `Home_backup.js`, `Home_new.js` — Legacy backups (NOT used by App.js)

## Route Map
```
/                    Home dashboard (protected)
/transazioni         Transaction list (protected)
/budget              Budget view (protected)
/budget/settings     Budget settings (protected)
/filtri              Filters/reports (protected)
/change-password     (protected)
/about-us            (protected)
/login               Auth (public)
/register            Auth (public)
/forgot-password     Password reset (public)
/reset-password      Password reset (public)
*                    Redirects to /
```

## Components (`/src/components/`)
- `BudgetChart.js` — Recharts budget chart
- `BudgetHeader.js` — Budget page header
- `BudgetSummary.js` — Budget summary card
- `BudgetTable.js` — Budget data table
- `LoadingSpinner.js` — Reusable loading indicator
- `MonthlySummaryChart.js` — Monthly summary chart
- `NotificationBar.js` — In-app notifications
- `GoogleSignInButton.js` — pulsante ufficiale "Accedi con Google" (Google Identity Services); renderizzato solo se `REACT_APP_GOOGLE_CLIENT_ID` è impostata
- `OTPVerification.js` — OTP input
- `ResponsiveTable.js` — Mobile-friendly table

## Contexts (`/src/contexts/`)
- `NotificationContext.js` — provides `addNotification`, `removeNotification`, `markAsRead`, `clearAll`, `addMultipleNotifications`, `getUnreadCount`, `getTodayNotifications`

## Hooks (`/src/hooks/`)
- `useAuth.js` — JWT decode/expiry, `isAuthenticated`, `logout`, `getToken`
- `useBudgetData.js` — fetches spese/entrate/budgetSettings for month/year
- `useBudgetCalculations.js` — budget vs actual, chart data, sorting

## Key Files
- `ThemeContext.js` — dark/light mode; persists to localStorage; `useTheme()` → `{ darkMode, toggleDarkMode }`
- `utils/googleSignIn.js` — loader di Google Identity Services + lettura di `REACT_APP_GOOGLE_CLIENT_ID`
- `ProtectedRoute.js` — route guard using `useAuth`
- `navbar.js` — navigation bar (**lowercase filename** — import accordingly)
- `config.js` — Axios base URL + interceptors (auto-inject JWT, redirect on 401/403)

## API Base URL (`/src/config.js`)
```js
const BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://budget-app-ios-backend.onrender.com'
    : 'http://localhost:5001');
```
Import: `import BASE_URL from '../config';`
The web app is served by the Render static site `budget_app` (`https://budget-app-cd5o.onrender.com`): set `REACT_APP_API_URL=https://budget-app-ios-backend.onrender.com` in that service's environment, or rely on the code default. Both require a rebuild, because React inlines the value at build time.
Emergency admin UI in `BudgetSettings.js` is hidden unless `REACT_APP_ENABLE_ADMIN_ROUTES=true`.

## Social login web (`/src/Login.js`)
- Pulsante Google nel login web, sotto il divisore "oppure" (stessa posizione della app iOS).
- `REACT_APP_GOOGLE_CLIENT_ID` **deve** essere un OAuth client di tipo *Web application* del progetto Google Cloud del progetto iOS: il client iOS non funziona nel browser. L'origine del sito va autorizzata in console (Origini JavaScript autorizzate). Come `REACT_APP_API_URL`, è inlinata al build: cambiarla richiede un rebuild del sito statico.
- Flusso: GIS restituisce l'`id_token` → `POST /api/auth/social-login` (`provider: 'google'`) → il backend risponde `{ token, username }` → il token va in `localStorage` come nel login con password.
- Pulsante Apple accanto a quello Google. `REACT_APP_APPLE_SERVICES_ID` è il **Services ID** (Apple Developer → Identifiers → Services IDs), non il bundle id della app iOS; inlinata al build come le altre.
- L'URL di ritorno è `<origine>/login` e deve essere elencato fra i *Return URLs* del Services ID: la pagina che avvia l'accesso e l'URL di ritorno devono avere la stessa origine, quindi **il pulsante Apple non è provabile in locale**, solo sul sito in produzione. Non serve alcuna chiave `.p8`: si verifica l'id-token, non si scambia il codice.
- File coinvolti: `src/components/GoogleSignInButton.js`, `src/components/AppleSignInButton.js`, `src/utils/googleSignIn.js`, `src/utils/appleSignIn.js`. Nessuno dei due pulsanti renderizza senza la propria variabile, e il divisore "oppure" compare solo se almeno uno dei due è configurato.

## Conventions
- **Pages**: PascalCase `.js` directly in `/src/` (flat, no subdirectory)
- **Components**: PascalCase `.js` in `/src/components/`
- **Exception**: `navbar.js` lowercase
- **Styling**: Tailwind utility classes; dark mode `dark:` prefix (JIT enabled)
- **Theme**: `useTheme()` from ThemeContext
- **Notifications**: `useNotifications()` from NotificationContext
- **Auth**: `useAuth()` hook; `ProtectedRoute` wraps protected routes
- **API calls**: import `BASE_URL` from config; JWT injection automatic via interceptor
- **State**: React Context global; `useState`/`useEffect` local; custom hooks for data fetch

## Common Patterns
- JWT storage: `localStorage`
- Token decode: `useAuth` decodes JWT payload → `userId`, `username`, `exp`
- Loading state: `LoadingSpinner` component; `isLoading` boolean in hooks
- API response: `{ success: true/false, data?, error?, message? }`
- **BudgetSettings `mese`**: 0-indexed (0 = January, 11 = December) — JS Date convention
- **Il conto su ogni movimento**: `Transazioni.js` carica `/api/voci` e precompila il conto (ultimo usato in `localStorage['b365.ultimaVoce']`, altrimenti il Conto principale). Le risposte di `/api/voci` e `/api/patrimonio` usano il lessico del glossario: Voce, Attività, Componente, Trasferimento, Rettifica, Fotografia. `fetchWithRetry(path, { method, headers, params, data })` accetta il corpo della richiesta.

## Testing
```bash
npm test    # React Testing Library via react-scripts
```

## Deployment
- **Platform**: Render static site `budget_app` (URL `https://budget-app-cd5o.onrender.com`)
- **Build**: `npm run build` → `/build/`
- **SPA routing**: `_redirects` → `index.html` for all routes (that file exists for Render static sites)
- **API URL**: `REACT_APP_API_URL=https://budget-app-ios-backend.onrender.com`, read at build time only — change it and rebuild
- **Not the web app**: `budget-app-keape.vercel.app` (deployment gone) and `budget-app-three-gules.vercel.app` (serves the Express API, not the React UI)
- **Admin UI**: keep `REACT_APP_ENABLE_ADMIN_ROUTES=false` or absent in production
