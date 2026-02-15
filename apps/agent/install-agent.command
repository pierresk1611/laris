#!/bin/bash
cd "$(dirname "$0")"

# 0. Clear quarantine (Fix "Unknown Developer" error)
echo "🛡️  Opravujem oprávnenia (obchádzam Gatekeeper)..."
xattr -d com.apple.quarantine "$0" 2>/dev/null
xattr -d com.apple.quarantine start.command 2>/dev/null

echo "📦 Inštalujem AutoDesign Agent..."

# 1. Check Node Version
NODE_VER=$(node -v 2>/dev/null)
echo "ℹ️  Aktuálny Node.js: $NODE_VER"

if [[ "$NODE_VER" != v18.* && "$NODE_VER" != v20.* && "$NODE_VER" != v22.* ]]; then
    echo "⚠️  Odporúčame Node.js verziu 18 alebo novšiu."
    # We won't force install, just warn, as they might have a specific setup
fi

# 2. Install Dependencies
echo "📥 Sťahujem knižnice..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Inštalácia úspešná!"
    echo "🚀 Teraz dvakrát kliknite na 'start.command' pre spustenie Agenta."
else
    echo "❌ Chyba pri inštalácii. Skontrolujte internetové pripojenie."
fi

# Keep window open
read -p "Stlačte ENTER pre ukončenie..."
