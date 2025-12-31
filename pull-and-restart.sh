#!/bin/bash

# Pull latest code from GitHub and restart bots
# Usage: ./pull-and-restart.sh

set -e

echo "🔄 Pulling latest code from GitHub..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if git repository
if [ ! -d .git ]; then
    echo -e "${RED}❌ Not a git repository!${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes. Stashing...${NC}"
    git stash
    STASHED=true
else
    STASHED=false
fi

# Pull latest changes
echo "📥 Pulling from GitHub..."
git pull origin main

# If stashed, try to apply
if [ "$STASHED" = true ]; then
    echo "📦 Applying stashed changes..."
    if git stash pop; then
        echo -e "${GREEN}✅ Stashed changes applied${NC}"
    else
        echo -e "${YELLOW}⚠️  Merge conflicts in stashed changes. Resolve manually.${NC}"
    fi
fi

# Install dependencies if package.json changed
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json\|package-lock.json"; then
    echo "📦 Installing/updating dependencies..."
    npm install --production
fi

# Restart application
echo "🔄 Restarting application..."

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "zoom-bots"; then
        echo "🔄 Restarting PM2 process..."
        pm2 restart zoom-bots
        echo -e "${GREEN}✅ Restarted with PM2${NC}"
    else
        echo -e "${YELLOW}⚠️  PM2 process 'zoom-bots' not found${NC}"
        echo "💡 Start with: pm2 start ecosystem.config.js"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 not found. Please restart manually:${NC}"
    echo "   npm run stop"
    echo "   npm run launch -- [args]"
fi

echo -e "${GREEN}✅ Update complete!${NC}"

