#!/bin/bash

# Zoom Bots Deployment Script for Linux Server
# Usage: ./deploy.sh

set -e

echo "🚀 Starting Zoom Bots Deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ required. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node -v)${NC}"

# Check Chrome
if ! command -v google-chrome &> /dev/null; then
    echo -e "${YELLOW}⚠️  Google Chrome not found. Installing...${NC}"
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
    rm google-chrome-stable_current_amd64.deb
fi

CHROME_PATH=$(which google-chrome)
echo -e "${GREEN}✅ Chrome found at: $CHROME_PATH${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create logs directory
mkdir -p logs

# Set permissions
chmod +x stop-bots.js
chmod +x simpleBatchLauncher-fixed-logic.js

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
CHROME_PATH=$CHROME_PATH
MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
MEETING_PASSCODE=your_passcode
TOTAL_BOTS=200
MAX_CONCURRENT=30
DELAY_MS=2000
KEEP_ALIVE_MINUTES=30
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file with your meeting details${NC}"
fi

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

echo -e "${GREEN}✅ Deployment setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your meeting details"
echo "2. Start with: pm2 start ecosystem.config.js"
echo "3. Monitor with: pm2 monit"
echo "4. View logs: pm2 logs zoom-bots"

