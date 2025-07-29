# Budget App iOS

Versione iOS nativa dell'applicazione Budget App creata con React Native.

## Struttura App

L'app è composta da 5 schermate principali:

### 1. LoginScreen (`src/screens/LoginScreen.tsx`)
- Login utente con username e password
- Validazione credenziali tramite API backend
- Memorizzazione token di autenticazione con AsyncStorage
- Link per navigare alla registrazione

### 2. RegisterScreen (`src/screens/RegisterScreen.tsx`)  
- Registrazione nuovo utente
- Validazione password e conferma password
- Comunicazione con API backend per creazione account
- Navigazione automatica al login dopo registrazione

### 3. HomeScreen (`src/screens/HomeScreen.tsx`)
- Schermata principale per inserimento transazioni
- Selettore modalità: Una tantum / Periodica
- Selettore tipo: Spesa / Entrata
- Input importo, categoria e descrizione
- Caricamento dinamico categorie dal backend
- Inserimento transazioni tramite API

### 4. TransactionsScreen (`src/screens/TransactionsScreen.tsx`)
- Visualizzazione lista transazioni
- Caricamento transazioni (spese + entrate) dal backend
- Ordinamento per data (più recenti per prime)
- Funzionalità eliminazione transazioni con conferma
- Refresh manuale dati
- Interfaccia ottimizzata per mobile

### 5. BudgetScreen (`src/screens/BudgetScreen.tsx`)
- Visualizzazione budget mensile/annuale
- Riepilogo totali: entrate, uscite, bilancio
- Dettaglio per categoria con raggruppamento
- Selettore periodo (mensile/annuale)
- Calcoli automatici bilancio

## Navigazione

- **Stack Navigator**: Gestisce flusso autenticazione (Login/Register)
- **Tab Navigator**: Navigazione principale con 3 tab
  - 💰 Inserisci transazione (HomeScreen)
  - 📊 Transazioni (TransactionsScreen)  
  - 📈 Budget (BudgetScreen)

## Backend Integration

Tutte le schermate si collegano al backend esistente:
- **Base URL**: `https://budget-app-cd5o.onrender.com`
- **Autenticazione**: Bearer token tramite AsyncStorage
- **API Endpoints**: 
  - `/api/auth/login` - Login utente
  - `/api/auth/register` - Registrazione
  - `/api/spese` - Gestione spese
  - `/api/entrate` - Gestione entrate  
  - `/api/categorie` - Caricamento categorie

## Setup e Installazione

### Prerequisiti
- Node.js (versione 18+)
- React Native CLI
- Xcode (per iOS)
- CocoaPods

### Installazione

1. **Installa dipendenze**:
   ```bash
   npm install
   ```

2. **Installa pod iOS** (solo per iOS):
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Avvia Metro Bundler**:
   ```bash
   npx react-native start
   ```

4. **Avvia app iOS**:
   ```bash
   npx react-native run-ios
   ```

### Dipendenze Principali

- `@react-navigation/native` - Navigazione
- `@react-navigation/stack` - Stack navigation
- `@react-navigation/bottom-tabs` - Tab navigation
- `@react-native-async-storage/async-storage` - Storage locale
- `react-native-screens` - Ottimizzazione performance
- `react-native-safe-area-context` - Gestione safe area

## Funzionalità iOS Native

- **AsyncStorage**: Memorizzazione persistente token autenticazione
- **KeyboardAvoidingView**: Gestione tastiera ottimizzata iOS
- **Safe Area**: Rispetto notch e safe area iPhone
- **Activity Indicators**: Loading states nativi iOS
- **Alerts**: Dialog nativi iOS per conferme e errori
- **Tab Bar**: Navigazione bottom tab nativa iOS
- **TouchableOpacity**: Interazioni touch ottimizzate

## Styling

L'app utilizza `StyleSheet` di React Native con:
- Colori consistenti con web app (blu primario #4F46E5)
- Typography responsive
- Shadows e elevazioni native
- Border radius e spacing uniformi
- Separazione colori entrate (verde) / uscite (rosso)

## Note per lo Sviluppo

- Tutte le API calls sono gestite con `fetch()`
- Error handling con `Alert.alert()` nativo
- State management con `useState` e `useEffect`
- Loading states per tutte le operazioni async
- Validazione input locale prima delle API calls
- Logout automatico se token non valido