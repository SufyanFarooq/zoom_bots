# 🔧 Server Bot Fix Guide

## Problem
Bots failing immediately (0s) on server - all bots show `❌ failed (0s)`

## Root Cause
1. Chrome path was hardcoded to macOS path
2. Errors were hidden (stdio: 'ignore')
3. CHROME_PATH environment variable not set properly

## ✅ Fix Applied

Code has been updated to:
- Auto-detect Chrome path on Linux
- Show error messages from bot processes
- Use correct Chrome path

## 🚀 Steps to Fix on Server

### Step 1: Pull Latest Code
```bash
cd /path/to/zoom_bots
git pull origin main
```

### Step 2: Set Chrome Path Environment Variable
```bash
# Check Chrome path
which google-chrome

# Set in current session
export CHROME_PATH="/usr/bin/google-chrome"

# Set permanently (add to ~/.bashrc)
echo 'export CHROME_PATH="/usr/bin/google-chrome"' >> ~/.bashrc
source ~/.bashrc
```

### Step 3: Test Chrome
```bash
# Test Chrome works
google-chrome --headless --disable-gpu --no-sandbox --version

# Test with test script
node test-chrome-server.js
```

### Step 4: Test Single Bot
```bash
# Set environment
export CHROME_PATH="/usr/bin/google-chrome"
export KEEP_ALIVE_MINUTES="5"

# Test single bot (you'll see errors now)
node botWrapper.js TestBot "https://zoom.us/wc/join/2194953769" "123456"
```

### Step 5: Update .env File
```bash
nano .env
```

Make sure it has:
```env
CHROME_PATH=/usr/bin/google-chrome
MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
MEETING_PASSCODE=your_passcode
TOTAL_BOTS=10
MAX_CONCURRENT=5
DELAY_MS=3000
KEEP_ALIVE_MINUTES=60
```

### Step 6: Test Launch
```bash
# With environment variable set
CHROME_PATH="/usr/bin/google-chrome" npm run launch -- 5 "https://zoom.us/wc/join/2194953769" "123456" 3 3000 5
```

## 🔍 Debugging

### Check Bot Errors
Now errors will be visible! Look for:
- Chrome path issues
- Missing dependencies
- Permission errors
- Network issues

### Common Errors

**Error: "Chrome not found"**
```bash
# Fix: Set CHROME_PATH
export CHROME_PATH="/usr/bin/google-chrome"
```

**Error: "Cannot find module"**
```bash
# Fix: Install dependencies
npm install --production
```

**Error: "Permission denied"**
```bash
# Fix: Check Chrome permissions
ls -la /usr/bin/google-chrome
sudo chmod +x /usr/bin/google-chrome
```

**Error: "libasound2" or missing libraries**
```bash
# Fix: Install missing dependencies
sudo apt-get install -y libasound2t64
# Or for Ubuntu 24.04:
sudo apt-get install -y libasound2
```

## 📋 Quick Fix Commands

```bash
# 1. Pull latest code
git pull origin main

# 2. Set Chrome path
export CHROME_PATH="/usr/bin/google-chrome"

# 3. Test Chrome
google-chrome --version

# 4. Test single bot
node botWrapper.js TestBot "https://zoom.us/wc/join/2194953769" "123456"

# 5. If works, launch bots
npm run launch -- 10 "https://zoom.us/wc/join/2194953769" "123456" 5 3000 60
```

## 🎯 Expected Output After Fix

**Before (Failing):**
```
🤖 Launching Bot1...
❌ Bot1 failed (0s)
```

**After (Working):**
```
🤖 Launching Bot1...
🔍 Using Chrome path: /usr/bin/google-chrome
Navigating to: https://zoom.us/wc/join/2194953769
✅ Bot1 successfully joined meeting!
```

## ⚠️ Important Notes

1. **Always set CHROME_PATH** before running bots
2. **Check errors** - they're now visible!
3. **Test single bot first** before launching multiple
4. **Ubuntu 24.04** may need `libasound2t64` instead of `libasound2`

## 🆘 Still Not Working?

Run debug script:
```bash
./debug-bot.sh
```

Or test Chrome directly:
```bash
node test-chrome-server.js
```

Share the error output for further help!

