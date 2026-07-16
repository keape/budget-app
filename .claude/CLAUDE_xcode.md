# Xcode iOS App Store Upload — Bug Log e Approccio Corretto

Documento generato dopo 10 ore di debug per caricare Budget365 v4.6 build 106 su App Store Connect (17 maggio 2026). Xcode 26.5 beta (Build 17F42) su macOS 26.3.1.

---

## Bug di Xcode 26.5 Beta da cui STARE LONTANO

### Bug 1: xcarchive senza ApplicationProperties
**Sintomo**: Xcode Organizer mostra l'archivio come "Generic Xcode Archive". `xcodebuild -exportArchive` restituisce:
```
exportArchive exportOptionsPlist error for key "method" expected one {} but found app-store-connect
```
**Causa**: Xcode 26.5 beta non scrive la sezione `ApplicationProperties` nell'`Info.plist` dell'xcarchive.

**Fix**: Iniettare `ApplicationProperties` manualmente dopo l'archivio:
```python
import plistlib, subprocess
path = "/path/to/Archive.xcarchive/Info.plist"
with open(path, "rb") as f:
    p = plistlib.load(f)
p["ApplicationProperties"] = {
    "ApplicationPath": "Applications/Budget365.app",
    "Architectures": ["arm64"],
    "CFBundleIdentifier": "com.keape.budget365",
    "CFBundleShortVersionString": "4.6",
    "CFBundleVersion": "106",
    "SigningIdentity": "Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)",
    "Team": "4A5H2U7Q42",
}
with open(path, "wb") as f:
    plistlib.dump(p, f)
```

---

### Bug 2: `IDEDistributionPackagingStep` che si blocca per sempre
**Sintomo**: `xcodebuild -exportArchive` si blocca indefinitamente dopo `IDEDistributionSigningAssetsStep`. Nessun output per ore. `lsof` mostra codesign con `.cstemp` aperto, nessuna connessione di rete.

**Causa reale**: La chiave privata "Apple Distribution" nel keychain ha la partition list senza `apple:`. Senza `apple:`, `securityd` blocca le richieste di firma da `/usr/bin/codesign` indefinitamente (invia un mach_msg a `securityd` che non risponde mai).

**Diagnosi**: Confronta il comportamento:
```bash
# Development (funziona in <0.1s)
time codesign --force --sign "Apple Development: ..." --timestamp=none /tmp/test_file

# Distribution (blocca per sempre)
time codesign --force --sign "Apple Distribution: ..." --timestamp=none /tmp/test_file
```

**Dump keychain per verificare**: La Distribution deve avere `apple:` nella partition_id:
```
entry 3:
    authorizations (1): partition_id
    description: teamid:4A5H2U7Q42, apple:   ← deve esserci "apple:"
```

**Fix**: Eseguire UNA SOLA VOLTA con password di login macOS:
```bash
security set-key-partition-list \
  -S apple:,teamid:4A5H2U7Q42 \
  -s -k PASSWORD_MACOS \
  -D "Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)" \
  ~/Library/Keychains/login.keychain-db
```
Dopo questo comando, `codesign` con Distribution cert funziona in <0.1s.

**Nota**: Questo fix persiste nel keychain. Non serve rifarlo a ogni sessione. Se il problema si ripresenta (es. dopo reimportazione del certificato), rieseguire il comando.

---

### Bug 3: Widget (.appex) al livello sbagliato nell'IPA
**Sintomo**: Upload ad App Store Connect fallisce con errore 90017:
```
This bundle is invalid. The IPA format requires a top-level directory named Payload,
containing only a .app bundle and optional plugins in a Plugins directory.
```
**Causa**: `xcodebuild -exportArchive` con Xcode 26.5 beta mette `Budget365Widget.appex` direttamente in `Payload/` invece che in `Payload/Budget365.app/PlugIns/`.

**Struttura sbagliata prodotta da xcodebuild**:
```
Payload/
  Budget365.app/
  Budget365Widget.appex/    ← SBAGLIATO
```

**Struttura corretta**:
```
Payload/
  Budget365.app/
    PlugIns/
      Budget365Widget.appex/   ← GIUSTO
```

