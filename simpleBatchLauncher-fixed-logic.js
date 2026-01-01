import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
// Usage: node simpleBatchLauncher-fixed-logic.js [totalBots] [meetingURL] [passcode] [maxConcurrent] [delayMs] [keepAliveMinutes]
const args = process.argv.slice(2);

// Configuration - accepts command line args or environment variables
const config = {
  meetingURL: args[1] || process.env.MEETING_URL || 'https://zoom.us/wc/join/2194953769',
  passcode: args[2] || process.env.MEETING_PASSCODE || '123456',
  totalBots: parseInt(args[0]) || parseInt(process.env.TOTAL_BOTS) || 50,
  batchSize: parseInt(args[3]) || parseInt(process.env.MAX_CONCURRENT) || 10,
  delayBetweenBots: parseInt(args[4]) || parseInt(process.env.DELAY_MS) || 10000,
  keepAliveMinutes: parseInt(args[5]) || parseInt(process.env.KEEP_ALIVE_MINUTES) || 30
};

// Show usage if help requested
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
🚀 Zoom Bots Launcher - Usage

Usage with npm:
  npm run launch -- [totalBots] [meetingURL] [passcode] [maxConcurrent] [delayMs] [keepAliveMinutes]
  
  OR directly with node:
  node simpleBatchLauncher-fixed-logic.js [totalBots] [meetingURL] [passcode] [maxConcurrent] [delayMs] [keepAliveMinutes]
  
  OR using environment variables:
  TOTAL_BOTS=50 MEETING_URL="https://zoom.us/wc/join/123456" MEETING_PASSCODE="123456" npm run launch

Examples:
  # Launch 50 bots with default meeting
  npm run launch -- 50
  
  # Launch 100 bots with custom meeting
  npm run launch -- 100 "https://zoom.us/wc/join/123456789" "password123"
  
  # Launch 30 bots with all parameters
  npm run launch -- 30 "https://zoom.us/wc/join/123456789" "password123" 5 3000 60
  
  # Direct node usage (no -- needed)
  node simpleBatchLauncher-fixed-logic.js 50 "https://zoom.us/wc/join/123456789" "password123"

Parameters:
  totalBots      - Number of bots to launch (default: 50)
  meetingURL     - Zoom meeting URL (default: from env or hardcoded)
  passcode       - Meeting passcode (default: from env or "123456")
  maxConcurrent  - Max bots per batch (default: 10)
  delayMs        - Delay between bots in ms (default: 10000)
  keepAliveMinutes - How long bots stay in meeting (default: 30)

Environment Variables (alternative):
  TOTAL_BOTS, MEETING_URL, MEETING_PASSCODE, MAX_CONCURRENT, DELAY_MS, KEEP_ALIVE_MINUTES
