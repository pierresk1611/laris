#!/bin/bash
cd "$(dirname "$0")"

echo "📦 Setting up AutoDesign Agent (Legacy Mode for Mojave)..."

# 1. Check Node Version
NODE_VER=$(node -v 2>/dev/null)
echo "Current Node: $NODE_VER"

# Function to install Node 14
install_node14() {
    echo "⬇️  Downloading Node.js v14.21.3 (Last Supported for Mojave)..."
    curl -o node-v14.pkg "https://nodejs.org/dist/v14.21.3/node-v14.21.3.pkg"
    
    echo "⚠️  Opening installer..."
    echo "👉 Please follow the installation steps on screen."
    open node-v14.pkg
    
    echo "⏳ Waiting for installation to complete..."
    read -p "Press ENTER after you have finished installing Node.js..."
}

if [[ "$NODE_VER" != v14.* && "$NODE_VER" != v16.* ]]; then
    echo "❌ Node.js 14/16 is required for this system."
    install_node14
fi

# 2. Fix SSL for Mojave (Old Root Certs)
echo "🔧 Configuring NPM (SSL fix for old macOS)..."
npm config set strict-ssl false

# 3. Install Dependencies
echo "📦 Installing Agent dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Setup complete! run ./start.command"
else
    echo "❌ Error installing dependencies."
fi
