# ⚡ Quick Deployment Guide - Linux Server

## 🚀 Fast Setup (5 Minutes)

### Step 1: Transfer Code to Server
```bash
# On your Mac
cd /Users/mac/Downloads/zoom-bots
tar -czf zoom-bots.tar.gz --exclude='node_modules' --exclude='.git' .
scp zoom-bots.tar.gz user@your-server-ip:/home/user/
```

### Step 2: On Server - Run Deployment Script
```bash
# SSH into server
ssh user@your-server-ip

# Extract and setup
cd /home/user
tar -xzf zoom-bots.tar.gz
cd zoom-bots
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Create .env File
```bash
# Option 1: Use the automated script (recommended)
./create-env.sh

# Option 2: Copy from template
cp env.template .env
nano .env  # Edit as needed

# Option 3: Create manually
echo "CHROME_PATH=/usr/bin/google-chrome" > .env
```

Edit `.env` file:
```env
CHROME_PATH=/usr/bin/google-chrome
MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
MEETING_PASSCODE=your_passcode
TOTAL_BOTS=200
MAX_CONCURRENT=30
DELAY_MS=2000
KEEP_ALIVE_MINUTES=30
```

### Step 4: Start Bots
```bash
# Using PM2 (Recommended)
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions

# Or using npm
npm run launch -- 200 "https://zoom.us/wc/join/123456" "password"
```

## 📊 For 32 Core / 128GB RAM Server

### Recommended Settings:
```bash
TOTAL_BOTS=500
MAX_CONCURRENT=50
DELAY_MS=1000
KEEP_ALIVE_MINUTES=60
```

### Update ecosystem.config.js:
```javascript
env: {
  TOTAL_BOTS: 500,
  MAX_CONCURRENT: 50,
  DELAY_MS: 1000,
  KEEP_ALIVE_MINUTES: 60
}
```

## 🎯 Common Commands

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop zoom-bots
# OR
npm run stop

# Restart
pm2 restart zoom-bots

# Monitor
pm2 monit
pm2 logs zoom-bots

# Status
pm2 status
./monitor.sh
```

## 🔧 Troubleshooting

### Chrome Not Found
```bash
which google-chrome
export CHROME_PATH="/usr/bin/google-chrome"
```

### Too Many Processes
```bash
npm run stop
```

### Check Logs
```bash
pm2 logs zoom-bots
tail -f logs/out.log
```

## 📈 Performance Tips

1. **Start Small**: Test with 50 bots first
2. **Monitor Resources**: Use `htop` to watch CPU/RAM
3. **Adjust Concurrent**: Increase `MAX_CONCURRENT` gradually
4. **Network**: Ensure good bandwidth for 500+ bots

## 🛡️ Security

- Run as non-root user
- Use firewall (ufw/iptables)
- Keep .env file secure
- Regular updates

