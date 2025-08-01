#!/bin/bash

# Launch 200 Bots - Extreme Scale
echo "💥 Launch 200 Bots - Extreme Scale"
echo "=================================="

# First cleanup memory
echo "🧹 Cleaning up memory..."
./cleanup-memory.sh

echo ""
echo "💥 Starting 200 bots extreme launch..."

# Set Chrome path
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
echo "✅ Chrome path set"

# Set meeting details
export MEETING_URL="https://zoom.us/wc/join/2194953769"
export MEETING_PASSCODE="123456"
echo "✅ Meeting details set"

# Set 200 bots configuration
export TOTAL_BOTS=200
export MAX_CONCURRENT=15  # 15 bots per batch for faster launch
export DELAY_MS=6000      # 6 seconds delay for maximum speed
export KEEP_ALIVE_MINUTES=30

echo "📊 200 Bots Configuration:"
echo "   Total Bots: $TOTAL_BOTS"
echo "   Batch Size: $MAX_CONCURRENT (15 bots per batch)"
echo "   Total Batches: 14"
echo "   Delay: ${DELAY_MS}ms (6 seconds for maximum speed)"
echo "   Keep Alive: ${KEEP_ALIVE_MINUTES} minutes"
echo ""

echo "🎯 Extreme Launch Plan:"
echo "   14 batches of 15 bots each"
echo "   Total launch time: ~30 minutes"
echo "   Expected: 180-200 participants in meeting"
echo ""

echo "⚠️ EXTREME System Requirements:"
echo "   - Memory: Will use ALL 16 GB + SWAP"
echo "   - CPU: Will use 90-100%"
echo "   - Very stable internet required"
echo "   - Close all other applications"
echo ""

echo "🔥 WARNING: This will push your system to limits!"
echo "   Continue only if system is stable at 100 bots"
echo ""

read -p "Continue with extreme 200 bots launch? (y/N): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    echo "💥 Starting 200 bots extreme scale launch..."
    npm run simple
else
    echo "❌ Launch cancelled. Try 100 bots first with: ./launch-100-bots.sh"
fi 