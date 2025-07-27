# Zoom Bots - Local Development

A lightweight Node.js application for joining Zoom meetings with multiple bots using Puppeteer.

## Features

- ✅ Join multiple bots to Zoom meetings
- ✅ Random bot names
- ✅ Cookie popup handling
- ✅ Local Chromium browser
- ✅ Real-time bot status
- ✅ Close all bots functionality

## Prerequisites

- Node.js 18+
- macOS (for local Chromium)

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

3. **Install Chromium browser:**
   ```bash
   npx @puppeteer/browsers install chrome@stable
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

### Test Chromium installation:
```bash
npm test
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

## Troubleshooting

### Chromium not found
If you get "Browser not found" error:
```bash
npx @puppeteer/browsers install chrome@stable
```

### Permission issues
Make sure to allow camera/microphone permissions when prompted.

## License

MIT License 