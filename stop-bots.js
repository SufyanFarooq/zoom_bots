#!/usr/bin/env node

/**
 * Stop all running Zoom bot processes and Chrome instances
 * Usage: node stop-bots.js
 *        npm run stop
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function stopAllBots() {
  console.log('🛑 Stopping all Zoom bots and Chrome processes...\n');
  
  // Step 1: Kill bot processes
  try {
    const { stdout } = await execAsync('ps aux | grep "botWrapper.js" | grep -v grep');
    
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const pids = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[1];
      }).filter(pid => pid);
      
      console.log(`📋 Found ${pids.length} bot process(es):`);
      pids.forEach(pid => {
        const line = lines.find(l => l.includes(pid));
        const botName = line.match(/botWrapper\.js\s+(\S+)/)?.[1] || 'Unknown';
        console.log(`   - PID ${pid}: ${botName}`);
      });
      
      console.log('\n🔪 Killing bot processes...');
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid} 2>/dev/null`);
        } catch (error) {
          // Ignore
        }
      }
      console.log('   ✅ Bot processes killed');
    } else {
      console.log('✅ No bot processes found.');
    }
  } catch (error) {
    // No bot processes - that's fine
    console.log('✅ No bot processes found.');
  }
  
  // Step 2: Kill Chrome processes with puppeteer profiles
  console.log('\n🧹 Cleaning up Chrome processes...');
  
  try {
    // Find Chrome processes with puppeteer profiles
    const { stdout: chromeProcesses } = await execAsync('ps aux | grep "puppeteer_profile" | grep -v grep');
    
    if (chromeProcesses.trim()) {
      const chromeLines = chromeProcesses.trim().split('\n');
      const chromePids = chromeLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[1];
      }).filter(pid => pid);
      
      console.log(`   Found ${chromePids.length} Chrome process(es) with puppeteer profiles...`);
      
      // Kill in batches to avoid overwhelming the system
      const batchSize = 20;
      for (let i = 0; i < chromePids.length; i += batchSize) {
        const batch = chromePids.slice(i, i + batchSize);
        await Promise.all(
          batch.map(pid => 
            execAsync(`kill -9 ${pid} 2>/dev/null`).catch(() => {})
          )
        );
        if (i + batchSize < chromePids.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`   ✅ Killed ${chromePids.length} Chrome processes`);
    } else {
      console.log('   ✅ No Chrome processes with puppeteer profiles found.');
    }
  } catch (error) {
    if (error.code !== 1) {
      console.log('   ⚠️  Error finding Chrome processes:', error.message);
    }
  }
  
  // Step 3: Force kill any remaining processes
  console.log('\n🔪 Force killing any remaining processes...');
  try {
    await execAsync('pkill -9 -f "botWrapper.js" 2>/dev/null || true');
    await execAsync('pkill -9 -f "puppeteer_profile" 2>/dev/null || true');
    await execAsync('pkill -9 -f "chrome.*--no-sandbox" 2>/dev/null || true');
  } catch (error) {
    // Ignore
  }
  
  // Wait for processes to terminate
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 4: Final verification
  console.log('\n🔍 Verifying all processes stopped...');
  try {
    const { stdout: botCheck } = await execAsync('ps aux | grep "botWrapper.js" | grep -v grep');
    const { stdout: chromeCheck } = await execAsync('ps aux | grep "puppeteer_profile" | grep -v grep');
    
    if (botCheck.trim() || chromeCheck.trim()) {
      const remaining = (botCheck.trim().split('\n').filter(l => l).length) + 
                       (chromeCheck.trim().split('\n').filter(l => l).length);
      console.log(`   ⚠️  ${remaining} process(es) may still be running. Trying final cleanup...`);
      await execAsync('pkill -9 -f "botWrapper.js" 2>/dev/null || true');
      await execAsync('pkill -9 -f "puppeteer_profile" 2>/dev/null || true');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('   ✅ All processes stopped successfully!');
    }
  } catch (error) {
    // All clean
    console.log('   ✅ All processes stopped!');
  }
  
  console.log('\n✅ Cleanup completed!');
}

// Run
stopAllBots().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
