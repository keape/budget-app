---
name: appstore-upload
description: Upload Budget365 su App Store Connect. Bypassa i bug di Xcode 26.5 beta con costruzione IPA manuale. Trigger quando l'utente vuole pubblicare su App Store o TestFlight.
---

Esegui autonomamente senza chiedere conferma. Chiedi solo l'app-specific password se non disponibile.

## STOP — Bug Noti (Xcode 26.5 beta 17F42)

**NON usare `xcodebuild -exportArchive`** — produce IPA corrotto:
- Widget finisce a `Payload/Budget365Widget.appex/` (sbagliato) invece di `Payload/Budget365.app/PlugIns/`
- Include `Symbols/` al top-level (Apple rifiuta con 90017)
- `IDEDistributionPackagingStep` si blocca se partition list keychain è sbagliata

**NON usare `destination: upload`** — DVTDeveloperAccountManager inaccessibile da CLI.

**NON usare `keape86@gmail.com`** — è email notifiche. Apple ID corretto: `keape@me.com`.

---

## Prerequisiti — Verifica Una Volta

```bash
# Testa velocità firma Distribution (deve completare in <1s)
time codesign --force --sign "Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)" \
  --timestamp=none /tmp/test_sign_file 2>/dev/null || true
```

Se impiega più di 1 secondo → fix partition list (fare UNA SOLA VOLTA, persiste nel keychain):
```bash
security set-key-partition-list \
  -S apple:,teamid:4A5H2U7Q42 \
  -s -k PASSWORD_MACOS_LOGIN \
  -D "Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)" \
  ~/Library/Keychains/login.keychain-db
```

---

## Step 1 — Build Archive

```bash
cd /Users/keape/Documents/budget365/budget365iOS/ios
xcodebuild \
  -workspace Budget365.xcworkspace \
  -scheme Budget365 \
  -configuration Release \
  -archivePath /tmp/Budget365.xcarchive \
  archive 2>&1 | grep -E "error:|warning:|archive|ARCHIVE"
```

---

## Step 2 — Fix ApplicationProperties (Bug 1)

Xcode 26.5 beta non scrive `ApplicationProperties` nell'Info.plist dell'xcarchive. Senza questo, qualsiasi tool di distribuzione fallisce.

```python
import plistlib

path = "/tmp/Budget365.xcarchive/Info.plist"
with open(path, "rb") as f:
    p = plistlib.load(f)

# Leggi versione e build dall'app stessa
import subprocess, json
info = subprocess.run(
    ["plutil", "-extract", "CFBundleShortVersionString", "raw", "-",
     f"/tmp/Budget365.xcarchive/Products/Applications/Budget365.app/Info.plist"],
    capture_output=True, text=True
).stdout.strip()
build = subprocess.run(
    ["plutil", "-extract", "CFBundleVersion", "raw", "-",
     f"/tmp/Budget365.xcarchive/Products/Applications/Budget365.app/Info.plist"],
    capture_output=True, text=True
).stdout.strip()

if "ApplicationProperties" not in p:
    p["ApplicationProperties"] = {
        "ApplicationPath": "Applications/Budget365.app",
        "Architectures": ["arm64"],
        "CFBundleIdentifier": "com.keape.budget365",
        "CFBundleShortVersionString": info,
        "CFBundleVersion": build,
        "SigningIdentity": "Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)",
        "Team": "4A5H2U7Q42",
    }
    with open(path, "wb") as f:
        plistlib.dump(p, f)
    print(f"Injected: v{info} build {build}")
else:
    print("ApplicationProperties già presente")
```

---

## Step 3 — Costruisci IPA Manualmente

