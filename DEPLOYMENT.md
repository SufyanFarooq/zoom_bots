# 🚀 Linux Server Deployment Guide

## Server Specifications
- **CPU**: 32 cores
- **RAM**: 128 GB
- **OS**: Linux (Ubuntu/Debian recommended)

## Prerequisites

### 1. Install Node.js (v18+)
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Install Google Chrome
```bash
# Download and install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb

# Verify installation
google-chrome --version
```

### 3. Install System Dependencies
```bash
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
    xdg-utils
```

## Deployment Steps

### 1. Transfer Code to Server
```bash
# On your local machine
cd /Users/mac/Downloads/zoom-bots
tar -czf zoom-bots.tar.gz --exclude='node_modules' --exclude='.git' .
scp zoom-bots.tar.gz user@your-server-ip:/home/user/

# On server
cd /home/user
tar -xzf zoom-bots.tar.gz
cd zoom-bots
```

### 2. Install Dependencies
```bash
npm install --production
```

### 3. Set Chrome Path
```bash
# Find Chrome path
which google-chrome
# Usually: /usr/bin/google-chrome

# Set environment variable
export CHROME_PATH="/usr/bin/google-chrome"
```

### 4. Create Environment File
```bash
nano .env
```

Add:
```env
CHROME_PATH=/usr/bin/google-chrome
MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
MEETING_PASSCODE=your_passcode
TOTAL_BOTS=100
MAX_CONCURRENT=20
DELAY_MS=3000
KEEP_ALIVE_MINUTES=30
```

## Process Management Options

### Option 1: PM2 (Recommended for Production)

#### Install PM2
```bash
sudo npm install -g pm2
```

#### Create PM2 Ecosystem File
```bash
nano ecosystem.config.js
```

Add:
```javascript
module.exports = {
  apps: [{
    name: 'zoom-bots',
    script: 'simpleBatchLauncher-fixed-logic.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      CHROME_PATH: '/usr/bin/google-chrome',
      TOTAL_BOTS: 200,
      MAX_CONCURRENT: 30,
      DELAY_MS: 2000,
      KEEP_ALIVE_MINUTES: 30
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '8G'
  }]
};
```

#### Start with PM2
```bash
# Create logs directory
mkdir -p logs

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Monitor
pm2 monit

# View logs
pm2 logs zoom-bots

# Stop
pm2 stop zoom-bots

# Restart
pm2 restart zoom-bots
```

### Option 2: Systemd Service

#### Create Service File
```bash
sudo nano /etc/systemd/system/zoom-bots.service
```

Add:
```ini
[Unit]
Description=Zoom Bots Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/user/zoom-bots
Environment="NODE_ENV=production"
Environment="CHROME_PATH=/usr/bin/google-chrome"
Environment="TOTAL_BOTS=200"
Environment="MAX_CONCURRENT=30"
Environment="DELAY_MS=2000"
Environment="KEEP_ALIVE_MINUTES=30"
ExecStart=/usr/bin/node /home/user/zoom-bots/simpleBatchLauncher-fixed-logic.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zoom-bots

[Install]
WantedBy=multi-user.target
```

#### Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable zoom-bots
sudo systemctl start zoom-bots

# Check status
sudo systemctl status zoom-bots

# View logs
sudo journalctl -u zoom-bots -f

# Stop
sudo systemctl stop zoom-bots
```

## Performance Optimization for 32 Core / 128GB RAM

### Recommended Configuration
```bash
# For maximum performance
TOTAL_BOTS=500
MAX_CONCURRENT=50
DELAY_MS=1000
KEEP_ALIVE_MINUTES=60
```

### Resource Limits
```bash
# Increase file descriptor limits
sudo nano /etc/security/limits.conf
```

Add:
```
* soft nofile 65536
* hard nofile 65536
```

```bash
# Apply changes
sudo sysctl -p
```

### Memory Management
```bash
# Check available memory
free -h

# Monitor resource usage
htop
```

## Monitoring

### 1. Create Monitoring Script
```bash
nano monitor.sh
```

Add:
```bash
#!/bin/bash
echo "=== Zoom Bots Status ==="
echo "Bot Processes: $(ps aux | grep 'botWrapper.js' | grep -v grep | wc -l)"
echo "Chrome Processes: $(ps aux | grep 'puppeteer_profile' | grep -v grep | wc -l)"
echo "Memory Usage: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
```

```bash
chmod +x monitor.sh
```

### 2. Setup Cron for Monitoring
```bash
crontab -e
```

Add:
```
*/5 * * * * /home/user/zoom-bots/monitor.sh >> /home/user/zoom-bots/monitor.log 2>&1
```

## Quick Commands

### Start Bots
```bash
# With PM2
pm2 start ecosystem.config.js

# With systemd
sudo systemctl start zoom-bots

# Direct
node simpleBatchLauncher-fixed-logic.js 200 "https://zoom.us/wc/join/123456" "password"
```

### Stop Bots
```bash
# With PM2
pm2 stop zoom-bots

# With systemd
sudo systemctl stop zoom-bots

# Direct
npm run stop
# or
node stop-bots.js
```

### Check Status
```bash
# PM2
pm2 status
pm2 logs zoom-bots

# Systemd
sudo systemctl status zoom-bots

# Direct
ps aux | grep botWrapper
```

## Troubleshooting

### Chrome Not Found
```bash
# Find Chrome
which google-chrome
whereis google-chrome

# Set path
export CHROME_PATH="/usr/bin/google-chrome"
```

### Permission Issues
```bash
# Make scripts executable
chmod +x stop-bots.js
chmod +x simpleBatchLauncher-fixed-logic.js
```

### Memory Issues
```bash
# Monitor memory
free -h
ps aux --sort=-%mem | head -10

# Kill all bots if needed
npm run stop
```

### Too Many Processes
```bash
# Check process count
ps aux | grep botWrapper | wc -l

# If too high, reduce MAX_CONCURRENT
```

## Security Considerations

1. **Firewall**: Only open necessary ports
2. **User Permissions**: Run as non-root user
3. **Environment Variables**: Keep sensitive data in .env file
4. **Logs**: Monitor logs for suspicious activity

## Scaling Tips

With 32 cores and 128GB RAM, you can run:
- **Conservative**: 200-300 bots
- **Balanced**: 400-500 bots  
- **Aggressive**: 600-800 bots

Adjust `MAX_CONCURRENT` based on:
- Network bandwidth
- Meeting server capacity
- Desired join speed

## Backup & Recovery

```bash
# Backup code
tar -czf zoom-bots-backup-$(date +%Y%m%d).tar.gz .

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

## Support

For issues, check:
- Logs: `pm2 logs` or `journalctl -u zoom-bots`
- Process status: `pm2 status` or `systemctl status zoom-bots`
- Resource usage: `htop` or `top`

