# Budget365 — Mobile Context (React Native)

## React Native App
**Location**: `/budget365iOS/`
**Tech Stack**: React Native 0.80.2 + React **19.1.0** (exact), TypeScript, New Architecture (Hermes + JSI)
**Entry**: `index.js` → `App.tsx`
**API Base URL**: `https://budget-app-ios-backend.onrender.com` (from `src/config.ts`)
**Note**: React Native — NOT Swift/native iOS.

## CRITICO: React Version
`react` MUST be `"19.1.0"` (exact, not `^19.1.x`). RN 0.80.x bundles `react-native-renderer@19.1.0`.
Mismatch → `TypeError: Cannot read property 'S' of undefined` white screen.

## Dependencies
- `@invertase/react-native-apple-authentication` - Apple Sign-In
- `@react-native-google-signin/google-signin` - Google Sign-In
- `@react-native-community/datetimepicker` - Date picker
- `@react-navigation/bottom-tabs` + `@react-navigation/stack` - Navigation

## Structure
```
budget365iOS/
├── src/
│   ├── screens/     # Screen components
│   ├── context/     # AuthContext, SettingsContext
│   ├── config.ts    # API config
│   └── assets/      # Images/icons
├── ios/             # Xcode project
├── android/         # Android Gradle project
└── App.tsx          # Root component
```

## Navigation (App.tsx)
- Bottom tab navigator (tabs hidden) → Home, Transactions, Budget, Stats
- Stack screens: AddTransaction, Settings, PeriodicTransactions, Savings
- Auth flow: Login, Register (when not authenticated)

## Screens (`src/screens/`)
- `HomeScreen` — Dashboard: monthly balance, income/expenses cards, Performance vs Budget chart, top categories, last 5 transactions. Quick-nav row: Transactions, Budget, Savings, Stats. Savings card shows latest month's savings and % allocated.
- `SavingsScreen` — Three tabs: **Month** (allocations, available banner), **Plan** (target % per instrument), **Portfolio** (cumulative with estimated value). Defaults to previous month. Auto-creates SavingsMonth via `ensure-month`. Fully in English.
- `TransactionsScreen` — Full list with text search, filters (type/category/date range), running total, per-row edit/delete.
- `AddTransactionScreen` — Add/edit. One-time or Recurring toggle. Native date picker (iOS modal spinner). Edit mode changes header.
- `PeriodicTransactionsScreen` — Recurring list: frequency, start date, active/paused badge. Pause/resume/delete. Pull-to-refresh.
- `BudgetScreen` — Per-category planner: Expenses/Income tabs, month/year selector, copy from previous month, add/rename/delete categories, progress bar, autosave on blur.
- `StatsScreen` — Year or Month mode, Expenses/Income toggle, monthly bar chart (tap → drill), category distribution bar, savings rate.
- `SettingsScreen` — Change password, link email, theme (light/dark/system), currency (€/$£), show/hide balance, privacy policy, bug report, delete account, logout.

## Context (`src/context/`)
- `AuthContext` — JWT token, login/logout, isAuthenticated
- `SettingsContext` — theme, currency, showBalance, isDarkMode (AsyncStorage)

## Commands
```bash
cd budget365iOS
npm start                                   # Metro bundler (port 8081)
npx react-native run-ios --scheme Debug     # iOS simulator (ALWAYS Debug, never Release)
npx react-native run-android                # Android emulator
npm test                                    # Jest
```

## Metro Startup (IMPORTANTE)
- **Non usare `npm start`** — si blocca su cli-doctor; manca `/status` endpoint
- **Usare `nohup node start-metro.js`** da `budget365iOS/` — avvia Metro via API
- **Prima di avviare**: rimuovere `.watchman-cookie-Mac-mini-*` dalla dir progetto
- **`metro.config.js` NON deve avere `useWatchman: false`** — senza watchman Metro si blocca a 0%
- Simulator: iPhone 16 Pro iOS 18.5, UUID `57ED50CB-D272-4EDA-8DB6-BEF81439B31F`
- **MAI usare iOS 26** — causa errori Xcode casuali

## CRITICO: AbortController Pattern
Ogni screen con `useFocusEffect` + fetch DEVE usare AbortController.
Senza cleanup → `EXC_BAD_ACCESS (code=1, address=0x17)` crash nel C++ JSI layer.
Applicato a: HomeScreen, TransactionsScreen, PeriodicTransactionsScreen.

## Conventions
- **Language**: TypeScript (`.tsx` / `.ts`)
- **Storage**: `@react-native-async-storage/async-storage` (non localStorage)
- **Styling**: StyleSheet inline (no Tailwind); dark mode via `isDarkMode` da SettingsContext
- **Fetch**: native `fetch()` con `Authorization: Bearer` header (no Axios)
- **Build**: `COMPILER_INDEX_STORE_ENABLE = NO` in Podfile post_install → 20-40% build più veloce

## Expo App (Simplified)
**Location**: `/BudgetAppExpo/`
**Tech Stack**: Expo ~53, React 19, React Native 0.79.5, TypeScript
```bash
cd BudgetAppExpo
npx expo start --ios     # iOS simulator
npx expo start --android # Android emulator
npx expo start --web     # Browser
```

## App Store Distribution
Bundle ID: `com.keape.budget365`, Team: `4A5H2U7Q42`
Pipeline: xcodebuild archive + export + upload. Last used: v4.4 build 104 (2026-03-26).
Sempre scheme **Debug** in sviluppo (Release embed JS bundle = 90+ sec build).
