# Zoom Bots - Local Development

A lightweight Node.js application for joining Zoom meetings with multiple bots using Puppeteer.

## Features

- ✅ Join multiple bots to Zoom meetings
- ✅ Real user names (Ali_Khan_1234, Sara_Ahmed_5678, etc.)
- ✅ Headless browser mode for better performance
- ✅ Local Chromium browser
- ✅ Real-time bot status
- ✅ Close all bots functionality
- ✅ Clean project structure

## Prerequisites

- Node.js 18+
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

3. **Install Chromium browser (IMPORTANT!):**
   ```bash
   npx @puppeteer/browsers install chrome@stable
   ```

4. **Verify Chromium installation:**
   ```bash
   npx @puppeteer/browsers list
   ```

## Usage

### Start the server:
```bash
npm start
```

### Development mode (with auto-restart):
```bash
npm run dev
```

## API Endpoints

### Join Meeting
```bash
curl -X POST http://localhost:3000/join-meeting \
  -H "Content-Type: application/json" \
  -d '{
    "meetingId": "123456789",
    "passcode": "password123",
    "botCount": 3
  }'
```

### Debug Single Bot
```bash
curl -X POST http://localhost:3000/debug-join \
  -H "Content-Type: application/json" \
  -d '{
    "meetingId": "123456789",
    "passcode": "password123",
    "botName": "TestBot"
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

### Leave All Meetings
```bash
curl -X POST http://localhost:3000/leave-all-meetings
```

## Frontend

Open `http://localhost:3000` in your browser to use the web interface.

## Setup for New Machines

### Why Chrome folder is missing?
The `chrome/` folder is not included in Git because it's too large (220MB+). Each machine needs to install Chromium separately.

### Step-by-step setup:
1. **Clone the repository**
2. **Install Node.js dependencies:** `npm install`
3. **Install Chromium browser:** `npx @puppeteer/browsers install chrome@stable`
4. **Verify installation:** `npx @puppeteer/browsers list`
5. **Start the server:** `npm start`

### Chromium Installation Details:
- **Command:** `npx @puppeteer/browsers install chrome@stable`
- **Location:** `~/.cache/puppeteer/chrome/` (automatic)
- **Size:** ~220MB
- **Platform:** Auto-detects your OS (macOS/Linux/Windows)

## Troubleshooting

### Chromium not found
If you get "Browser not found" error:
```bash
npx @puppeteer/browsers install chrome@stable
```

### Check Chromium path
```bash
npx @puppeteer/browsers list
```

### Permission issues
Make sure to allow camera/microphone permissions when prompted.

### Browser executable not found
If the code can't find Chromium, update the path in `joinButtonClicker-fixed.js`:
```javascript
// Find your Chromium path
npx @puppeteer/browsers list

// Update the executablePath in joinButtonClicker-fixed.js
executablePath: 'YOUR_CHROMIUM_PATH_HERE'
```

## Project Structure

```
zoom-bots/
├── package.json              # Dependencies & scripts
├── server.js                 # Express server
├── joinButtonClicker-fixed.js # Bot logic
├── public/index.html         # Frontend interface
├── .gitignore               # Ignores chrome/ folder
├── README.md                # This file
└── chrome/                  # Chromium browser (created after installation)
```

## License

MIT License 