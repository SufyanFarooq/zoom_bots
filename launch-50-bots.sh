#!/bin/bash

# Launch 50 Bots - Validated & Accurate
echo "🚀 Launch 50 Bots - Validated & Accurate"
echo "======================================="

# First cleanup memory
echo "🧹 Cleaning up memory..."
./cleanup-memory.sh

echo ""
echo "🚀 Starting 50 bots launch..."

# Set Chrome path
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
echo "✅ Chrome path set"

# Set meeting details
export MEETING_URL="https://zoom.us/wc/join/2194953769"
export MEETING_PASSCODE="123456"
echo "✅ Meeting details set"

# Set 50 bots configuration
export TOTAL_BOTS=50
export MAX_CONCURRENT=10  # 10 bots per batch
export DELAY_MS=10000     # 10 seconds delay for stability
export KEEP_ALIVE_MINUTES=30

echo "📊 50 Bots Configuration:"
echo "   Total Bots: $TOTAL_BOTS"
echo "   Batch Size: $MAX_CONCURRENT (10 bots per batch)"
echo "   Total Batches: 5"
echo "   Delay: ${DELAY_MS}ms (10 seconds for stability)"
echo "   Keep Alive: ${KEEP_ALIVE_MINUTES} minutes"
echo ""

echo "🎯 Launch Plan:"
echo "   Batch 1: 10 bots → Total: 10"
echo "   Batch 2: 10 bots → Total: 20"
echo "   Batch 3: 10 bots → Total: 30"
echo "   Batch 4: 10 bots → Total: 40"
echo "   Batch 5: 10 bots → Total: 50"
echo "   Expected: 50 participants in meeting"
echo ""

echo "🚀 Starting 50 bots validated launch..."
npm run simple 