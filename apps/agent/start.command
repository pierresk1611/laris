#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"

# Start the agent using local Node
echo "🚀 Starting AutoDesign Agent (Source Mode)..."
echo "Press Ctrl+C to stop."
echo ""

node src/index.js
