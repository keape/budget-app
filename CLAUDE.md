# Budget365 - Claude Code Context

## Project Overview
Budget App is a multi-platform personal budget management application consisting of:
- **Web App React** (main frontend, `/src/`)
- **Backend Node.js/Express** (RESTful API, `/server/`)
- **React Native App** (`/budget365iOS/`) - full-featured iOS/Android app with TypeScript
- **Expo App** (`/BudgetAppExpo/`) - simplified Expo-based version
- **Database MongoDB** with Mongoose ODM

## Repository Structure

```
/
├── src/                    # React web frontend
├── server/                 # Node.js/Express backend
├── budget365iOS/           # React Native app (iOS + Android, TypeScript)
├── BudgetAppExpo/          # Expo app (simplified)
├── public/                 # Static assets for web
├── build/                  # Production build output (React)
├── package.json            # Frontend dependencies + npm scripts
├── tailwind.config.js      # Tailwind CSS config
├── vercel.json             # Vercel routing (routes /api/* to server/index.js)
├── render.yaml             # Render deployment config (backend)
├── _redirects              # SPA redirect rule for static hosts
├── .env                    # Local env vars (frontend + backend)
└── .env.production         # Production env override
```

## Architecture

### Frontend React (Web)
**Location**: `/src/`
**Tech Stack**: React 18, React Router v6, Tailwind CSS, Axios, Recharts
**Port**: 3000 (development)

**Pages** (flat structure in `/src/`):
- `App.js` - Root component, defines all routes
- `Home.js` - Dashboard (main view)
- `Transazioni.js` - Transaction list
- `Budget.js` - Budget view with charts
- `BudgetSettings.js` - Budget configuration
- `Filtri.js` - Filters and reporting
- `Login.js`, `Register.js` - Authentication
- `ForgotPassword.js`, `ResetPassword.js`, `ChangePassword.js` - Password management
- `AboutUs.js` - About page
- `Home_backup.js`, `Home_new.js` - Legacy backup files (not used by App.js)

**Route Map**:
- `/` - Home dashboard (protected)
- `/transazioni` - Transaction list (protected)
- `/budget` - Budget view (protected)
- `/budget/settings` - Budget settings (protected)
- `/filtri` - Filters/reports (protected)
- `/change-password`, `/about-us` - Protected pages
- `/login`, `/register` - Auth (public)
- `/forgot-password`, `/reset-password` - Password reset (public)
- `*` - Redirects to `/`

**Components** (`/src/components/`):
- `BudgetChart.js` - Recharts-based budget chart
- `BudgetHeader.js` - Budget page header
- `BudgetSummary.js` - Budget summary card
- `BudgetTable.js` - Budget data table
- `LoadingSpinner.js` - Reusable loading indicator
- `MonthlySummaryChart.js` - Monthly summary chart
- `NotificationBar.js` - In-app notification display
- `OTPVerification.js` - OTP input component
- `ResponsiveTable.js` - Mobile-friendly table

**Contexts** (`/src/contexts/`):
- `NotificationContext.js` - Global notification state; provides `addNotification`, `removeNotification`, `markAsRead`, `clearAll`, `addMultipleNotifications`, `getUnreadCount`, `getTodayNotifications`

**Hooks** (`/src/hooks/`):
- `useAuth.js` - JWT token decode/expiry check, `isAuthenticated`, `logout`, `getToken`
- `useBudgetData.js` - Fetches spese/entrate/budgetSettings from API for a given month/year
- `useBudgetCalculations.js` - Derives budget vs actual data, chart data, sorting logic

**Key Files**:
- `ThemeContext.js` - Dark/light mode; persists to `localStorage`, applies `dark` class to `<html>`; exposes `useTheme()` → `{ darkMode, toggleDarkMode }`
- `ProtectedRoute.js` - Route guard using `useAuth` hook
- `navbar.js` - Navigation bar (note: lowercase filename)
- `config.js` - Axios base URL + request/response interceptors (auto-injects JWT, redirects on 401/403)

**API Base URL** (`/src/config.js`):
```js
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://budget-app-three-gules.vercel.app'   // Vercel backend
  : 'http://localhost:5001';                        // Local dev
```
Import as: `import BASE_URL from '../config';`

### Backend Node.js/Express
**Location**: `/server/`
**Tech Stack**: Express 4, MongoDB, Mongoose 7, JWT (jsonwebtoken 9), bcryptjs, nodemailer
**Port**: 5001 (default; override with `PORT` env var)
**Entry point**: `server/index.js`

