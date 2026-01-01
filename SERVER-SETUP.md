# 🖥️ Linux Server Setup Guide - Chrome Installation

## Server Information Needed

Please provide:
1. **OS Version**: (Ubuntu 20.04/22.04, Debian 11/12, CentOS 7/8, etc.)
2. **Architecture**: (x64/amd64, arm64, etc.)
3. **CPU Cores**: (32 cores - already mentioned)
4. **RAM**: (128 GB - already mentioned)
5. **Root Access**: (Yes/No)

## Quick Chrome Installation

### For Ubuntu/Debian

```bash
# Update system
sudo apt-get update

# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb

# Verify installation
google-chrome --version
which google-chrome
```

### For CentOS/RHEL

```bash
# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y ./google-chrome-stable_current_x86_64.rpm

# Or for newer versions
sudo dnf install -y ./google-chrome-stable_current_x86_64.rpm

# Verify
google-chrome --version
```

### For Amazon Linux

```bash
# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y ./google-chrome-stable_current_x86_64.rpm

# Verify
google-chrome --version
```

## Complete Setup Script

Create this script on your server:

```bash
#!/bin/bash
# server-setup.sh - Complete server setup for Zoom Bots

set -e

echo "🚀 Starting Zoom Bots Server Setup..."

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo "❌ Cannot detect OS"
    exit 1
fi

echo "📋 Detected OS: $OS $VER"

# Install Node.js
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node -v)"
fi

# Install Chrome
echo "🌐 Installing Google Chrome..."
if ! command -v google-chrome &> /dev/null; then
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
        rm google-chrome-stable_current_amd64.deb
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "amzn" ]; then
        wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
        sudo yum install -y ./google-chrome-stable_current_x86_64.rpm || sudo dnf install -y ./google-chrome-stable_current_x86_64.rpm
        rm google-chrome-stable_current_x86_64.rpm
    else
        echo "⚠️  Unsupported OS. Please install Chrome manually."
    fi
else
    echo "✅ Chrome already installed: $(google-chrome --version)"
fi

# Install Chrome dependencies
echo "📦 Installing Chrome dependencies..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
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
        xdg-utils
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
        wget
fi

# Install PM2
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Set Chrome path
CHROME_PATH=$(which google-chrome)
echo "✅ Chrome path: $CHROME_PATH"

# Create .env template
if [ ! -f .env ]; then
    echo "📝 Creating .env template..."
    cat > .env << EOF
CHROME_PATH=$CHROME_PATH
MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
MEETING_PASSCODE=your_passcode
TOTAL_BOTS=200
MAX_CONCURRENT=30
DELAY_MS=2000
KEEP_ALIVE_MINUTES=30
EOF
    echo "⚠️  Please edit .env file with your meeting details"
fi

# Increase file limits
echo "⚙️  Configuring system limits..."
sudo tee -a /etc/security/limits.conf << EOF
* soft nofile 65536
* hard nofile 65536
EOF

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your meeting details"
echo "2. Clone your repository: git clone https://github.com/YOUR_USERNAME/zoom_bots.git"
echo "3. cd zoom_bots && npm install --production"
echo "4. pm2 start ecosystem.config.js"
```

## Manual Chrome Installation Steps

### Step 1: Check Current System

```bash
# Check OS
cat /etc/os-release

# Check architecture
uname -m

# Check if Chrome already installed
which google-chrome
google-chrome --version
```

### Step 2: Install Chrome Based on OS

**Ubuntu 20.04/22.04:**
```bash
sudo apt-get update
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb
```

**Debian 11/12:**
```bash
sudo apt-get update
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb
```

**CentOS 7/8:**
```bash
sudo yum install -y wget
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y ./google-chrome-stable_current_x86_64.rpm
rm google-chrome-stable_current_x86_64.rpm
```

**Amazon Linux 2:**
```bash
sudo yum install -y wget
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y ./google-chrome-stable_current_x86_64.rpm
rm google-chrome-stable_current_x86_64.rpm
```

### Step 3: Install Dependencies

**For Ubuntu/Debian:**
```bash
sudo apt-get install -y \
    ca-certificates fonts-liberation libappindicator3-1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 \
    libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgbm1 libgcc1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

**For CentOS/RHEL/Amazon Linux:**
```bash
sudo yum install -y \
    alsa-lib atk cups-libs gtk3 ipa-gothic-fonts \
    libXcomposite libXcursor libXdamage libXext libXi \
    libXrandr libXScrnSaver libXtst pango \
    xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi \
    xorg-x11-utils wget
```

### Step 4: Verify Installation

```bash
# Check Chrome version
google-chrome --version

# Check Chrome path
which google-chrome

# Test Chrome (headless)
google-chrome --headless --disable-gpu --dump-dom https://www.google.com > /dev/null && echo "✅ Chrome works!"
```

## Troubleshooting

### Chrome Not Found After Installation

```bash
# Find Chrome
whereis google-chrome
find /usr -name "google-chrome" 2>/dev/null

# Create symlink if needed
sudo ln -s /usr/bin/google-chrome-stable /usr/bin/google-chrome
```

### Permission Denied

```bash
# Check permissions
ls -la $(which google-chrome)

# Fix if needed
sudo chmod +x $(which google-chrome)
```

### Missing Dependencies

```bash
# For Ubuntu/Debian
sudo apt-get install -f

# For CentOS/RHEL
sudo yum install -y --skip-broken
```

### Chrome Crashes

```bash
# Test with verbose output
google-chrome --headless --disable-gpu --no-sandbox --version

# Check for missing libraries
ldd $(which google-chrome) | grep "not found"
```

## Alternative: Chromium Installation

If Chrome doesn't work, try Chromium:

**Ubuntu/Debian:**
```bash
sudo apt-get install -y chromium-browser
```

**CentOS/RHEL:**
```bash
sudo yum install -y chromium
```

Then update `.env`:
```env
CHROME_PATH=/usr/bin/chromium-browser
# OR
CHROME_PATH=/usr/bin/chromium
```

## Quick Verification Script

```bash
#!/bin/bash
echo "🔍 Checking server setup..."

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node -v)"
else
    echo "❌ Node.js not installed"
fi

# Check Chrome
if command -v google-chrome &> /dev/null; then
    echo "✅ Chrome: $(google-chrome --version)"
    echo "   Path: $(which google-chrome)"
else
    echo "❌ Chrome not installed"
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    echo "✅ PM2: $(pm2 -v)"
else
    echo "❌ PM2 not installed"
fi

# Check system resources
echo ""
echo "💻 System Resources:"
echo "   CPU Cores: $(nproc)"
echo "   RAM: $(free -h | grep Mem | awk '{print $2}')"
echo "   Disk: $(df -h / | tail -1 | awk '{print $4}') available"
```

## Next Steps After Chrome Installation

1. **Set Chrome Path in Environment:**
```bash
export CHROME_PATH="/usr/bin/google-chrome"
echo 'export CHROME_PATH="/usr/bin/google-chrome"' >> ~/.bashrc
```

2. **Clone Repository:**
```bash
git clone https://github.com/YOUR_USERNAME/zoom_bots.git
cd zoom_bots
```

3. **Install Dependencies:**
```bash
npm install --production
```

4. **Configure:**
```bash
nano .env
# Add your meeting details
```

5. **Start:**
```bash
pm2 start ecosystem.config.js
```

