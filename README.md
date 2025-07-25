# 🤖 Zoom Bot Manager

A Node.js application that automates joining multiple bots to Zoom meetings using Puppeteer.

## 🚀 Features

- **Multiple Bot Joining**: Join multiple bots to any Zoom meeting
- **Automatic Form Filling**: Name and password automatically entered
- **Permission Handling**: Camera/microphone permissions auto-allowed
- **Bot Management**: Close all bots, leave meetings, check status
- **Modern UI**: Beautiful interface with real-time status updates

## 📋 Prerequisites

- Node.js 18+ 
- Zoom account with meeting access
- Zoom SDK App credentials (for advanced features)

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd zoom-bots
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
PORT=3000
ZOOM_SDK_KEY=your_sdk_key_here
ZOOM_SDK_SECRET=your_sdk_secret_here
NODE_ENV=development
```

4. **Start the application**
```bash
npm start
```

5. **Open in browser**
```
http://localhost:3000
```

## 🌐 Deployment

### Heroku Deployment

1. **Install Heroku CLI**
```bash
npm install -g heroku
```

2. **Login to Heroku**
```bash
heroku login
```

3. **Create Heroku app**
```bash
heroku create your-app-name
```

4. **Set environment variables**
```bash
heroku config:set ZOOM_SDK_KEY=your_sdk_key
heroku config:set ZOOM_SDK_SECRET=your_sdk_secret
heroku config:set NODE_ENV=production
```

5. **Deploy**
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

6. **Open your app**
```bash
heroku open
```

### Railway Deployment

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard**
3. **Deploy automatically**

### DigitalOcean App Platform

1. **Connect your GitHub repository**
2. **Set environment variables**
3. **Deploy with one click**

## 📱 Usage

1. **Enter Meeting Details**
   - Meeting ID
   - Passcode (if required)
   - Number of bots

2. **Join Bots**
   - Click "🚀 Join as Bots"
   - Bots will automatically join the meeting

3. **Manage Bots**
   - Check status with "📊 Check Bot Status"
   - Leave meetings with "🚪 Leave All Meetings"
   - Close all bots with "❌ Close All Bots"

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `ZOOM_SDK_KEY` | Zoom SDK Key | Yes |
| `ZOOM_SDK_SECRET` | Zoom SDK Secret | Yes |
| `NODE_ENV` | Environment (development/production) | No |

### Zoom SDK Setup

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Create a "Meeting SDK" app
3. Get your SDK Key and SDK Secret
4. Add them to your environment variables

## 🐛 Troubleshooting

### Common Issues

1. **Puppeteer not working on server**
   - Make sure you're using headless mode in production
   - Add proper Chrome arguments for server environment

2. **Permission denied errors**
   - Check if your server has proper permissions
   - Use `--no-sandbox` flag (already included)

3. **Memory issues**
   - Close browsers properly after use
   - Monitor server memory usage

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚠️ Disclaimer

This tool is for educational purposes. Please ensure you comply with Zoom's Terms of Service and use responsibly. 