**API Routes** (all prefixed `/api`):
- `GET /api/health` - Server + DB status
- `POST /api/auth/register` - New user registration
- `POST /api/auth/login` - Login, returns JWT
- `POST /api/auth/send-otp` - Send OTP email
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/forgot-password` - Trigger password reset email
- `POST /api/auth/change-password` - Change password (auth required)
- `POST /api/auth/update-email` - Update email (auth required)
- `DELETE /api/auth/delete-account` - Delete account (auth required)
- `/api/spese` - CRUD for expenses
- `/api/entrate` - CRUD for income
- `/api/budget-settings` - Budget config CRUD
- `/api/categorie` - Category management
- `/api/transazioni-periodiche` - Recurring transactions CRUD
- `/api/automation` - Automation/integrations (Google Sheets webhook)

**Authentication Middleware**:
```js
const { authenticateToken } = require('./routes/auth');
// Validates Authorization: Bearer <token> header
// Sets req.user = { userId, username }
```

**Utility/Debug Endpoints** (operational, do not remove):
- `GET /api/debug-env` - Confirms env vars are set (no values exposed)
- `POST/GET /api/migrate-budget-data` - Migrates budget data between collections
- `ALL /api/debug-budget-data` - Views budget collection content
- `ALL /api/emergency-remove-index` - Drops BudgetSettings unique index
- `POST /api/fix-transactions` - Normalizes importo signs (auth required)
- `POST /api/test-auth` - Verifies auth middleware (auth required)

**CORS Allowed Origins**: `localhost:3000`, `budget-app-keape.vercel.app`, `budget-app-three-gules.vercel.app`, `budget-app-ao5r.onrender.com`, `budget-app-cd5o.onrender.com`, `budget-app-backend.onrender.com`, and an IDX cloud workstation URL.

**Database Models** (`/server/models/`):
| Model | Key Fields |
|-------|-----------|
| `User` | username (unique), password (bcrypt hash), email, googleId, appleId, resetPasswordToken/Expires |
| `Spesa` | userId (ref User), descrizione, importo (**negative**), categoria, data; index `{userId, data}` |
| `Entrata` | userId (ref User), descrizione, importo (**positive**), categoria, data; index `{userId, data}` |
| `BudgetSettings` | userId, anno, mese (0–11 JS convention), spese (Map<category,amount>), entrate (Map<category,amount>) |
| `TransazionePeriodica` | userId, importo, categoria, descrizione, tipo_ripetizione (8 types), configurazione, data_inizio, data_fine, attiva, transazioni_generate |
| `Otp` | OTP code storage for email verification |

**importo convention**: `Spesa.importo` is always **negative**; `Entrata.importo` is always **positive**.

**Services** (`/server/services/`):
- `emailService.js` - Singleton. Sends OTP/password-reset emails via nodemailer. Falls back to mock console logger when `EMAIL_USER`/`EMAIL_PASS` are absent.

### React Native App (iOS + Android)
**Location**: `/budget365iOS/`
**Tech Stack**: React Native 0.80.2 + React **19.1.0** (exact), TypeScript, New Architecture (Hermes + JSI)
**Entry**: `index.js` → `App.tsx`
**API Base URL**: `https://budget-app-ios-backend.onrender.com` (from `src/config.ts`)
**Note**: This is React Native — NOT Swift/native iOS.

**Notable dependencies**:
- `@invertase/react-native-apple-authentication` - Apple Sign-In
- `@react-native-google-signin/google-signin` - Google Sign-In
- `@react-native-community/datetimepicker` - Date picker
- `@react-navigation/bottom-tabs` + `@react-navigation/stack` - Navigation

**Structure**:
```
budget365iOS/
├── src/
│   ├── screens/     # Screen components
│   ├── context/     # React context providers (AuthContext, SettingsContext)
│   ├── config.ts    # API config
│   └── assets/      # Images/icons
├── ios/             # Xcode project
├── android/         # Android Gradle project
└── App.tsx          # Root component
```

**Navigation** (`App.tsx`):
- Bottom tab navigator (tabs hidden) → Home, Transactions, Budget, Stats
- Stack screens: AddTransaction, Settings, PeriodicTransactions
- Auth flow: Login, Register (when not authenticated)

