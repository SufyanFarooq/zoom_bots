#!/bin/bash

# Force Stop All Bots - Aggressive Cleanup
# Usage: ./force-stop.sh

echo "🛑 Force Stopping All Bots and Chrome Processes..."
echo ""

# Kill all bot processes
echo "1️⃣ Killing bot processes..."
pkill -9 -f "botWrapper.js" 2>/dev/null
pkill -9 -f "botWrapper" 2>/dev/null
echo "   ✅ Done"

# Kill all Chrome processes with puppeteer profiles
echo ""
echo "2️⃣ Killing Chrome processes..."
pkill -9 -f "puppeteer_profile" 2>/dev/null
pkill -9 -f "chrome.*--no-sandbox" 2>/dev/null
pkill -9 -f "Google Chrome.*zoom" 2>/dev/null
echo "   ✅ Done"

# Kill all Chrome processes (aggressive)
echo ""
echo "3️⃣ Aggressive Chrome cleanup..."
killall -9 chrome 2>/dev/null || true
killall -9 "Google Chrome" 2>/dev/null || true
echo "   ✅ Done"

# Wait
sleep 2

# Final check
echo ""
echo "4️⃣ Final verification..."
BOT_COUNT=$(pgrep -f "botWrapper" 2>/dev/null | wc -l)
CHROME_COUNT=$(pgrep -f "puppeteer_profile" 2>/dev/null | wc -l)

if [ "$BOT_COUNT" -gt 0 ] || [ "$CHROME_COUNT" -gt 0 ]; then
    echo "   ⚠️  Still running: $BOT_COUNT bots, $CHROME_COUNT Chrome processes"
    echo "   Trying one more time..."
    pkill -9 -f "botWrapper" 2>/dev/null
    pkill -9 -f "puppeteer" 2>/dev/null
    killall -9 chrome 2>/dev/null || true
    sleep 1
else
    echo "   ✅ All processes stopped!"
fi

echo ""
echo "✅ Force stop completed!"

