#!/bin/bash

# Memory Cleanup Script
echo "🧹 Memory Cleanup Script"
echo "======================="

echo "🔍 Current memory usage:"
free -h 2>/dev/null || vm_stat | head -10

echo ""
echo "🧹 Cleaning up processes..."

# Kill any existing bot processes
echo "Killing existing bot processes..."
pkill -f "botWrapper.js" 2>/dev/null
pkill -f "botLauncher.js" 2>/dev/null
pkill -f "dynamicBotLauncher.js" 2>/dev/null

# Kill Chrome processes started by bots
echo "Killing Chrome processes..."
pkill -f "puppeteer" 2>/dev/null

# Clean temporary files
echo "Cleaning temporary files..."
rm -rf /tmp/puppeteer_profile_* 2>/dev/null
rm -f debug_*.png 2>/dev/null

# Force garbage collection
echo "Forcing garbage collection..."
node -e "global.gc && global.gc(); console.log('✅ Garbage collection completed');" 2>/dev/null || echo "⚠️ Garbage collection not available"

echo ""
echo "🧹 Cleanup completed!"
echo "💾 Memory should be freed up now"
echo ""

echo "🔍 Memory usage after cleanup:"
free -h 2>/dev/null || vm_stat | head -10

echo ""
echo "🚀 Ready to launch bots with optimized memory!" 