**Screens** (`src/screens/`):
- `HomeScreen` — Dashboard: monthly balance, income/expenses cards, Performance vs Budget chart (bar), top categories, last 5 transactions. Quick-action buttons "Add Expense" / "Add Income".
- `TransactionsScreen` — Full transaction list with text search, filters (type/category/date range), running total of filtered results, per-row edit and delete.
- `AddTransactionScreen` — Add/edit transaction. One-time or Recurring mode toggle. Native date picker (iOS modal spinner, Android default). Edit mode changes header to "Edit Transaction".
- `PeriodicTransactionsScreen` — Recurring transactions list: frequency, start date, active/paused badge. Pause/resume and delete buttons. Pull-to-refresh.
- `BudgetScreen` — Budget planner per category: Expenses / Income (Goals) tabs, month/year selector, copy values from previous month, add/rename/delete categories, progress bar per category, autosave on blur.
- `StatsScreen` — Statistics: Year or Month mode, Expenses/Income toggle, monthly trend bar chart (tap bar → drill into month), category distribution proportion bar, per-category breakdown with progress bars and savings rate.
- `SettingsScreen` — Settings: change password, link email, app customization (theme light/dark/system, currency €/$£, show/hide balance), about + Privacy Policy, bug report (mailto), delete account, logout.

**Context** (`src/context/`):
- `AuthContext` — JWT token, login/logout, isAuthenticated
- `SettingsContext` — theme, currency, showBalance, isDarkMode (persisted with AsyncStorage)

**Commands**:
```bash
cd budget365iOS
npm start                                          # Metro bundler (port 8081)
npx react-native run-ios --scheme Debug            # iOS simulator (always use Debug)
npx react-native run-android                       # Android emulator
npm test                                           # Jest tests
```

### Expo App (Simplified)
**Location**: `/BudgetAppExpo/`
**Tech Stack**: Expo ~53, React 19, React Native 0.79.5, TypeScript
**Entry**: `index.ts` → `App.tsx`

**Commands**:
```bash
cd BudgetAppExpo
npx expo start           # Expo dev server
npx expo start --ios     # iOS simulator
npx expo start --android # Android emulator
npx expo start --web     # Browser
```

## Development Commands

### Web Frontend (run from project root)
```bash
npm start          # React dev server on port 3000 (hot reload)
npm run build      # Production build (also runs `cd server && npm install`)
npm test           # React Testing Library tests
npm run serve      # Serve static build (uses $PORT env var)
npm run server     # Start backend (runs `cd server && npm start`)
```

### Backend (from project root or /server)
```bash
npm run server          # From root
cd server && npm start  # Direct (node index.js)
```

### Production Build Testing
```bash
npm run build
npx serve -s build -l 3000           # Serve on fixed port
# Alternative:
cd build && python3 -m http.server 3000
```

## Local Development & Testing Workflow

### Full-Stack Development
```bash
# Terminal 1 - Backend (port 5001)
npm run server

# Terminal 2 - Frontend (port 3000)
npm start
```
The React dev server proxies API calls; `config.js` points to `localhost:5001` in development.

### Pre-Push Checklist
1. `npm start` - Develop with hot reload, fix any runtime errors
2. `npm run build && npx serve -s build -l 3000` - Test production build
3. Test all modified features end-to-end
4. Check browser console for JavaScript errors
5. Test responsive layouts (mobile + desktop breakpoints)
6. Toggle dark mode and verify all pages render correctly

### Testing Specific Features
- **Auth/Login**: Requires both frontend + backend running
- **Charts**: Best tested with production build for accurate rendering
- **Dark Mode**: Toggle in UI, verify every page
- **Recurring Transactions**: Requires backend + MongoDB

---

## Environment Variables

**Root `.env`** (used by both CRA dev server and backend via `dotenv`):
- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - JWT signing secret
- `REACT_APP_BASE_URL` - Backend URL (available to React as `process.env.REACT_APP_BASE_URL`)
- `WEBHOOK_TOKEN` - Google Sheets webhook auth token
- `GOOGLE_SHEET_ID` - Spreadsheet ID for automation
- `GOOGLE_SHEET_NAME` - Sheet tab name

**Backend-specific** (also read from root `.env` when starting via `npm run server`):
- `PORT` - Server port (default: 5001)
- `EMAIL_SERVICE` - Email provider (e.g., `gmail`)
- `EMAIL_USER` - Sender email address
- `EMAIL_PASS` - Email password/app password
- `EMAIL_FROM` - From address (defaults to `EMAIL_USER`)

**Note**: `src/config.js` uses hardcoded URLs based on `NODE_ENV`, not `REACT_APP_BASE_URL` directly.

## Deployment

