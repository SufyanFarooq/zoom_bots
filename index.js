import express from 'express';
import { joinBots } from './botManager.js';

const app = express();
app.use(express.json());

app.post('/join-bots', async (req, res) => {
  const { meetingId, password, botCount = 10, joinUrl } = req.body;
  if (!meetingId || !password) {
    return res.status(400).json({ error: 'meetingId and password required' });
  }
  try {
    const result = await joinBots(meetingId, password, botCount, joinUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 