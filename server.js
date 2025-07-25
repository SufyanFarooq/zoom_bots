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
  const { meetingNumber, passWord, userName } = req.body;
  if (!meetingNumber || !userName) {
    return res.status(400).json({ error: 'meetingNumber and userName required' });
  }
  try {
    const result = await joinZoomMeeting(meetingNumber, passWord, userName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  try {
    const status = getBotStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 