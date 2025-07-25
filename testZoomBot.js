import { joinBots } from './botManager.js';

// === CONFIGURE YOUR MEETING INFO HERE ===
const meetingId = '5067498331'; // e.g. '2194953769'
const password = '123456';     // e.g. '123456'
const botCount = 1;                   // Number of bots to join
const joinUrl = 'https://us06web.zoom.us/j/5067498331?pwd=4aJ3z9zb8f0ZaKiouEYdWNFhBh1V6d.1&omn=86338548506123456'; // Optional: e.g. 'https://app.zoom.us/wc/2194953769/join?...'

(async () => {
  try {
    const result = await joinBots(meetingId, password, botCount, joinUrl);
    console.log('Bot join results:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error running joinBots:', err);
  }
})(); 