```bash
# Pulizia
rm -rf /tmp/Budget365_ipa /tmp/Budget365.ipa

# Struttura Payload
mkdir -p /tmp/Budget365_ipa/Payload
cp -r /tmp/Budget365.xcarchive/Products/Applications/Budget365.app \
      /tmp/Budget365_ipa/Payload/

APP=/tmp/Budget365_ipa/Payload/Budget365.app
DIST="Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)"

# Verifica struttura widget — DEVE essere in PlugIns, non in Payload
echo "Widget path:"
ls "$APP/PlugIns/"

# Embed provisioning profiles App Store
cp ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/d6228579-ab46-424b-aea5-1ebd327fdd5a.mobileprovision \
   "$APP/embedded.mobileprovision"
cp ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/6ee9d5cd-41f6-4a8a-8cee-cbf130bc273a.mobileprovision \
   "$APP/PlugIns/Budget365Widget.appex/embedded.mobileprovision"

# Estrai entitlements dai profili (sempre aggiornati)
security cms -D -i "$APP/embedded.mobileprovision" | \
  plutil -extract Entitlements xml1 - -o /tmp/entitlements_main.plist
security cms -D -i "$APP/PlugIns/Budget365Widget.appex/embedded.mobileprovision" | \
  plutil -extract Entitlements xml1 - -o /tmp/entitlements_widget.plist

# Firma in ordine OBBLIGATORIO: framework → extension → app
# hermes.framework va firmato come BUNDLE (non il binario dentro)
codesign --force --sign "$DIST" --timestamp=none \
  "$APP/Frameworks/hermes.framework"

codesign --force --sign "$DIST" --timestamp=none \
  --entitlements /tmp/entitlements_widget.plist \
  "$APP/PlugIns/Budget365Widget.appex"

codesign --force --sign "$DIST" --timestamp=none \
  --entitlements /tmp/entitlements_main.plist \
  "$APP"

# Verifica firma
codesign --verify --deep --strict "$APP" && echo "Firma OK"

# Pacchetto IPA — solo Payload/, NIENTE Symbols/
cd /tmp/Budget365_ipa
zip -qr /tmp/Budget365.ipa Payload/

# Verifica struttura IPA (widget deve essere in Payload/Budget365.app/PlugIns/)
echo "Struttura IPA:"
unzip -l /tmp/Budget365.ipa | grep -E "PlugIns|Widget|Symbols" | head -10
echo "Dimensione: $(du -sh /tmp/Budget365.ipa | cut -f1)"
```

---

## Step 4 — Upload

Chiedi all'utente l'app-specific password (da appleid.apple.com → Password specifiche per le app) se non disponibile.

```bash
xcrun altool --upload-app \
  -f /tmp/Budget365.ipa \
  -t ios \
  -u keape@me.com \
  --app-password APP_SPECIFIC_PASSWORD \
  --verbose
```

Attendi `UPLOAD SUCCEEDED` con Delivery UUID. Può richiedere 5-10 minuti.

---

## Diagnostica Errori

| Errore | Causa | Fix |
|--------|-------|-----|
| codesign lento (>1s) | Partition list mancante `apple:` | Fix prerequisiti |
| 90017 widget | Widget in `Payload/` invece di `PlugIns/` | Costruisci IPA manualmente (Step 3) |
| 90017 symbols | `Symbols/` directory nell'IPA | Non usare `xcodebuild -exportArchive` |
| 90034 hermes | Firmato binario hermes invece del bundle | `codesign ... "$APP/Frameworks/hermes.framework"` |
| "Expected --username" | Email notifiche invece di Apple ID | Usa `keape@me.com` |
| "Failed to Use Accounts" | `destination: upload` da CLI | Usa `xcrun altool` separatamente |
| IDEDistributionPackagingStep hang | Bug 2 (partition list) o Bug 1 | Fix prerequisiti + Non usare exportArchive |

---

## Valori Fissi

| Parametro | Valore |
|-----------|--------|
| Apple ID | `keape@me.com` |
| Team ID | `4A5H2U7Q42` |
| Bundle ID app | `com.keape.budget365` |
| Bundle ID widget | `com.keape.budget365.Budget365Widget` |
| Distribution cert | `Apple Distribution: Alessandro Capobianco (4A5H2U7Q42)` |
| Profile app UUID | `d6228579-ab46-424b-aea5-1ebd327fdd5a` |
| Profile widget UUID | `6ee9d5cd-41f6-4a8a-8cee-cbf130bc273a` |
| Workspace | `budget365iOS/ios/Budget365.xcworkspace` |
| Scheme | `Budget365` |
| Xcode buggy | 26.5 beta 17F42 — bug potrebbero essere risolti in versioni successive |

Riferimento dettagliato bug: `.claude/CLAUDE_xcode.md`
