#!/bin/bash

# Script to create .env file on server
# Usage: ./create-env.sh

set -e

echo "🔧 Creating .env file..."

# Detect Chrome/Chromium path
CHROME_PATH=$(which google-chrome 2>/dev/null || which google-chrome-stable 2>/dev/null || which chromium-browser 2>/dev/null || which chromium 2>/dev/null || echo "/usr/bin/google-chrome")
PUPPETEER_EXECUTABLE_PATH=$CHROME_PATH
CHROMIUM_PATH=$CHROME_PATH

echo "📍 Detected Chrome/Chromium path: $CHROME_PATH"

# Create .env file
cat > .env << EOF
# Chrome/Chromium executable path (required for Linux servers)
# Use any of these variable names - code supports all of them
CHROME_PATH=$CHROME_PATH
PUPPETEER_EXECUTABLE_PATH=$PUPPETEER_EXECUTABLE_PATH
CHROMIUM_PATH=$CHROMIUM_PATH

# Meeting configuration (optional - can be passed as command line arguments)
# MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
# MEETING_PASSCODE=your_passcode

# Bot configuration (optional - can be passed as command line arguments)
# TOTAL_BOTS=50
# MAX_CONCURRENT=10
# DELAY_MS=3000
# KEEP_ALIVE_MINUTES=60
EOF

echo "✅ .env file created successfully!"
echo ""
echo "📝 Contents:"
cat .env
echo ""
echo "💡 You can edit .env file to add meeting URL and passcode if needed."

