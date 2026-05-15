# Guida all'integrazione del widget Budget365

## Panoramica

Sono stati creati:

| File | Ruolo |
|------|-------|
| `server/routes/widget.js` | Endpoint `GET /api/widget/riepilogo` (backend) |
| `ios/Budget365/TokenSyncModule.m` | NativeModule ObjC per condividere token con widget |
| `ios/Budget365/Budget365.entitlements` | App Group aggiunto (`group.com.budget365.sharing`) |
| `ios/Budget365Widget/Budget365Widget.swift` | Entry point widget WidgetKit |
| `ios/Budget365Widget/Budget365WidgetProvider.swift` | TimelineProvider (fetch dati ogni 30 min) |
| `ios/Budget365Widget/Budget365WidgetView.swift` | UI SwiftUI del widget medium |
| `ios/Budget365Widget/Info.plist` | Config widget extension |
| `ios/Budget365Widget/Budget365Widget.entitlements` | App Group per widget extension |
| `src/utils/tokenSync.ts` | Wrapper TypeScript per chiamare il NativeModule |
| `src/context/AuthContext.tsx` | Modificato: sync token su login/logout |

---

## Step 1: Deploy backend (Render)

L'endpoint `GET /api/widget/riepilogo` va in produzione:
1. `git commit` e `git push` del `server/` su Render
2. Verifica: `curl https://budget-app-ios-backend.onrender.com/api/widget/riepilogo` (deve tornare 401 senza token)

---

## Step 2: Xcode — Aggiungere Widget Extension

### 2.1 Creare il target

1. Apri `Budget365.xcworkspace` in Xcode
2. **File → New → Target**
3. Scegli **Widget Extension** (iOS tab)
4. Compila:
   - **Product Name**: `Budget365Widget`
   - **Bundle Identifier**: `com.yourname.Budget365.Budget365Widget`
     *(usa lo stesso prefix dell'app principale)*
   - **Language**: Swift
   - **Include Configuration Intent**: NO (non serve)
5. Deseleziona "Include Live Activity"
6. **Finish**

### 2.2 Sostituire i file del widget

Xcode crea automaticamente 2 file boilerplate. **Cancellali** e trascina i file già creati:

1. Elimina `Budget365Widget.swift` e `Budget365WidgetControl.swift` e `Budget365WidgetLiveActivity.swift` creati da Xcode
2. Trascina nel nuovo target i file da `ios/Budget365Widget/`:
   - `Budget365Widget.swift`
   - `Budget365WidgetProvider.swift`
   - `Budget365WidgetView.swift`
   - `Info.plist`
3. Spunta **"Add to target: Budget365Widget"**
4. Assicurati che **non** siano spuntati per il target `Budget365` (solo `Budget365Widget`)

### 2.3 App Group — Configurare capabilities

**Per il target Budget365 (app principale):**
1. Seleziona il target **Budget365** → **Signing & Capabilities**
2. **+ Capability** → **App Groups**
3. Spunta `group.com.budget365.sharing` (o aggiungilo se non compare)
4. In **Signing & Capabilities**, verifica che **App Groups** sia attivo

**Per il target Budget365Widget:**
1. Seleziona il target **Budget365Widget** → **Signing & Capabilities**
2. **+ Capability** → **App Groups**
3. Spunta lo stesso `group.com.budget365.sharing`

### 2.4 Aggiungere TokenSyncModule.m al target

1. Seleziona `ios/Budget365/TokenSyncModule.m`
2. Nel **File Inspector** → **Target Membership**
3. Spunta solo **Budget365** (non il widget)

---

## Step 3: Aggiungere URL scheme per aprire l'app

Il widget apre l'app quando viene toccato (via `budget365://transazioni`).

### 3.1 Registrare URL scheme in Info.plist

Aggiungi a `ios/Budget365/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.budget365</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>budget365</string>
            <!-- mantieni anche lo schema Google esistente -->
            <string>com.googleusercontent.apps.717541750569-brfd9c3iig0l09id6bs6l2i99t8r082c</string>
        </array>
    </dict>
</array>
```

### 3.2 Gestire l'URL nell'app React Native

Aggiungi un listener deep link in `App.tsx`:

```typescript
import { Linking } from 'react-native';

useEffect(() => {
  const handler = (url: string | null) => {
    if (!url) return;
    if (url.startsWith('budget365://transazioni')) {
      // Naviga allo screen transazioni
    }
  };

  Linking.addEventListener('url', ({ url }) => handler(url));
  Linking.getInitialURL().then(handler);
  return () => Linking.removeAllListeners('url');
}, []);
```

---

## Step 4: Build e test

### 4.1 Build

1. **Product → Clean Build Folder** (⌘⇧K)
2. **Product → Build** (⌘B) — deve compilare senza errori

### 4.2 Eseguire su simulatore/device

1. **Product → Run** (⌘R)
2. Dopo che l'app parte, minimizzala (⌘H o swipe up)
3. Scorri a destra sulla home screen fino a **"Oggi" / Today View**
4. Scorri in fondo e tocca **Modifica**
5. Cerca **Budget365** nella lista widget
6. Tocca **+** per aggiungerlo
7. Una volta aggiunto, compila il login nell'app → il widget dovrebbe aggiornarsi entro 30 minuti

### 4.3 Forzare refresh immediato (debug)

Per test immediato, puoi toccare il widget mentre sei in modalità debug — WidgetKit fa refresh forzato. Oppure lancia l'app dopo aver fatto login (il token sync parte subito).

---

## Struttura finale

```
budget365iOS/ios/
├── Budget365/
│   ├── AppDelegate.swift
│   ├── Budget365.entitlements      ← App Group aggiunto
│   ├── Info.plist                   ← URL scheme budget365://
│   └── TokenSyncModule.m           ← NUOVO: bridge per token sharing
│
├── Budget365Widget/                ← NUOVA: widget extension
│   ├── Budget365Widget.swift
│   ├── Budget365WidgetProvider.swift
│   ├── Budget365WidgetView.swift
│   ├── Info.plist
│   └── Budget365Widget.entitlements ← App Group per widget
│
├── Budget365.xcodeproj
├── Budget365.xcworkspace
├── Podfile
└── Pods/
```

---

## Risoluzione problemi

**Errore "App Group non configurato" all'avvio:**
→ Verifica nelle capabilities di entrambi i target che `group.com.budget365.sharing` sia spuntato.

**Widget mostra "Accedi per vedere il riepilogo":**
→ Il token non è ancora stato sincronizzato. Apri l'app, fai login/logout.

**Widget mostra "Connessione..." persistente:**
→ Il backend Render è in cold start (free tier). Aspetta 15-30 secondi e riprova.

**Errore di build "No such module 'WidgetKit'":**
→ Il deployment target del widget deve essere iOS 15.1+ (come l'app principale). Vai in target Budget365Widget → General → Minimum Deployments.
