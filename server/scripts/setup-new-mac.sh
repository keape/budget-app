#!/bin/bash
# Run this once to bootstrap Hermes on a fresh machine
set -euo pipefail

echo "→ Creating ~/bin if missing..."
mkdir -p ~/bin

echo "→ Symlinking hermes..."
ln -sf /Users/keape/.local/bin/hermes ~/bin/hermes

echo "→ Installing/updating uv..."
curl -LsSf https://astral.sh/uv/install.sh | bash

echo "→ Hermes version..."
~/bin/hermes --version

echo "→ Done. Make sure ~/bin is in your PATH."
echo '  export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
echo "  Then: source ~/.zshrc && which hermes"