### Frontend
- **Platform**: Vercel (auto-deploy from Git)
- **Build command**: `npm run build` → outputs to `/build/`
- **SPA routing**: `_redirects` ensures client-side routes return `index.html`

### Backend
- **Platform**: Render (`server/render.yaml` config, rootDir: `./server`)
- **Start**: `node index.js`
- **Health check path**: `/api/health`
- **Alternative**: `vercel.json` routes `/api/*` to `server/index.js` for Vercel-hosted backend

### Mobile
- **iOS**: Requires macOS + Xcode + Apple Developer certificates; always use **Debug** scheme in development (Release embeds JS bundle, takes 90+ sec to build)
- **Android**: Android Studio + Gradle

## Code Conventions

### Frontend (Web)
- **Pages**: PascalCase `.js` files directly in `/src/` (flat, no subdirectory)
- **Components**: PascalCase `.js` files in `/src/components/`
- **Exception**: `navbar.js` uses lowercase - import accordingly
- **Styling**: Tailwind CSS utility classes; dark mode with `dark:` prefix (JIT mode enabled)
- **Theme**: `useTheme()` from `ThemeContext` → `{ darkMode, toggleDarkMode }`
- **Notifications**: `useNotifications()` from `NotificationContext`
- **Auth**: `useAuth()` hook for token state; `ProtectedRoute` wraps protected routes in `App.js`
- **API calls**: Import `BASE_URL` from `../config` (or `./config`); token injection is automatic via interceptor
- **State**: React Context for global state; `useState`/`useEffect` for local state; custom hooks for data fetching

### Backend
- **Routes**: One file per resource in `/server/routes/`, each exports a router
- **Auth export**: `module.exports = { router, authenticateToken }` from `routes/auth.js`
- **User scoping**: All queries filter by `req.user.userId` from JWT
- **Error handling**: Centralized Express error middleware at bottom of `server/index.js`
- **Response format**: Always JSON `{ success: boolean, data?, error?, message? }`
- **Security headers**: Set globally (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`)

### React Native (`budget365iOS`)
- **Language**: TypeScript (`.tsx` / `.ts`)
- **Navigation**: React Navigation (stack + bottom tabs)
- **Storage**: `@react-native-async-storage/async-storage` instead of localStorage
- **Styling**: StyleSheet inline (no Tailwind); dark mode via `isDarkMode` from SettingsContext
- **Fetch**: native `fetch()` with `Authorization: Bearer` header (no Axios)
- **AbortController**: required in every `useFocusEffect` data-fetching screen to prevent `EXC_BAD_ACCESS` crash in the C++ JSI layer (React Native New Architecture). See pattern in HomeScreen, TransactionsScreen, PeriodicTransactionsScreen.
- **React version**: must be exactly `19.1.0` — RN 0.80.x bundles `react-native-renderer@19.1.0`; any mismatch causes white screen (`TypeError: Cannot read property 'S' of undefined`)

## Common Patterns
- **JWT storage**: `localStorage` (web) / AsyncStorage (mobile)
- **Token decode**: `useAuth` decodes JWT payload client-side to read `userId`, `username`, `exp`
- **Loading state**: `LoadingSpinner` component; `isLoading` boolean in data-fetching hooks
- **API response**: `{ success: true/false, data?, error?, message? }`
- **BudgetSettings month**: `mese` field is **0-indexed** (0 = January, 11 = December) matching JS Date convention

## Testing Strategy
- **Frontend**: `npm test` (React Testing Library via react-scripts)
- **Backend utilities**: `server/test-server.js` (manual), `server/test-email.js`, `server/test-production.js`
- **Mobile**: Jest configured in `budget365iOS/jest.config.js`

## Known Notes
- `BudgetSettings` model has **no unique index** (intentionally removed to avoid 409 conflict errors)
- MongoDB URI is stripped of surrounding quotes at startup to handle Render env var quoting quirks
- Backend starts successfully even without a MongoDB connection (graceful degradation; auth + health work)
- Debug/migration endpoints in `server/index.js` are operational utilities - do not remove without understanding their purpose
- `src/config.js` contains `console.log` debug statements - expected in development
- `budget365iOS/` is **React Native** (not Swift) — full-featured native app, separate from the Expo version
- `Home_backup.js` and `Home_new.js` in `/src/` are legacy backups — not imported by `App.js`
- `render.yaml` contains credentials in plaintext — do not modify carelessly
- Root `package.json` has a `postinstall` script that runs `cd server && npm install` automatically