---

### Bug 4: `Symbols/` directory nell'IPA
**Sintomo**: Upload fallisce con 90017 anche se la struttura Payload sembra corretta.
**Causa**: Con `uploadSymbols: true` e `destination: export`, xcodebuild include una directory `Symbols/` al top-level dell'IPA. Apple non la accetta.
**Fix**: Non usare `uploadSymbols: true` con `destination: export`, oppure rimuovere `Symbols/` dall'IPA manualmente.

---

### Bug 5: `destination: upload` fallisce con "Failed to Use Accounts"
**Causa**: Da CLI, xcodebuild non riesce ad accedere ai token Apple ID memorizzati da Xcode GUI. Il `DVTDeveloperAccountManager` non funziona in processi background.
**Workaround**: Usare `destination: export` + `xcrun altool --upload-app` separatamente.

---

## Approccio Corretto — Procedura Completa

### Prerequisiti (verificare UNA VOLTA):
1. Certificato "Apple Distribution" nel keychain con partition list corretta (fix Bug 2 sopra)
2. Provisioning profiles App Store scaricati in `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`
   - Main app: `d6228579-ab46-424b-aea5-1ebd327fdd5a.mobileprovision`
   - Widget: `6ee9d5cd-41f6-4a8a-8cee-cbf130bc273a.mobileprovision`
3. App-specific password Apple ID generata su appleid.apple.com (Apple ID: `keape@me.com`)

### Step 1: Build archive
```bash
xcodebuild -workspace BudgetAppIOS.xcworkspace \
  -scheme Budget365 \
  -configuration Release \
  -archivePath /tmp/Budget365.xcarchive \
  archive
```

### Step 2: Fix Info.plist (Bug 1)
Eseguire lo script Python sopra per iniettare `ApplicationProperties`.

### Step 3: Costruire IPA manualmente (bypassa Bug 2, 3, 4)
```bash
# Crea struttura
mkdir -p /tmp/Budget365_ipa/Payload
cp -r /tmp/Budget365.xcarchive/Products/Applications/Budget365.app /tmp/Budget365_ipa/Payload/

APP=/tmp/Budget365_ipa/Payload/Budget365.app
DIST="Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)"

# Embed provisioning profiles App Store
cp ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/d6228579-ab46-424b-aea5-1ebd327fdd5a.mobileprovision \
   "$APP/embedded.mobileprovision"
cp ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/6ee9d5cd-41f6-4a8a-8cee-cbf130bc273a.mobileprovision \
   "$APP/PlugIns/Budget365Widget.appex/embedded.mobileprovision"

# Firma nell'ordine giusto: framework → extension → app
codesign --force --sign "$DIST" --timestamp=none \
  "$APP/Frameworks/hermes.framework"

codesign --force --sign "$DIST" --timestamp=none \
  --entitlements /tmp/entitlements_widget.plist \
  "$APP/PlugIns/Budget365Widget.appex"

codesign --force --sign "$DIST" --timestamp=none \
  --entitlements /tmp/entitlements_main.plist \
  "$APP"

# Verifica
codesign --verify --deep --strict "$APP" && echo "OK"

# Pacchetto IPA
cd /tmp/Budget365_ipa
zip -qr /tmp/Budget365.ipa Payload/
```

### Step 4: Upload
```bash
xcrun altool --upload-app \
  -f /tmp/Budget365.ipa \
  -t ios \
  -u keape@me.com \
  --app-password APP_SPECIFIC_PASSWORD \
  --verbose
```

### Entitlements App Store (estrarre dai profili se persi):
```bash
# Estrai entitlements da provisioning profile
security cms -D -i profile.mobileprovision | \
  plutil -extract Entitlements xml1 - -o entitlements.plist
```

---

## Info Sistema
- Apple ID: `keape@me.com`
- Team ID: `4A5H2U7Q42`
- Bundle ID app: `com.keape.budget365`
- Bundle ID widget: `com.keape.budget365.Budget365Widget`
- Distribution cert: `Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)`
- Xcode buggy: 26.5 beta (17F42) — questi bug potrebbero essere risolti in versioni successive
