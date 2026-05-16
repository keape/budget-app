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
- `ProtectedRoute.js` — route guard using `useAuth`
- `navbar.js` — navigation bar (**lowercase filename** — import accordingly)
- `config.js` — Axios base URL + interceptors (auto-inject JWT, redirect on 401/403)

## API Base URL (`/src/config.js`)
```js
const BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://budget-app-backend.onrender.com'
    : 'http://localhost:5001');
```
Import: `import BASE_URL from '../config';`
Vercel should set `REACT_APP_API_URL=https://budget-app-backend.onrender.com`.
Emergency admin UI in `BudgetSettings.js` is hidden unless `REACT_APP_ENABLE_ADMIN_ROUTES=true`.

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

## Testing
```bash
npm test    # React Testing Library via react-scripts
```

## Deployment
- **Platform**: Vercel (auto-deploy from Git)
- **Build**: `npm run build` → `/build/`
- **SPA routing**: `_redirects` → `index.html` for all routes
- **Required Vercel env**: `REACT_APP_API_URL`
- **Admin UI**: keep `REACT_APP_ENABLE_ADMIN_ROUTES=false` or absent in production
