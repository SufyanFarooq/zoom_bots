#!/bin/bash

# Resource Monitoring Script for Zoom Bots
# Usage: ./check-resources.sh

echo "📊 Zoom Bots Resource Usage Report"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Get bot processes
BOT_COUNT=$(ps aux | grep 'botWrapper.js' | grep -v grep | wc -l)
CHROME_COUNT=$(ps aux | grep 'puppeteer_profile' | grep -v grep | wc -l)

echo -e "${BLUE}🤖 Bot Processes:${NC}"
echo "   Active Bots: $BOT_COUNT"
echo "   Chrome Processes: $CHROME_COUNT"
echo ""

# System Resources
echo -e "${BLUE}💻 System Resources:${NC}"

# CPU Info
CPU_CORES=$(nproc)
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "   CPU Cores: $CPU_CORES"
echo "   CPU Usage: ${CPU_USAGE}%"

# Memory Info
MEM_TOTAL=$(free -h | grep Mem | awk '{print $2}')
MEM_USED=$(free -h | grep Mem | awk '{print $3}')
MEM_AVAIL=$(free -h | grep Mem | awk '{print $7}')
MEM_PERCENT=$(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100}')
echo "   RAM Total: $MEM_TOTAL"
echo "   RAM Used: $MEM_USED"
echo "   RAM Available: $MEM_AVAIL"
echo "   RAM Usage: ${MEM_PERCENT}%"

# Disk Info
DISK_TOTAL=$(df -h / | tail -1 | awk '{print $2}')
DISK_USED=$(df -h / | tail -1 | awk '{print $3}')
DISK_AVAIL=$(df -h / | tail -1 | awk '{print $4}')
DISK_PERCENT=$(df -h / | tail -1 | awk '{print $5}')
echo "   Disk Total: $DISK_TOTAL"
echo "   Disk Used: $DISK_USED"
echo "   Disk Available: $DISK_AVAIL"
echo "   Disk Usage: $DISK_PERCENT"
echo ""

# Per Bot Resource Usage
if [ "$BOT_COUNT" -gt 0 ]; then
    echo -e "${BLUE}📈 Per Bot Resource Usage:${NC}"
    echo ""
    
    # Get bot PIDs
    BOT_PIDS=$(ps aux | grep 'botWrapper.js' | grep -v grep | awk '{print $2}')
    
    TOTAL_BOT_CPU=0
    TOTAL_BOT_MEM=0
    BOT_NUM=1
    
    for PID in $BOT_PIDS; do
        # Get process info
        PROC_INFO=$(ps -p $PID -o %cpu,%mem,rss,cmd --no-headers 2>/dev/null)
        
        if [ ! -z "$PROC_INFO" ]; then
            CPU=$(echo $PROC_INFO | awk '{print $1}')
            MEM=$(echo $PROC_INFO | awk '{print $2}')
            RSS=$(echo $PROC_INFO | awk '{print $3}')
            CMD=$(echo $PROC_INFO | awk '{for(i=4;i<=NF;i++) printf "%s ", $i; print ""}')
            
            # Get bot name
            BOT_NAME=$(echo $CMD | grep -oP 'botWrapper\.js \K[^\s]+' || echo "Unknown")
            
            # Convert RSS to MB
            RSS_MB=$((RSS / 1024))
            
            TOTAL_BOT_CPU=$(echo "$TOTAL_BOT_CPU + $CPU" | bc)
            TOTAL_BOT_MEM=$(echo "$TOTAL_BOT_MEM + $MEM" | bc)
            
            echo "   Bot $BOT_NUM: $BOT_NAME"
            echo "      CPU: ${CPU}% | RAM: ${MEM}% (${RSS_MB}MB) | PID: $PID"
            BOT_NUM=$((BOT_NUM + 1))
        fi
    done
    
    echo ""
    echo -e "${BLUE}📊 Total Bot Resources:${NC}"
    echo "   Total CPU: ${TOTAL_BOT_CPU}%"
    echo "   Total RAM: ${TOTAL_BOT_MEM}%"
    echo ""
    
    # Chrome processes
    if [ "$CHROME_COUNT" -gt 0 ]; then
        echo -e "${BLUE}🌐 Chrome Processes Resource Usage:${NC}"
        
        CHROME_CPU=0
        CHROME_MEM=0
        CHROME_RSS=0
        
        CHROME_PIDS=$(ps aux | grep 'puppeteer_profile' | grep -v grep | awk '{print $2}')
        
        for PID in $CHROME_PIDS; do
            PROC_INFO=$(ps -p $PID -o %cpu,%mem,rss --no-headers 2>/dev/null)
            if [ ! -z "$PROC_INFO" ]; then
                CPU=$(echo $PROC_INFO | awk '{print $1}')
                MEM=$(echo $PROC_INFO | awk '{print $2}')
                RSS=$(echo $PROC_INFO | awk '{print $3}')
                
                CHROME_CPU=$(echo "$CHROME_CPU + $CPU" | bc)
                CHROME_MEM=$(echo "$CHROME_MEM + $MEM" | bc)
                CHROME_RSS=$((CHROME_RSS + RSS))
            fi
        done
        
        CHROME_RSS_MB=$((CHROME_RSS / 1024))
        CHROME_RSS_GB=$(echo "scale=2; $CHROME_RSS_MB / 1024" | bc)
        
        echo "   Chrome Processes: $CHROME_COUNT"
        echo "   Total CPU: ${CHROME_CPU}%"
        echo "   Total RAM: ${CHROME_MEM}% (${CHROME_RSS_MB}MB / ${CHROME_RSS_GB}GB)"
        echo ""
    fi
    
    # Average per bot
    if [ "$BOT_COUNT" -gt 0 ]; then
        AVG_CPU=$(echo "scale=2; $TOTAL_BOT_CPU / $BOT_COUNT" | bc)
        AVG_MEM=$(echo "scale=2; $TOTAL_BOT_MEM / $BOT_COUNT" | bc)
        
        echo -e "${BLUE}📊 Average Per Bot:${NC}"
        echo "   CPU: ${AVG_CPU}%"
        echo "   RAM: ${AVG_MEM}%"
        echo ""
    fi
