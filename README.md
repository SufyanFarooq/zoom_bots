# Zoom Bots - Optimized Performance Edition

A high-performance Node.js application for joining Zoom meetings with multiple bots using Puppeteer-Core and child processes.

## 🚀 Performance Improvements

- **RAM Usage**: Reduced from 16GB for 10 bots to ~2GB for 100+ bots
- **Concurrent Bots**: Support for 100+ bots simultaneously
- **Resource Optimization**: Minimal browser instances with optimized settings
- **Process Management**: Independent bot processes for better stability

## Features

- ✅ Join 100+ bots to Zoom meetings
- ✅ Real Pakistani names (Ali_Khan_1234, Sara_Ahmed_5678, etc.)
- ✅ Ultra-lightweight browser instances
- ✅ Process-based architecture for stability
- ✅ Real-time progress monitoring
- ✅ Configurable delays and concurrency
- ✅ Automatic resource cleanup

## Prerequisites

- Node.js 18+
- Google Chrome installed
- macOS/Linux/Windows

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd zoom-bots
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Chrome path:**
   ```bash
   # macOS
   export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   
   # Linux
   export CHROME_PATH="/usr/bin/google-chrome"
   
   # Windows
   set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
   ```

## Quick Start

### 1. Configure your meeting details:
```bash
# Edit config.env or set environment variables
export MEETING_URL="https://zoom.us/wc/join/YOUR_MEETING_ID"
export MEETING_PASSCODE="your_passcode"
```

### 2. Launch bots:
```bash
# Launch 100 bots (default)
npm run launch:100

# Launch 50 bots
npm run launch:50

# Fast launch (100 bots, 1 second delay, 30 concurrent)
npm run launch:fast

# Custom configuration
TOTAL_BOTS=150 DELAY_MS=2000 MAX_CONCURRENT=25 npm run launch
```

## Configuration Options

### Environment Variables:
- `MEETING_URL`: Zoom meeting URL
- `MEETING_PASSCODE`: Meeting passcode
- `TOTAL_BOTS`: Number of bots to launch (default: 100)
- `DELAY_MS`: Delay between bot launches in milliseconds (default: 3000)
- `MAX_CONCURRENT`: Maximum concurrent bots (default: 20)
- `KEEP_ALIVE_MINUTES`: How long bots stay in meeting (default: 30)
- `CHROME_PATH`: Path to Chrome executable

### Performance Settings:
```bash
# Conservative (low resource usage)
TOTAL_BOTS=50 DELAY_MS=5000 MAX_CONCURRENT=10

# Balanced (recommended)
TOTAL_BOTS=100 DELAY_MS=3000 MAX_CONCURRENT=20

# Aggressive (high performance)
TOTAL_BOTS=200 DELAY_MS=1000 MAX_CONCURRENT=30
```

## API Endpoints (Legacy Server)

### Start the server:
```bash
npm start
```

### Join Meeting
```bash
curl -X POST http://localhost:3000/join-meeting \
  -H "Content-Type: application/json" \
  -d '{
    "meetingId": "123456789",
    "passcode": "password123",
    "botCount": 10
  }'
```

### Check Bot Status
```bash
curl http://localhost:3000/bot-status
```

### Close All Bots
```bash
curl -X POST http://localhost:3000/close-all-bots
```

## Performance Comparison

| Method | RAM Usage | Max Bots | Stability |
|--------|-----------|----------|-----------|
| Old (Puppeteer) | 16GB for 10 bots | 10-15 | Low |
| New (Puppeteer-Core + Child Process) | 2GB for 100 bots | 100+ | High |

## Troubleshooting

### Chrome not found
```bash
# Find Chrome path
which google-chrome
# or
ls /Applications/Google\ Chrome.app/Contents/MacOS/

# Set environment variable
export CHROME_PATH="/path/to/chrome"
```

### Memory issues
```bash
# Reduce concurrent bots
MAX_CONCURRENT=10 npm run launch

# Increase delay between bots
DELAY_MS=5000 npm run launch
```

### Bot detection
- Bots use realistic Pakistani names
- Random delays between actions
- Minimal browser fingerprinting
- Disabled JavaScript initially

## Project Structure

```
zoom-bots/
├── zoomBot.js              # Individual bot process
├── botLauncher.js          # Bot launcher with child processes
├── server.js               # Legacy Express server
├── joinButtonClicker-fixed.js # Legacy bot logic
├── package.json            # Dependencies & scripts
├── config.env              # Configuration template
├── public/index.html       # Web interface
└── README.md              # This file
```

## License

MIT License 