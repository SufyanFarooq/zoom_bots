#!/bin/bash

# Launch 100 Bots - Maximum Scale
echo "🔥 Launch 100 Bots - Maximum Scale"
echo "=================================="

# First cleanup memory
echo "🧹 Cleaning up memory..."
./cleanup-memory.sh

echo ""
echo "🔥 Starting 100 bots launch..."

# Set Chrome path
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
echo "✅ Chrome path set"

# Set meeting details
export MEETING_URL="https://zoom.us/wc/join/2194953769"
export MEETING_PASSCODE="123456"
echo "✅ Meeting details set"

# Set 100 bots configuration
export TOTAL_BOTS=100
export MAX_CONCURRENT=10  # 10 bots per batch
export DELAY_MS=8000      # 8 seconds delay for faster launch
export KEEP_ALIVE_MINUTES=30

echo "📊 100 Bots Configuration:"
echo "   Total Bots: $TOTAL_BOTS"
echo "   Batch Size: $MAX_CONCURRENT (10 bots per batch)"
echo "   Total Batches: 10"
echo "   Delay: ${DELAY_MS}ms (8 seconds for faster launch)"
echo "   Keep Alive: ${KEEP_ALIVE_MINUTES} minutes"
echo ""

echo "🎯 Launch Plan:"
echo "   10 batches of 10 bots each"
echo "   Total launch time: ~20 minutes"
echo "   Expected: 90-100 participants in meeting"
echo ""

echo "⚠️ System Requirements:"
echo "   - Memory: Will use ~14-15 GB"
echo "   - CPU: Will use ~70-80%"
echo "   - Stable internet connection required"
echo ""

echo "🔥 Starting 100 bots maximum scale launch..."
npm run simple 