fi

# Load Average
LOAD=$(uptime | awk -F'load average:' '{print $2}')
echo -e "${BLUE}⚡ System Load Average:${NC}"
echo "   $LOAD"
echo ""

# Top processes
echo -e "${BLUE}🔝 Top 10 Processes by CPU:${NC}"
ps aux --sort=-%cpu | head -11 | tail -10 | awk '{printf "   %-6s %5s%% %5s%% %s\n", $2, $3, $4, $11}'
echo ""

echo -e "${BLUE}🔝 Top 10 Processes by Memory:${NC}"
ps aux --sort=-%mem | head -11 | tail -10 | awk '{printf "   %-6s %5s%% %5s%% %s\n", $2, $3, $4, $11}'
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}📋 Summary:${NC}"
echo "   Bots Running: $BOT_COUNT"
echo "   Chrome Processes: $CHROME_COUNT"
echo "   System CPU: ${CPU_USAGE}%"
echo "   System RAM: ${MEM_PERCENT}%"
echo "   System Disk: $DISK_PERCENT"
echo ""

# Resource estimates
if [ "$BOT_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}💡 Resource Estimates for Scaling:${NC}"
    
    # Estimate for 50 bots
    EST_CPU_50=$(echo "scale=1; $TOTAL_BOT_CPU * 5" | bc)
    EST_MEM_50=$(echo "scale=1; $TOTAL_BOT_MEM * 5" | bc)
    echo "   For 50 bots: ~${EST_CPU_50}% CPU, ~${EST_MEM_50}% RAM"
    
    # Estimate for 100 bots
    EST_CPU_100=$(echo "scale=1; $TOTAL_BOT_CPU * 10" | bc)
    EST_MEM_100=$(echo "scale=1; $TOTAL_BOT_MEM * 10" | bc)
    echo "   For 100 bots: ~${EST_CPU_100}% CPU, ~${EST_MEM_100}% RAM"
    
    # Estimate for 500 bots
    EST_CPU_500=$(echo "scale=1; $TOTAL_BOT_CPU * 50" | bc)
    EST_MEM_500=$(echo "scale=1; $TOTAL_BOT_MEM * 50" | bc)
    echo "   For 500 bots: ~${EST_CPU_500}% CPU, ~${EST_MEM_500}% RAM"
fi

echo "════════════════════════════════════════════════════════════"

