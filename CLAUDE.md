# Budget App - Claude Code Context

## Project Overview
Budget App è un'applicazione multi-platform per la gestione del budget personale che include:
- **Web App React** (frontend principale)
- **Backend Node.js/Express** (API RESTful)
- **App React Native** (mobile iOS/Android)
- **Database MongoDB** con Mongoose ODM

## Architecture

### Frontend React (Web)
**Location**: `/src/`
**Tech Stack**: React 18, React Router, Tailwind CSS, Axios
**Key Features**:
- Autenticazione JWT con ProtectedRoute
- Theme system (dark/light mode) via ThemeContext
- Sistema di notifiche con NotificationContext
- Responsive design con Tailwind CSS

**Main Routes**:
- `/` - Home (dashboard principale)
- `/transazioni` - Lista transazioni
- `/budget` - Vista budget con grafici
- `/budget/settings` - Configurazione budget
- `/filtri` - Filtri e reportistica
- `/login`, `/register` - Autenticazione

**Key Components**:
- `Navbar` - Navigazione principale
- `ProtectedRoute` - Wrapper per route autenticate
- `BudgetChart`, `BudgetSummary`, `BudgetTable` - Componenti budget
- `LoadingSpinner`, `NotificationBar` - UI utilities

### Backend Node.js/Express
**Location**: `/server/`
**Tech Stack**: Express.js, MongoDB, Mongoose, JWT, bcryptjs
**Port**: Configurabile via environment

**API Routes** (`/api`):
- `/auth` - Login, register, password reset
- `/spese` - CRUD spese
- `/entrate` - CRUD entrate
- `/budget-settings` - Configurazione budget
- `/categorie` - Gestione categorie
- `/transazioni-periodiche` - Transazioni ricorrenti
- `/automation` - Automazioni e integrazioni

**Database Models**:
- `User` - Utenti con autenticazione
- `Spesa` - Transazioni in uscita
- `Entrata` - Transazioni in entrata
- `BudgetSettings` - Configurazioni budget utente
- `TransazionePeriodica` - Transazioni ricorrenti

**CORS Configuration**: Configurato per domini di produzione e sviluppo

### React Native Apps
**Locations**: 
- `/BudgetAppIOS/` - App iOS principale
- `/BudgetAppSimple/` - Versione semplificata
- `/BudgetAppExpo/` - Versione Expo

**Setup**:
- React Native con Swift per iOS
- Android support tramite Gradle
- Shared codebase con differenze platform-specific

## Development Commands

### Web App (Root)
```bash
npm start          # Avvia frontend React (porta 3000)
npm run build      # Build produzione
npm test           # Test suite
npm run server     # Avvia backend (dalla root)
npm run serve      # Serve build statico
```

## Local Development & Testing Workflow

### Development Mode (Hot Reload)
```bash
npm start
```
- Avvia React development server su http://localhost:3000
- Hot reload automatico quando modifichi files
- Ideale per sviluppo iterativo
- Console errors/warnings in tempo reale

### Production Build Testing
```bash
npm run build      # Crea build ottimizzata
npm run serve      # Serve build su porta dinamica
```
**Alternative per serve:**
```bash
npx serve -s build -l 3000     # Serve su porta specifica
cd build && python3 -m http.server 3000  # Python alternative
```

### Full-Stack Testing
**Terminal 1 - Backend:**
```bash
npm run server    # Avvia API backend
```
**Terminal 2 - Frontend:**
```bash
npm start         # Avvia React frontend
```
Questo setup è necessario per testare login, dati reali e API calls.

### Pre-Push Testing Checklist
1. **Develop**: `npm start` per sviluppo con hot reload
2. **Build Test**: `npm run build && npm run serve` per test build finale  
3. **Functionality**: Testa tutte le features modificate
4. **Console**: Verifica nessun errore JavaScript
5. **Responsive**: Testa su diverse dimensioni schermo
6. **Push**: Solo se tutto funziona perfettamente

### Testing Specific Features
- **Login/Auth**: Serve sia frontend che backend
- **Charts/Graphs**: `npm run build && npm run serve` per performance reali
- **Responsive Design**: Chrome DevTools + diverse dimensioni
- **Dark Mode**: Toggle tema e verifica tutti i componenti

### Backend (Server)
```bash
cd server
npm start          # Avvia server Node.js
npm run build      # No-op (echo message)
```

### React Native
```bash
cd BudgetAppIOS
npm start          # Metro bundler
npx react-native run-ios     # Build e avvia iOS
npx react-native run-android # Build e avvia Android
```

## Environment Variables
**Frontend** (.env):
- `REACT_APP_API_URL` - URL backend API

**Backend** (server/.env):
- `MONGODB_URI` - Connection string MongoDB
- `JWT_SECRET` - Secret per JWT tokens
- `PORT` - Porta server (default varia)

## Code Conventions

### Frontend
- **Component naming**: PascalCase per componenti React
- **File structure**: Flat per screens, organizzata per components/
- **Styling**: Tailwind CSS con classi utility, theme context per dark mode
- **State management**: React Context per global state, useState per local
- **API calls**: Axios con interceptors per JWT

### Backend
- **Route structure**: Modulare in `/routes`, controller pattern
- **Error handling**: Middleware centralizzato
- **Authentication**: JWT con middleware di verifica
- **Database**: Mongoose schemas con validation
- **CORS**: Configurazione esplicita per domini trusted

### React Native
- **Platform differences**: Gestite tramite platform-specific files
- **Navigation**: Stack navigation per iOS/Android
- **Styling**: StyleSheet con responsive design

## Deployment

### Frontend
- **Vercel**: Deploy automatico da Git
- **Build**: `npm run build` genera `/build/`
- **Static serve**: `npm run serve` per testing locale

### Backend
- **Render**: Deploy automatico con `render.yaml`
- **Environment**: Variabili configurate in dashboard Render
- **Health check**: Endpoint `/api/health`

### Mobile
- **iOS**: Xcode build con certificati Apple
- **Android**: Gradle build per APK/AAB

## Testing Strategy
- **Frontend**: React Testing Library (comando `npm test`)
- **Backend**: Testing manuale con `/test-server.js`
- **Integration**: Test end-to-end cross-platform

## Common Patterns
- **Error boundaries**: Implementati per robustezza UI
- **Loading states**: Spinner component riutilizzabile
- **Form validation**: Client-side con server-side backup
- **Responsive design**: Mobile-first con Tailwind breakpoints
- **API architecture**: RESTful con consistent response format

## Development Tips
- Use `npm run server` dalla root per avviare backend
- Frontend proxy configurato per API calls in development
- MongoDB locale o cloud per testing
- iOS simulator richiede Xcode su macOS
- Android emulator via Android Studio