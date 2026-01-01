#!/bin/bash

# Continuous Resource Monitoring
# Usage: ./monitor-resources.sh [interval_seconds]
# Example: ./monitor-resources.sh 5

INTERVAL=${1:-5}

echo "📊 Continuous Resource Monitoring (Update every ${INTERVAL}s)"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "📊 Resource Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "════════════════════════════════════════════════════════════"
    
    # Quick stats
    BOT_COUNT=$(ps aux | grep 'botWrapper.js' | grep -v grep | wc -l)
    CHROME_COUNT=$(ps aux | grep 'puppeteer_profile' | grep -v grep | wc -l)
    
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    MEM_PERCENT=$(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100}')
    MEM_USED=$(free -h | grep Mem | awk '{print $3}')
    MEM_TOTAL=$(free -h | grep Mem | awk '{print $2}')
    
    echo "🤖 Bots: $BOT_COUNT | 🌐 Chrome: $CHROME_COUNT"
    echo "⚡ CPU: ${CPU_USAGE}% | 💾 RAM: ${MEM_PERCENT}% (${MEM_USED}/${MEM_TOTAL})"
    echo ""
    
    # Per bot stats
    if [ "$BOT_COUNT" -gt 0 ]; then
        echo "📈 Per Bot Stats:"
        ps aux | grep 'botWrapper.js' | grep -v grep | awk '{printf "   Bot: %s | CPU: %s%% | RAM: %s%%\n", $11, $3, $4}' | head -10
    fi
    
    echo ""
    echo "Next update in ${INTERVAL}s... (Ctrl+C to stop)"
    
    sleep $INTERVAL
done

