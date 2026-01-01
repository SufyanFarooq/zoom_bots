#!/bin/bash

# Server Check Script - Check what's installed
# Usage: ./check-server.sh

echo "🔍 Checking Server Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# OS Info
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "${BLUE}📋 OS Information:${NC}"
    echo "   OS: $NAME"
    echo "   Version: $VERSION_ID"
    echo "   Architecture: $(uname -m)"
    echo ""
fi

# System Resources
echo -e "${BLUE}💻 System Resources:${NC}"
echo "   CPU Cores: $(nproc)"
echo "   RAM: $(free -h | grep Mem | awk '{print $2}')"
echo "   Disk: $(df -h / | tail -1 | awk '{print $4}') available"
echo ""

# Check Node.js
echo -e "${BLUE}📦 Node.js:${NC}"
if command -v node &> /dev/null; then
    echo -e "   ${GREEN}✅ Installed: $(node -v)${NC}"
    echo "   Path: $(which node)"
else
    echo -e "   ${RED}❌ Not installed${NC}"
fi
echo ""

# Check npm
echo -e "${BLUE}📦 npm:${NC}"
if command -v npm &> /dev/null; then
    echo -e "   ${GREEN}✅ Installed: $(npm -v)${NC}"
else
    echo -e "   ${RED}❌ Not installed${NC}"
fi
echo ""

# Check Chrome
echo -e "${BLUE}🌐 Google Chrome:${NC}"
if command -v google-chrome &> /dev/null; then
    echo -e "   ${GREEN}✅ Installed: $(google-chrome --version)${NC}"
    echo "   Path: $(which google-chrome)"
    
    # Test Chrome
    echo "   Testing Chrome..."
    if timeout 5 google-chrome --headless --disable-gpu --no-sandbox --version > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Chrome works!${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Chrome installed but may have issues${NC}"
    fi
else
    echo -e "   ${RED}❌ Not installed${NC}"
    echo ""
    echo -e "   ${YELLOW}To install Chrome, run:${NC}"
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" = "ubuntu" ] || [ "$ID" = "debian" ]; then
            echo "   wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
            echo "   sudo apt-get install -y ./google-chrome-stable_current_amd64.deb"
        elif [ "$ID" = "centos" ] || [ "$ID" = "rhel" ] || [ "$ID" = "amzn" ]; then
            echo "   wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm"
            echo "   sudo yum install -y ./google-chrome-stable_current_x86_64.rpm"
        fi
    fi
fi
echo ""

# Check PM2
echo -e "${BLUE}📦 PM2:${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "   ${GREEN}✅ Installed: $(pm2 -v)${NC}"
else
    echo -e "   ${RED}❌ Not installed${NC}"
    echo "   Install with: sudo npm install -g pm2"
fi
echo ""

# Check Git
echo -e "${BLUE}📦 Git:${NC}"
if command -v git &> /dev/null; then
    echo -e "   ${GREEN}✅ Installed: $(git --version)${NC}"
else
    echo -e "   ${RED}❌ Not installed${NC}"
    echo "   Install with: sudo apt-get install git (Ubuntu/Debian)"
    echo "   Or: sudo yum install git (CentOS/RHEL)"
fi
echo ""

# Check if in git repository
if [ -d .git ]; then
    echo -e "${BLUE}📦 Git Repository:${NC}"
    echo -e "   ${GREEN}✅ In a git repository${NC}"
    echo "   Remote: $(git remote get-url origin 2>/dev/null || echo 'Not set')"
    echo "   Branch: $(git branch --show-current 2>/dev/null || echo 'Unknown')"
else
    echo -e "${BLUE}📦 Git Repository:${NC}"
    echo -e "   ${YELLOW}⚠️  Not in a git repository${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}════════════════════════════════════════${NC}"
ALL_GOOD=true

if ! command -v node &> /dev/null; then ALL_GOOD=false; fi
if ! command -v google-chrome &> /dev/null; then ALL_GOOD=false; fi
if ! command -v npm &> /dev/null; then ALL_GOOD=false; fi

if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ All essential components installed!${NC}"
    echo ""
    echo "You can now:"
    echo "  1. Clone repository: git clone https://github.com/YOUR_USERNAME/zoom_bots.git"
    echo "  2. cd zoom_bots && npm install --production"
    echo "  3. Configure .env file"
    echo "  4. Start with: pm2 start ecosystem.config.js"
else
    echo -e "${YELLOW}⚠️  Some components missing${NC}"
    echo ""
    echo "Run setup script:"
    echo "  ./server-setup.sh"
    echo ""
    echo "Or follow manual installation in SERVER-SETUP.md"
fi
echo -e "${BLUE}════════════════════════════════════════${NC}"