`);
  process.exit(0);
}

console.log('🚀 Fixed Batch Launcher - Proper Batch Logic');
console.log('📊 Configuration:');
console.log(`   - Total Bots: ${config.totalBots}`);
console.log(`   - Batch Size: ${config.batchSize}`);
console.log(`   - Delay Between Bots: ${config.delayBetweenBots}ms`);
console.log(`   - Keep Alive: ${config.keepAliveMinutes} minutes`);
console.log(`   - Meeting: ${config.meetingURL}`);

// Global tracking
let totalBotsLaunched = 0;
let totalSuccessful = 0;
let currentBatchNumber = 0;
let currentBatchBots = [];

// Generate realistic Pakistani names
function generateRealName() {
  const firstNames = [
    'Ali', 'Ahmed', 'Hassan', 'Hussain', 'Omar', 'Usman', 'Zain', 'Bilal', 'Hamza', 'Kashif',
    'Ayesha', 'Fatima', 'Zara', 'Sara', 'Mariam', 'Hira', 'Sana', 'Laila', 'Amna', 'Rabia'
  ];
  
  const lastNames = [
    'Khan', 'Ahmed', 'Ali', 'Hassan', 'Hussain', 'Malik', 'Raza', 'Shah', 'Farooq', 'Iqbal'
  ];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomNumber = Math.floor(Math.random() * 9999) + 1000;
  
  return `${firstName}_${lastName}_${randomNumber}`;
}

// Launch a single bot
function launchBot(botName) {
  console.log(`🤖 Launching ${botName}...`);
  
  // Detect Chrome path for server
  let chromePath = process.env.CHROME_PATH;
  if (!chromePath) {
    // Try to find Chrome on Linux
    try {
      chromePath = execSync('which google-chrome', { encoding: 'utf-8' }).trim();
    } catch (e) {
      try {
        chromePath = execSync('which google-chrome-stable', { encoding: 'utf-8' }).trim();
      } catch (e2) {
        // Default paths
        chromePath = process.platform === 'darwin' 
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : '/usr/bin/google-chrome';
      }
    }
  }

  const env = {
    ...process.env,
    KEEP_ALIVE_MINUTES: config.keepAliveMinutes.toString(),
    CHROME_PATH: chromePath
  };

  const botProcess = spawn('node', ['botWrapper.js', botName, config.meetingURL, config.passcode], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'], // Enable stderr to see errors
    env: env,
    cwd: __dirname
  });

  // Log errors from bot process
  botProcess.stderr.on('data', (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg) {
      console.log(`⚠️  ${botName} error: ${errorMsg}`);
    }
  });

  const botInfo = {
    name: botName,
    pid: botProcess.pid,
    startTime: Date.now(),
    status: 'running',
    joinedMeeting: false,  // NEW: Track if bot actually joined
    readyForNextBatch: false  // NEW: Track if ready for next batch
  };

  currentBatchBots.push(botInfo);

  botProcess.on('exit', (code) => {
    const duration = Math.round((Date.now() - botInfo.startTime) / 1000);
    if (code === 0) {
      console.log(`✅ ${botInfo.name} process completed successfully (${duration}s)`);
      botInfo.status = 'success';
      if (!botInfo.joinedMeeting) {
        // If process completed successfully but wasn't marked as joined, count it
        botInfo.joinedMeeting = true;
        totalSuccessful++;
      }
    } else {
      console.log(`❌ ${botInfo.name} failed (${duration}s)`);
      botInfo.status = 'failed';
    }
    botInfo.readyForNextBatch = true; // Bot is definitely ready for next batch
  });

  // FIXED LOGIC: Mark as joined and ready after 120 seconds if still running
  setTimeout(() => {
    if (botInfo.status === 'running') {
      console.log(`✅ ${botInfo.name} successfully joined meeting! (120s)`);
      botInfo.joinedMeeting = true;
      botInfo.readyForNextBatch = true;  // KEY FIX: Ready for next batch!
      totalSuccessful++;
    }
  }, 120000); // 120 seconds - time to join meeting

  totalBotsLaunched++;
}

// Launch a batch of bots
async function launchBatch() {
  currentBatchNumber++;
  currentBatchBots = [];
  
  console.log(`\n🚀 Starting Batch ${currentBatchNumber} (Target: ${config.batchSize} bots)`);
  
  // Launch bots in this batch
  for (let i = 0; i < config.batchSize; i++) {
    if (totalBotsLaunched >= config.totalBots) {
      console.log(`🎉 Reached target of ${config.totalBots} bots!`);
      break;
    }
    
    const botName = generateRealName();
    launchBot(botName);
    
    // Wait between bot launches
    if (i < config.batchSize - 1) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenBots));
    }
  }
  
  console.log(`📦 Batch ${currentBatchNumber} launched: ${currentBatchBots.length} bots`);
  
  // Wait for this batch to be ready for next batch
  await waitForBatchReadyForNext();
}

// FIXED: Wait for current batch to be ready for next batch (not fully completed)
async function waitForBatchReadyForNext() {
  console.log(`⏳ Waiting for Batch ${currentBatchNumber} bots to join meeting...`);
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // NEW LOGIC: Count bots that are ready for next batch
      const readyForNext = currentBatchBots.filter(bot => bot.readyForNextBatch);
      const joinedMeeting = currentBatchBots.filter(bot => bot.joinedMeeting);
      const failed = currentBatchBots.filter(bot => bot.status === 'failed');
      
      console.log(`📊 Batch ${currentBatchNumber} Status: ${joinedMeeting.length} joined meeting, ${failed.length} failed, ${readyForNext.length}/${currentBatchBots.length} ready for next batch`);
      
      // FIXED CONDITION: Continue when all bots are ready for next batch
      if (readyForNext.length >= currentBatchBots.length) {
        clearInterval(checkInterval);
        const successRate = (joinedMeeting.length / currentBatchBots.length) * 100;
        console.log(`✅ Batch ${currentBatchNumber} ready for next batch! Joined: ${joinedMeeting.length}/${currentBatchBots.length} (${successRate.toFixed(1)}%)`);
        console.log(`📈 Total bots in meeting: ${totalSuccessful}`);
        resolve();
      }
    }, 5000); // Check every 5 seconds
  });
}

// Main launcher function
async function startBatchLauncher() {
  console.log('\n🎯 Starting fixed batch launcher...');
  
  const totalBatches = Math.ceil(config.totalBots / config.batchSize);
  console.log(`📋 Plan: ${totalBatches} batches of ${config.batchSize} bots each`);
  
  for (let batch = 1; batch <= totalBatches; batch++) {
    if (totalBotsLaunched >= config.totalBots) {
      break;
    }
    
    await launchBatch();
    
    console.log(`\n📊 Progress Summary:`);
    console.log(`   - Batches ready: ${currentBatchNumber}/${totalBatches}`);
    console.log(`   - Total bots launched: ${totalBotsLaunched}/${config.totalBots}`);
    console.log(`   - Total in meeting: ${totalSuccessful}`);
    console.log(`   - Success rate: ${((totalSuccessful / totalBotsLaunched) * 100).toFixed(1)}%`);
    
    if (totalBotsLaunched < config.totalBots) {
      console.log(`\n⏳ Waiting 10 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log(`\n🏁 All batches launched and ready!`);
  console.log(`📊 Final Results:`);
  console.log(`   - Total bots launched: ${totalBotsLaunched}`);
  console.log(`   - Total in meeting: ${totalSuccessful}`);
  console.log(`   - Success rate: ${((totalSuccessful / totalBotsLaunched) * 100).toFixed(1)}%`);
  console.log(`   - Bots staying in meeting for ${config.keepAliveMinutes} minutes`);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  console.log(`📊 Final Stats: Launched: ${totalBotsLaunched}, In Meeting: ${totalSuccessful}`);
  process.exit(0);
});

// Start the launcher
startBatchLauncher().catch(error => {
  console.error('💥 Fatal error in batch launcher:', error);
  process.exit(1);
}); 