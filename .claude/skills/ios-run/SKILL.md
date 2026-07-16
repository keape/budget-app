---
name: ios-run
description: Avvia l'app Budget365 nel simulatore iOS. Esegue l'intera pipeline: fix watchman → Metro → build Xcode → install + launch. Simulator: iPhone 16 Pro iOS 18.5. Nessun intervento manuale richiesto.
disable-model-invocation: true
---

Esegui la sequenza completa senza chiedere conferma. L'utente si aspetta autonomia totale.

## Step 1 — Fix watchman (SEMPRE primo)

```bash
# Rimuovi cookie stale (può non esistere, va bene)
rm -f "/Volumes/Ext.Lexar/Costola del Mac/budget365/budget365iOS/.watchman-cookie-"* 2>/dev/null; true

# Watch PARENT (non budget365iOS direttamente — causa deadlock)
watchman watch "/Volumes/Ext.Lexar/Costola del Mac/budget365"

# watch-project risolve automaticamente il parent
watchman watch-project "/Volumes/Ext.Lexar/Costola del Mac/budget365/budget365iOS"
```

Se `watch-project` restituisce `"watcher": "fsevents"` con `"watch": "/Volumes/Ext.Lexar/Costola del Mac/budget365"` → OK.

### Se watchman è bloccato da launchd (non si ferma con kill):

```bash
launchctl unload ~/Library/LaunchAgents/com.github.facebook.watchman.plist
kill -9 $(pgrep watchman)
rm -f /Users/keape/.local/state/watchman/keape-state/state \
       /Users/keape/.local/state/watchman/keape-state/sock \
       /Users/keape/.local/state/watchman/keape-state/pid
launchctl load ~/Library/LaunchAgents/com.github.facebook.watchman.plist
# poi riesegui Step 1
```

## Step 2 — Verifica metro.config.js

`metro.config.js` NON deve avere `useWatchman: false`. Config corretta:
```js
const config = {};
module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

## Step 3 — Avvia Metro

```bash
cd "/Volumes/Ext.Lexar/Costola del Mac/budget365/budget365iOS"
nohup node start-metro.js > /tmp/metro_fresh.log 2>&1 &
```

Polling readiness (attendi prima di buildare):
```bash
until curl -s http://localhost:8081/status | grep -q "packager-status:running"; do sleep 2; done
echo "Metro ready"
```

## Step 4 — Build Xcode

```bash
cd "/Volumes/Ext.Lexar/Costola del Mac/budget365/budget365iOS/ios"
xcodebuild \
  -workspace Budget365.xcworkspace \
  -scheme Budget365 \
  -configuration Debug \
  -destination 'platform=iOS Simulator,arch=arm64,id=7C710A5B-5C3C-4C83-BAF5-4AAADBF244C9' \
  -derivedDataPath /tmp/budget365-build \
  build 2>&1 | tail -20
```

## Step 5 — Install + Launch

```bash
xcrun simctl boot "7C710A5B-5C3C-4C83-BAF5-4AAADBF244C9" 2>/dev/null || true
open -a Simulator
xcrun simctl install "7C710A5B-5C3C-4C83-BAF5-4AAADBF244C9" /tmp/budget365-build/Build/Products/Debug-iphonesimulator/Budget365.app
xcrun simctl launch "7C710A5B-5C3C-4C83-BAF5-4AAADBF244C9" com.keape.budget365
```

Il primo bundle: ~2-3 min (Metro trasforma ~930 moduli). Bundle successivi: istantanei da cache.

## Valori fissi

| Parametro | Valore |
|-----------|--------|
| Simulator ID | `7C710A5B-5C3C-4C83-BAF5-4AAADBF244C9` |
| Simulator | iPhone 16, iOS 18.5 |
| Scheme | `Budget365` |
| Configuration | `Debug` (MAI Release in sviluppo) |
| Bundle ID | `com.keape.budget365` |
| App output | `/tmp/budget365-build/Build/Products/Debug-iphonesimulator/Budget365.app` |
| Workspace | `/Volumes/Ext.Lexar/Costola del Mac/budget365/budget365iOS/ios/Budget365.xcworkspace` |

## Note critiche

- **MAI iOS 26** — causa errori Xcode casuali e imprevedibili
- **MAI `npm start`** — si blocca su cli-doctor, manca endpoint `/status`
- **`useWatchman: false` è OBBLIGATORIO** su volume esterno APFS (`/Volumes/Ext.Lexar`) — senza, watchman si blocca. Non rimuovere questa config.
- **Sempre watch il parent** (`/Volumes/Ext.Lexar/Costola del Mac/budget365`) prima di `watch-project`
