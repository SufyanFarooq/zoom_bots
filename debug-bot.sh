#!/bin/bash

# Debug single bot on server
# Usage: ./debug-bot.sh

echo "🔍 Debugging Bot on Server..."
echo ""

# Set Chrome path
export CHROME_PATH="/usr/bin/google-chrome"
export KEEP_ALIVE_MINUTES="5"

echo "📍 Chrome Path: $CHROME_PATH"
echo ""

# Test Chrome
echo "1️⃣ Testing Chrome..."
if command -v google-chrome &> /dev/null; then
    echo "   ✅ Chrome found: $(google-chrome --version)"
else
    echo "   ❌ Chrome not found!"
    exit 1
fi

# Test bot directly with error output
echo ""
echo "2️⃣ Testing bot with error output..."
echo "   Running: node botWrapper.js TestBot https://zoom.us/wc/join/2194953769 123456"
echo ""

node botWrapper.js TestBot "https://zoom.us/wc/join/2194953769" "123456" 2>&1 | head -50

