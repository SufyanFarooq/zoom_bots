import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSignature } from './signature.js';
import { joinZoomMeeting, closeAllBots, leaveAllMeetings, getBotStatus } from './joinButtonClicker.js';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json()); // Add JSON parsing middleware
app.use(express.static(path.join(__dirname, 'public')));

app.get('/signature', (req, res) => {
  const { meetingNumber, role } = req.query;
  if (!meetingNumber || !role) {
    return res.status(400).json({ error: 'meetingNumber and role required' });
  }
  try {
    const signature = generateSignature(meetingNumber, role);
    res.json({ signature });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/join-meeting', async (req, res) => {
  try {
    const { meetingId, passcode, botCount } = req.body;
    
    if (!meetingId || !botCount) {
      return res.status(400).json({ error: 'meetingId and botCount required' });
    }
    
    console.log(`Starting ${botCount} bots to join meeting: ${meetingId}`);
    
    const results = [];
    const botNames = [];
    
    // Generate random bot names
    for (let i = 0; i < botCount; i++) {
      const firstName = ['Ali', 'Fatima', 'Ahmed', 'Ayesha', 'Usman', 'Mariam', 'Bilal', 'Zara', 'Danish', 'Noor', 'Saad', 'Hira', 'Tariq', 'Sana', 'Zain', 'Aisha', 'Hassan', 'Layla', 'Omar', 'Yasmin'];
      const lastName = Math.floor(Math.random() * 9999) + 1000;
      const botName = `${firstName[Math.floor(Math.random() * firstName.length)]}_${lastName}`;
      botNames.push(botName);
    }
    
    // Join bots sequentially to avoid resource conflicts
    for (let i = 0; i < botNames.length; i++) {
      const botName = botNames[i];
      console.log(`Joining bot ${i + 1}/${botCount}: ${botName}`);
      
      try {
        const result = await joinZoomMeeting(meetingId, passcode || '', botName);
        results.push(result);
        
        // Wait between bots to avoid overwhelming the server
        if (i < botNames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error joining ${botName}:`, error);
        results.push({
          success: false,
          error: error.message,
          userName: botName
        });
      }
    }
    
    res.json({ results });
    
  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/close-all-bots', async (req, res) => {
  try {
    const result = await closeAllBots();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/leave-all-meetings', async (req, res) => {
  try {
    const result = await leaveAllMeetings();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/bot-status', (req, res) => {
  const status = getBotStatus();
  res.json(status);
});

// Debug endpoint to test single bot join
app.post('/debug-join', async (req, res) => {
  try {
    const { meetingId, passcode, botName } = req.body;
    
    if (!meetingId || !botName) {
      return res.status(400).json({ error: 'Meeting ID and bot name required' });
    }
    
    console.log(`Debug: Testing single bot join for ${botName}`);
    const result = await joinZoomMeeting(meetingId, passcode || '', botName);
    
    res.json({
      success: true,
      result: result,
      message: 'Debug join completed'
    });
  } catch (error) {
    console.error('Debug join error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 