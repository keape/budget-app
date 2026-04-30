# Budget365

App per la gestione del budget personale multi-piattaforma: web, iOS e Android.

## Stack

- **Frontend Web** — React 18, Tailwind CSS, Recharts, React Router v6
- **Backend** — Node.js / Express 4, MongoDB (Mongoose 7)
- **Mobile** — React Native (iOS/Android) + Expo (versione semplificata)
- **Deploy** — Vercel (frontend web), Render (backend API)

## Struttura

```
├── src/                    # Frontend React web
├── server/                 # Backend API Express
│   ├── models/             # Modelli Mongoose
│   ├── routes/             # Route handlers
│   └── services/           # Servizi (email, ecc.)
├── budget365iOS/           # App React Native
├── BudgetAppExpo/          # App Expo (semplificata)
├── public/                 # Asset statici web
└── render.yaml             # Config deploy Render
```

## API Endpoints

| Endpoint | Metodo | Auth | Descrizione |
|----------|--------|------|-------------|
| `/api/health` | GET | — | Stato server + DB |
| `/api/auth/register` | POST | — | Registrazione |
| `/api/auth/login` | POST | — | Login |
| `/api/auth/send-otp` | POST | — | Invia OTP |
| `/api/auth/forgot-password` | POST | — | Reset password |
| `/api/auth/reset-password` | POST | — | Reimposta password |
| `/api/spese` | GET/POST | ✓ | Spese (CRUD) |
| `/api/entrate` | GET/POST | ✓ | Entrate (CRUD) |
| `/api/budget-settings` | GET/POST | ✓ | Config budget |
| `/api/categorie` | GET | ✓ | Categorie |
| `/api/savings/*` | GET/POST | ✓ | Risparmi e investimenti |
| `/api/instruments/*` | GET | ✓ | Ricerca strumenti finanziari |

## Setup Locale

```bash
# 1. Clona
git clone https://github.com/keape/budget-app.git
cd budget-app

# 2. Installa dipendenze backend
cd server && npm install && cd ..

# 3. Installa dipendenze frontend
npm install

# 4. Crea .env (usa .env.example come riferimento)
cp .env.example .env

# 5. Avvia backend (porta 5001)
cd server && npm start &

# 6. Avvia frontend (porta 3000)
npm start
```

## Deploy

- **Frontend**: su Vercel (`vercel --prod`)
- **Backend**: su Render (tramite `render.yaml`)

Configura le seguenti variabili d'ambiente su Render/Vercel:

| Variabile | Descrizione |
|-----------|-------------|
| `MONGODB_URI` | URI di connessione MongoDB Atlas |
| `JWT_SECRET` | Chave segreta per firma token JWT |
| `EMAIL_USER` | Email per invio notifiche |
| `EMAIL_PASS` | Password app-specifica per EMAIL_USER |
| `FRONTEND_URL` | URL del frontend (per link reset password) |

## Licenza

Uso personale.
