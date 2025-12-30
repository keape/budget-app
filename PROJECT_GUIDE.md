# Budget App – Developer Reference

## 1. Panorama del progetto
- Ecosistema multi-piattaforma per la gestione personale delle finanze: Web React (cartella `src/`), backend Node/Express (`server/`), tre client React Native (`BudgetAppIOS/`, `BudgetAppExpo/`, `BudgetAppSimple/`).
- Autenticazione basata su JWT: i token sono conservati nel browser/AsyncStorage, validati lato backend e allegati alle richieste Axios/fetch tramite interceptor o hook custom.
- MongoDB gestisce utenti, movimenti (entrate/spese), impostazioni di budget e transazioni periodiche. Mongoose fornisce i modelli con validazioni di base.
- Deploy previsti: frontend su Vercel (`vercel.json`, cartella `build/`), backend su Render (`render.yaml`, `server/render.yaml`), mobile tramite Xcode/Gradle o Expo.

## 2. Layout repository
- `src/`: frontend React 18 con Tailwind, React Router, contesti globali (tema, notifiche) e viste principali (`Home`, `Transazioni`, `Budget`, `Filtri`, auth UI).
- `server/`: API REST Express modularizzate (`routes/`), modelli Mongoose (`models/`), servizi (email mock/nodemailer fallback) e script manutenzione DB (`scripts/`).
- `BudgetAppIOS/`: app React Native classica con navigazione stack + bottom tabs; usa AsyncStorage per autenticazione.
- `BudgetAppExpo/`: app Expo standalone con logica semplificata ma feature parity (login, transazioni, budget, transazioni periodiche).
- `BudgetAppSimple/`: scaffold React Native minimale utile per prototipi/test UI.
- `models/`, `backup budget-app/`: dati di esempio per budget/entrate/spese.
- Configurazioni di build/stile: `tailwind.config.js`, `postcss.config.js`, `_redirects` (Netlify), `vercel.json`.

## 3. Frontend Web (React)
- Entry point `src/index.js`: instanzia `ThemeProvider` e `App`.
- Routing (`src/App.js`): protegge la UI con `ProtectedRoute` e monta `Navbar` + pagine principali.
- Autenticazione: hook `useAuth` decodifica e verifica i token; `ProtectedRoute` reindirizza al login se assente.
- Axios config (`src/config.js`): imposta `BASE_URL`, allega header `Authorization`, forza redirect su 401/403.
- Contesti:
  - `ThemeContext`: gestisce dark/light mode salvando lo stato in `localStorage` e applicando la classe Tailwind `dark`.
  - `NotificationContext`: coda notifiche (id, timestamp, stato lettura) con helper per aggiungere, marcare, contare, pulire.
