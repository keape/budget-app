#!/usr/bin/env bash
# Budget365 context injection hook (UserPromptSubmit)
# 1. Keyword detection → inject relevant sub-file
# 2. Stale detection → warn if source files changed since sub-file last committed

PROJ="/Users/keape/Documents/budget365"
DOCS="$PROJ/docs"

# Read prompt from stdin JSON
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('prompt', '').lower())
except:
    print('')
" 2>/dev/null <<< "$INPUT" || echo "")

# ── Keyword injection ──────────────────────────────────────────────────────────

inject_file() {
  local file="$1"
  local label="$2"
  if [ -f "$file" ]; then
    echo "=== CONTEXT INJECTED: $label ==="
    cat "$file"
    echo ""
  fi
}

MOBILE_KW="ios mobile react.native react native screen metro xcode simulator swift android budget365ios abortcontroller hermes jsi settingscontext authcontext asyncstorage savescreen homescreen transactionscreen statsscreen budgetscreen periodicscreen addtransaction"
BACKEND_KW="server backend api route model mongodb mongoose express endpoint middleware auth jwt cors spesa entrata savingsmonth allocationplan instrumentallocation budgetsettings transazioneperiodica emailservice"
FRONTEND_KW="react web frontend src tailwind css component vercel navbar home.js transazioni budget filtri usetheme usenotification protectedroute themecontext recharts"

matches_keywords() {
  local prompt="$1"
  local keywords="$2"
  for kw in $keywords; do
    if echo "$prompt" | grep -q "$kw"; then
      return 0
    fi
  done
  return 1
}

MOBILE_INJECTED=0
BACKEND_INJECTED=0
FRONTEND_INJECTED=0

if matches_keywords "$PROMPT" "$MOBILE_KW"; then
  inject_file "$DOCS/CLAUDE_MOBILE.md" "Mobile / React Native"
  MOBILE_INJECTED=1
fi

if matches_keywords "$PROMPT" "$BACKEND_KW"; then
  inject_file "$DOCS/CLAUDE_BACKEND.md" "Backend / Server"
  BACKEND_INJECTED=1
fi

if matches_keywords "$PROMPT" "$FRONTEND_KW"; then
  inject_file "$DOCS/CLAUDE_FRONTEND.md" "Frontend Web / React"
  FRONTEND_INJECTED=1
fi

# ── Stale detection ────────────────────────────────────────────────────────────

check_stale() {
  local subfile="$1"
  local label="$2"
  shift 2
  local dirs=("$@")

  [ ! -f "$subfile" ] && return

  LAST_COMMIT=$(git -C "$PROJ" log -1 --format="%H" -- "$subfile" 2>/dev/null)
  [ -z "$LAST_COMMIT" ] && return

  NEW_FILES=""
  for dir in "${dirs[@]}"; do
    FILES=$(git -C "$PROJ" diff --name-only "$LAST_COMMIT" HEAD -- "$dir" 2>/dev/null \
      | grep -E '\.(js|tsx|ts)$' | head -5)
    [ -n "$FILES" ] && NEW_FILES="$NEW_FILES $FILES"
  done

  NEW_FILES=$(echo "$NEW_FILES" | tr ' ' '\n' | sort -u | grep -v '^$' | head -8)
  if [ -n "$NEW_FILES" ]; then
    echo ""
    echo "⚠️  STALE: $label — file modificati da ultimo aggiornamento $(basename $subfile):"
    echo "$NEW_FILES" | while read -r f; do echo "  - $f"; done
    echo "  → Aggiorna $subfile, poi committalo per resettare questo avviso."
  fi
}

check_stale \
  "$DOCS/CLAUDE_MOBILE.md" "Mobile" \
  "budget365iOS/src/screens/" \
  "budget365iOS/src/context/" \
  "budget365iOS/App.tsx" \
  "budget365iOS/src/config.ts"

check_stale \
  "$DOCS/CLAUDE_BACKEND.md" "Backend" \
  "server/routes/" \
  "server/models/" \
  "server/index.js" \
  "server/services/"

check_stale \
  "$DOCS/CLAUDE_FRONTEND.md" "Frontend" \
  "src/" \
  "src/components/" \
  "src/hooks/" \
  "src/contexts/"
