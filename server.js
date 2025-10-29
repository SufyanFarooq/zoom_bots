import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { joinZoomMeeting, closeAllBots, leaveAllMeetings, getBotStatus } from './joinButtonClicker-fixed.js';
import dotenv from 'dotenv';

// Set environment for local development
process.env.NODE_ENV = 'development';
console.log('🚀 Server starting for local development');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Function to generate real user names
function generateRealName() {
  const firstNames = [
    'Ali', 'Sara', 'Omar', 'Ayesha', 'Zain', 'Fatima', 'Usman', 'Hira', 'Bilal', 'Mina',
    'Hamza', 'Noor', 'Danish', 'Iqra', 'Saad', 'Sana', 'Raza', 'Mariam', 'Tariq', 'Laila',
    'Ahmed', 'Zara', 'Hassan', 'Aisha', 'Yusuf', 'Khadija', 'Ibrahim', 'Maryam', 'Khalid', 'Amina',
    'Abdullah', 'Fatima', 'Muhammad', 'Zainab', 'Yasin', 'Hafsa', 'Mustafa', 'Ayesha', 'Junaid', 'Sadia'
  ];
  
  const lastNames = [
    'Khan', 'Ahmed', 'Ali', 'Hassan', 'Hussain', 'Malik', 'Raza', 'Shah', 'Farooq', 'Iqbal',
    'Saleem', 'Rashid', 'Nadeem', 'Saeed', 'Waqar', 'Tariq', 'Usman', 'Bilal', 'Danish', 'Saad'
  ];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomNumber = Math.floor(Math.random() * 9999) + 1000;
  
  return `${firstName}_${lastName}_${randomNumber}`;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: 'local' });
});

// Helpers
function parseZoomFromUrl(meetingUrl) {
  try {
    const url = new URL(meetingUrl);
    // Example paths: /wc/join/123456789, /j/123456789
    const pathParts = url.pathname.split('/').filter(Boolean);
    const maybeId = pathParts[pathParts.length - 1] || '';
    const meetingId = (maybeId.match(/\d{6,}/) || [null])[0];
    const passcode = url.searchParams.get('pwd') || url.searchParams.get('passcode') || '';
    return { meetingId, passcode };
  } catch (e) {
    return { meetingId: null, passcode: '' };
  }
}

async function runWithConcurrency(total, limit, runner) {
  const results = new Array(total);
  let nextIndex = 0;
  const running = new Set();

  async function launch() {
    const index = nextIndex++;
    const p = (async () => {
      try {
        results[index] = await runner(index);
      } catch (err) {
        results[index] = { success: false, error: err?.message || String(err) };
      }
    })();
    running.add(p);
    p.finally(() => running.delete(p));
  }

  const first = Math.min(limit, total);
  for (let i = 0; i < first; i++) await launch();

  while (nextIndex < total) {
    await Promise.race(running);
    await launch();
  }

  await Promise.allSettled(Array.from(running));
  return results;
}

// Join meeting endpoint
app.post('/join-meeting', async (req, res) => {
  try {
    const {
      meetingId: meetingIdRaw,
      passcode: passcodeRaw,
      meetingUrl,
      botCount = 3,
      maxConcurrent = 3,
      keepAliveMinutes = 0,
      namePrefix = ''
    } = req.body || {};

    let meetingId = meetingIdRaw || '';
    let passcode = passcodeRaw || '';

    if (meetingUrl && !meetingId) {
      const parsed = parseZoomFromUrl(meetingUrl);
      meetingId = parsed.meetingId || meetingId;
      passcode = passcode || parsed.passcode || '';
    }

    if (!meetingId || !passcode) {
      return res.status(400).json({ error: 'Provide meetingUrl or meetingId plus passcode' });
    }

    console.log(`Starting ${botCount} bots (concurrency ${maxConcurrent}) to join meeting: ${meetingId}`);

    const names = Array.from({ length: Math.max(1, botCount) }, () => {
      const generated = generateRealName();
      return namePrefix ? `${namePrefix}_${generated}` : generated;
    });

    const results = await runWithConcurrency(botCount, Math.max(1, maxConcurrent), async (i) => {
      const botName = names[i];
      console.log(`Joining bot ${i + 1}/${botCount}: ${botName}`);
      const result = await joinZoomMeeting(meetingId, passcode, botName, keepAliveMinutes);
      return result;
    });

    res.json({ results });
  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close all bots endpoint
app.post('/close-all-bots', async (req, res) => {
  try {
    const result = await closeAllBots();
    res.json({ success: true, message: `Closed ${result} bots` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave all meetings endpoint
app.post('/leave-all-meetings', async (req, res) => {
  try {
    const result = await leaveAllMeetings();
    res.json({ success: true, message: `Left ${result} meetings` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bot status endpoint
app.get('/bot-status', (req, res) => {
  const status = getBotStatus();
  res.json(status);
});

// Debug join endpoint
app.post('/debug-join', async (req, res) => {
  try {
    const { meetingId, passcode, botName = 'TestBot' } = req.body;
    
    if (!meetingId || !passcode) {
      return res.status(400).json({ error: 'meetingId and passcode required' });
    }
    
    console.log(`Debug: Testing single bot join for ${botName}`);
    
    const result = await joinZoomMeeting(meetingId, passcode, botName);
    res.json({ success: true, result, message: 'Debug join completed' });
  } catch (error) {
    console.error('Debug join error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Local server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);
}); 