- Viste chiave:
  - `Home`: dashboard (quick actions, riepilogo entrate/spese giornaliere/settimanali/mensili, categorie top, grafico confronto budget vs effettivo via `MonthlySummaryChart`).
  - `Transazioni`: form per spese/entrate (una tantum o periodiche), gestione categorie, anteprima schedule, richieste a `/api/transazioni-periodiche`.
  - `Budget`: usa hook `useBudgetData` per aggregare movimenti mensili/annuali e `useBudgetCalculations` per calcoli e ordinamenti di grafici/tabella (componenti `BudgetHeader`, `BudgetSummary`, `BudgetChart`, `BudgetTable`).
  - `Filtri`: ricerca completa con filtri per categoria, tipo, intervallo date, descrizione, grafici Recharts (bar/pie), editing/eliminazione transazioni.
  - Sezioni auth (`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `ChangePassword`) + `AboutUs`, `EmailSetup` ecc.
- Styling: Tailwind con supporto dark mode; componenti UI riutilizzabili (`LoadingSpinner`, `NotificationBar`, `ResponsiveTable`).

## 4. Backend (Express + MongoDB)
- Server principale `server/index.js`: configura CORS (lista origin consentite), middleware JSON, header sicurezza, health-check `/api/health`, debug `/api/debug-env`, rotte API e endpoint migrazioni/debug dati budget.
- Autenticazione (`server/routes/auth.js`): registrazione con bcrypt, login con JWT (durata 24h), recupero/reset password (token random), cambio password autenticato, esporta middleware `authenticateToken`.
- Movimenti:
  - `routes/spese.js` e `routes/entrate.js`: CRUD con isolamento per utente (filter `userId`), validazione importi, totali mensili.
  - `routes/categorie.js`: restituisce liste categoria spese/entrate.
  - `routes/budgetSettings.js`: CRUD impostazioni budget per mese/anno, gestione aggregazioni annuali.
- Transazioni periodiche (`routes/transazioniPeriodiche.js`): definizione schedule, generazione automatica movimenti mancanti, anteprima date, attivazione/sospensione.
- Automazioni (`routes/automation.js`): endpoint protetto da API key statica per inserire movimenti (usato da script o integrazioni esterne), health-check dedicato.
- Modelli Mongoose (`server/models/`): `User`, `Spesa`, `Entrata`, `BudgetSettings` (Map per categorie), `TransazionePeriodica` (config calendario, log transazioni generate).
- Servizi: `services/emailService.js` crea transporter nodemailer o mock; utile per invio OTP.
- Script utilità (`server/scripts/`): migrazioni userId, fix transazioni, import Excel, riassegnazioni ecc.

## 5. Client Mobile
- **BudgetAppIOS**: navigazione tab (Home/Transactions/Budget), verifica token da AsyncStorage on launch, transizioni condizionate login/register vs app. Coordinare API con backend (stesse rotte JWT).
- **BudgetAppExpo**: implementa login via fetch, carica transazioni/budget/categorie, permette inserimento spese/entrate, filtri, gestione periodiche; utile per deploy rapido su Expo.
- **BudgetAppSimple**: template di base (schermata demo) per test rapidi.

## 6. Flusso dati e autenticazione
- Frontend salva token JWT in `localStorage`; `useAuth` gestisce decode base64 e validità (`exp`). Eventi `storage` sincronizzano logout cross-tab.
- Axios intercetta richieste/risposte, reindirizza al login e pulisce token su errori 401/403.
- Backend `authenticateToken` verifica header `Authorization: Bearer`, popola `req.user` con `userId` e `username` per filtrare dati.
- Transazioni periodiche: cron client-side (chiamata POST `/api/transazioni-periodiche/genera`) genera movimenti mancanti secondo configurazione.

## 7. Setup e workflow di sviluppo
- **Frontend root** (`package.json`):
  - `npm start` → dev server React (porta 3000).
  - `npm run build` → build produzione in `build/`.
  - `npm run serve` → serve statico build (usa `serve`).
  - `npm run server` → esegue backend (`cd server && npm start`).
- **Backend** (`server/package.json`): `npm start` avvia API (porta da `.env`), script test/migrazione manuali (`test-server.js`, `fix-db.js`, `fix-mongodb.js`).
- **React Native**: 
  - `BudgetAppIOS` → `npm start` (Metro), `npx react-native run-ios` / `run-android`.
  - `BudgetAppExpo` → `npm start` con CLI Expo.
- Testing: `npm test` lato frontend (React Testing Library configurato), script manuali backend (`test-server.js`).
- Workflow consigliato: avvio backend + frontend in due terminali per testare login/API; testare build (`npm run build && npm run serve`) prima di deploy; controllare console e reattività.

## 8. Variabili d'ambiente
- Frontend `.env`: `REACT_APP_API_URL` per override backend, default definito in `src/config.js`.
- Backend `server/.env`: `MONGODB_URI`, `JWT_SECRET`, `PORT`, eventuali `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`. Render usa `render.yaml` per configurarli.
- Mobile: aggiornare costanti `BASE_URL` in `BudgetAppExpo/App.tsx` e moduli fetch delle altre app quando l'API cambia dominio.

## 9. Linee guida per modifiche/integrazioni
- Verificare sempre che i token JWT siano gestiti correttamente: se si introducono nuove rotte protette, applicare `authenticateToken` lato backend e usare Axios/fetch con header.
- Quando si aggiungono categorie budget o nuove metriche, aggiornare sia `BudgetSettings` (Map categorie) lato backend che gli hook/calcoli frontend (`useBudgetData`, `useBudgetCalculations`).
- Per nuove automazioni, estendere `routes/automation.js` oppure creare una chiave API configurabile via `.env` anziché hard-coded.
- Per invio email reale, sostituire il mock transporter configurando credenziali valide (Gmail/SMTP) e gestire errori fallback.
- Aggiornare le app mobile con eventuali cambi nel contratto API (payload transazioni, endpoint) per evitare inconsistenze.
- Manutenere dati seed e backup in `backup budget-app/` e script di migrazione per sincronizzare ambienti.

## 10. Risoluzione problemi ricorrenti
- **Login loop**: controllare `BASE_URL` (console log in `src/config.js`), assicurarsi che `JWT_SECRET` coincida tra ambienti.
- **CORS**: aggiungere nuovo dominio alla lista `corsOptions.origin` in `server/index.js`.
- **Budget annuo errato**: revisione log in `useBudgetData` (stampe su console distinguono strategia somma vs media); garantire budget mensili completi o gestire fallback.
- **Transazioni periodiche non generate**: verificare chiamata `POST /api/transazioni-periodiche/genera` (frontend la invoca on load transazioni) e schedule `configurazione` nel documento Mongo.
- **Email non inviate**: controllare log `EmailService` per capire se è in mock/fallback.

Questo documento riassume la mappa tecnica dell'app e aiuta a identificare rapidamente dove intervenire per nuove feature, bugfix e deploy.
