#!/bin/bash

# Navigate to the script's directory (to allow double click)
cd "$(dirname "$0")"

echo "================================================="
echo "   🚀 LARIS Local Agent v3.0 (Production Core)    "
echo "================================================="
echo "System check: Node.js"
node -v || echo "⚠️ Node.js nie je nainštalovaný!"
echo "-------------------------------------------------"
echo "Spúšťam agenta pre pripojenie na Cloud..."
echo "Aby Agent pracoval samostatne, NEZATVÁRAJ toto okno."
echo "Iba ho minimalizuj."
echo "================================================="

# Start Node
node src/index.js

# Prevent window close immediately on error
echo ""
echo "❌ Agent sa zastavil. Stlačte ENTER pre zatvorenie okna."
read
