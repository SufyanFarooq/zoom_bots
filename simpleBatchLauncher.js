import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  meetingURL: process.env.MEETING_URL || 'https://zoom.us/wc/join/123456789',
  passcode: process.env.MEETING_PASSCODE || '',
  totalBots: parseInt(process.env.TOTAL_BOTS) || 50,
  batchSize: parseInt(process.env.MAX_CONCURRENT) || 5,
  delayBetweenBots: parseInt(process.env.DELAY_MS) || 8000,
  keepAliveMinutes: parseInt(process.env.KEEP_ALIVE_MINUTES) || 30
};

console.log('🚀 Simple Batch Launcher');
console.log(`📊 Configuration:`);
console.log(`   - Total Bots: ${config.totalBots}`);
console.log(`   - Batch Size: ${config.batchSize}`);
console.log(`   - Delay Between Bots: ${config.delayBetweenBots}ms`);
console.log(`   - Keep Alive: ${config.keepAliveMinutes} minutes`);
console.log(`   - Meeting: ${config.meetingURL}`);

// Track bots
let totalBotsLaunched = 0;
let totalSuccessful = 0;
let currentBatchNumber = 0;
let currentBatchBots = [];

// Generate realistic Pakistani names
function generateRealName() {
  const firstNames = [
    'Ali', 'Sara', 'Omar', 'Ayesha', 'Zain', 'Fatima', 'Usman', 'Hira', 'Bilal', 'Mina',
    'Hamza', 'Noor', 'Danish', 'Iqra', 'Saad', 'Sana', 'Raza', 'Mariam', 'Tariq', 'Laila'
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
  
  const env = {
    ...process.env,
    KEEP_ALIVE_MINUTES: config.keepAliveMinutes.toString(),
    ...(process.env.CHROME_PATH ? { CHROME_PATH: process.env.CHROME_PATH } : {})
  };

  const botProcess = spawn('node', ['botWrapper.js', botName, config.meetingURL, config.passcode], {
    detached: true,
    stdio: 'ignore',
    env: env,
    cwd: __dirname
  });

  const botInfo = {
    name: botName,
    pid: botProcess.pid,
    startTime: Date.now(),
    status: 'running'
  };

  currentBatchBots.push(botInfo);

  botProcess.on('exit', (code) => {
    const duration = Math.round((Date.now() - botInfo.startTime) / 1000);
    if (code === 0) {
      console.log(`✅ ${botInfo.name} joined successfully (${duration}s)`);
      botInfo.status = 'success';
      totalSuccessful++;
    } else {
      console.log(`❌ ${botInfo.name} failed (${duration}s)`);
      botInfo.status = 'failed';
    }
  });

  // Mark as successful after 120 seconds if still running
  setTimeout(() => {
    if (botInfo.status === 'running') {
      console.log(`✅ ${botInfo.name} assumed successful (running 120s)`);
      botInfo.status = 'success';
      totalSuccessful++;
    }
  }, 120000); // 120 seconds - longer time to ensure actual join

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
  
  // Wait for this batch to complete
  await waitForBatchCompletion();
}

// Wait for current batch to complete
async function waitForBatchCompletion() {
  console.log(`⏳ Waiting for Batch ${currentBatchNumber} to complete...`);
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const completed = currentBatchBots.filter(bot => bot.status !== 'running');
      const successful = currentBatchBots.filter(bot => bot.status === 'success');
      
      console.log(`📊 Batch ${currentBatchNumber} Status: ${successful.length} successful, ${completed.length} completed out of ${currentBatchBots.length}`);
      
      if (completed.length >= currentBatchBots.length) {
        clearInterval(checkInterval);
        const successRate = (successful.length / completed.length) * 100;
        console.log(`✅ Batch ${currentBatchNumber} completed! Success: ${successful.length}/${completed.length} (${successRate.toFixed(1)}%)`);
        console.log(`📈 Total bots in meeting: ${totalSuccessful}`);
        resolve();
      }
    }, 5000); // Check every 5 seconds
  });
}

// Main launcher function
async function startBatchLauncher() {
  console.log('\n🎯 Starting batch launcher...');
  
  const totalBatches = Math.ceil(config.totalBots / config.batchSize);
  console.log(`📋 Plan: ${totalBatches} batches of ${config.batchSize} bots each`);
  
  for (let batch = 1; batch <= totalBatches; batch++) {
    if (totalBotsLaunched >= config.totalBots) {
      break;
    }
    
    await launchBatch();
    
    console.log(`\n📊 Progress Summary:`);
    console.log(`   - Batches completed: ${currentBatchNumber}/${totalBatches}`);
    console.log(`   - Total bots launched: ${totalBotsLaunched}/${config.totalBots}`);
    console.log(`   - Total successful: ${totalSuccessful}`);
    console.log(`   - Bots in meeting: ${totalSuccessful}`);
    
    if (totalBotsLaunched < config.totalBots) {
      console.log(`\n⏳ Waiting 10 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log(`\n🏁 All batches completed!`);
  console.log(`📊 Final Results:`);
  console.log(`   - Total bots launched: ${totalBotsLaunched}`);
  console.log(`   - Total successful: ${totalSuccessful}`);
  console.log(`   - Bots currently in meeting: ${totalSuccessful}`);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  console.log(`📊 Final Stats: Launched: ${totalBotsLaunched}, Successful: ${totalSuccessful}`);
  process.exit(0);
});

// Start the launcher
startBatchLauncher().catch(error => {
  console.error('💥 Fatal error in batch launcher:', error);
  process.exit(1);
}); 