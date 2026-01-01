#!/bin/bash

# Complete Server Setup Script for Zoom Bots
# Usage: ./server-setup.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Zoom Bots Server Setup${NC}"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
    OS_NAME=$NAME
else
    echo -e "${RED}❌ Cannot detect OS${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Detected: $OS_NAME $VER${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${YELLOW}⚠️  Running as root. Some commands may need adjustment.${NC}"
fi

# Step 1: Install Node.js
echo -e "${BLUE}📦 Step 1: Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    elif [ "$OS" = "amzn" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}❌ Unsupported OS for automatic Node.js installation${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Node.js installed: $(node -v)${NC}"
else
    echo -e "${GREEN}✅ Node.js already installed: $(node -v)${NC}"
fi
echo ""

# Step 2: Install Google Chrome
echo -e "${BLUE}🌐 Step 2: Installing Google Chrome...${NC}"
if ! command -v google-chrome &> /dev/null; then
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        echo "Downloading Chrome for Ubuntu/Debian..."
        wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
        rm google-chrome-stable_current_amd64.deb
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "amzn" ]; then
        echo "Downloading Chrome for CentOS/RHEL/Amazon Linux..."
        wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
        if command -v dnf &> /dev/null; then
            sudo dnf install -y ./google-chrome-stable_current_x86_64.rpm
        else
            sudo yum install -y ./google-chrome-stable_current_x86_64.rpm
        fi
        rm google-chrome-stable_current_x86_64.rpm
    else
        echo -e "${RED}❌ Unsupported OS. Please install Chrome manually.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Chrome installed: $(google-chrome --version)${NC}"
else
    echo -e "${GREEN}✅ Chrome already installed: $(google-chrome --version)${NC}"
fi
echo ""

# Step 3: Install Chrome Dependencies
echo -e "${BLUE}📦 Step 3: Installing Chrome dependencies...${NC}"
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    sudo apt-get update
    sudo apt-get install -y \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils || echo -e "${YELLOW}⚠️  Some dependencies may have failed${NC}"
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "amzn" ]; then
    sudo yum install -y \
        alsa-lib \
        atk \
        cups-libs \
        gtk3 \
        ipa-gothic-fonts \
        libXcomposite \
        libXcursor \
        libXdamage \
        libXext \
        libXi \
        libXrandr \
        libXScrnSaver \
        libXtst \
        pango \
        xorg-x11-fonts-100dpi \
        xorg-x11-fonts-75dpi \
        xorg-x11-utils \
        wget || echo -e "${YELLOW}⚠️  Some dependencies may have failed${NC}"
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 4: Install PM2
echo -e "${BLUE}📦 Step 4: Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed: $(pm2 -v)${NC}"
else
    echo -e "${GREEN}✅ PM2 already installed: $(pm2 -v)${NC}"
fi
echo ""

# Step 5: Get Chrome Path
CHROME_PATH=$(which google-chrome)
echo -e "${BLUE}📍 Chrome Path: $CHROME_PATH${NC}"
echo ""

# Step 6: Configure System Limits
echo -e "${BLUE}⚙️  Step 5: Configuring system limits...${NC}"
if ! grep -q "nofile 65536" /etc/security/limits.conf 2>/dev/null; then
    echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf > /dev/null
    echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf > /dev/null
    echo -e "${GREEN}✅ File limits configured${NC}"
    echo -e "${YELLOW}⚠️  You may need to logout/login for limits to take effect${NC}"
else
    echo -e "${GREEN}✅ File limits already configured${NC}"
fi
echo ""

# Step 7: Test Chrome
echo -e "${BLUE}🧪 Step 6: Testing Chrome...${NC}"
if google-chrome --headless --disable-gpu --no-sandbox --dump-dom https://www.google.com > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Chrome test successful!${NC}"
else
    echo -e "${YELLOW}⚠️  Chrome test had issues, but installation may still work${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Server Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📋 Summary:"
echo "   Node.js: $(node -v 2>/dev/null || echo 'Not installed')"
echo "   Chrome: $(google-chrome --version 2>/dev/null || echo 'Not installed')"
echo "   Chrome Path: $CHROME_PATH"
echo "   PM2: $(pm2 -v 2>/dev/null || echo 'Not installed')"
echo ""
echo "📝 Next Steps:"
echo "   1. Clone repository: git clone https://github.com/YOUR_USERNAME/zoom_bots.git"
echo "   2. cd zoom_bots && npm install --production"
echo "   3. Create .env file with:"
echo "      CHROME_PATH=$CHROME_PATH"
echo "      MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID"
echo "      MEETING_PASSCODE=your_passcode"
echo "   4. pm2 start ecosystem.config.js"
echo ""

