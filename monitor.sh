#!/bin/bash

# Zoom Bots Monitoring Script
# Usage: ./monitor.sh

echo "=========================================="
echo "🤖 Zoom Bots Status - $(date)"
echo "=========================================="

# Bot processes
BOT_COUNT=$(ps aux | grep 'botWrapper.js' | grep -v grep | wc -l)
echo "📊 Bot Processes: $BOT_COUNT"

# Chrome processes
CHROME_COUNT=$(ps aux | grep 'puppeteer_profile' | grep -v grep | wc -l)
echo "🌐 Chrome Processes: $CHROME_COUNT"

# Memory usage
MEMORY=$(free -h | grep Mem | awk '{print $3 "/" $2}')
echo "💾 Memory Usage: $MEMORY"

# CPU usage
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "⚡ CPU Usage: ${CPU}%"

# Disk usage
DISK=$(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')
echo "💿 Disk Usage: $DISK"

# Load average
LOAD=$(uptime | awk -F'load average:' '{print $2}')
echo "📈 Load Average:$LOAD"

echo "=========================================="

# Alert if too many processes
if [ "$BOT_COUNT" -gt 1000 ]; then
    echo "⚠️  WARNING: High number of bot processes!"
fi

if [ "$CHROME_COUNT" -gt 500 ]; then
    echo "⚠️  WARNING: High number of Chrome processes!"
fi

