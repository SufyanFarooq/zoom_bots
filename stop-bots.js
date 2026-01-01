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
  
  // Step 2: Kill Chrome processes with puppeteer profiles (improved for large numbers)
  console.log('\n🧹 Cleaning up Chrome processes...');
  
  try {
    // Use pgrep for better performance with large process lists
    const { stdout: chromePids } = await execAsync('pgrep -f "puppeteer_profile"', { 
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (chromePids.trim()) {
      const pids = chromePids.trim().split('\n').filter(pid => pid);
      console.log(`   Found ${pids.length} Chrome process(es) with puppeteer profiles...`);
      
      // Kill in batches to avoid overwhelming the system
      const batchSize = 50; // Increased batch size
      for (let i = 0; i < pids.length; i += batchSize) {
        const batch = pids.slice(i, i + batchSize);
        await Promise.all(
          batch.map(pid => 
            execAsync(`kill -9 ${pid} 2>/dev/null`).catch(() => {})
          )
        );
        if (i + batchSize < pids.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      console.log(`   ✅ Killed ${pids.length} Chrome processes`);
    } else {
      console.log('   ✅ No Chrome processes with puppeteer profiles found.');
    }
  } catch (error) {
    if (error.code === 1) {
      // No processes found - that's fine
      console.log('   ✅ No Chrome processes found.');
    } else {
      console.log('   ⚠️  Error finding Chrome processes, trying alternative method...');
      // Fallback: Use pkill directly
      try {
        await execAsync('pkill -9 -f "puppeteer_profile" 2>/dev/null || true');
        console.log('   ✅ Force killed Chrome processes');
      } catch (e) {
        // Ignore
      }
    }
  }
  
  // Step 3: Force kill any remaining processes (multiple methods)
  console.log('\n🔪 Force killing any remaining processes...');
  
  // Method 1: pkill (fastest for large numbers)
  try {
    await execAsync('pkill -9 -f "botWrapper.js" 2>/dev/null || true');
    await execAsync('pkill -9 -f "puppeteer_profile" 2>/dev/null || true');
    await execAsync('pkill -9 -f "chrome.*--no-sandbox" 2>/dev/null || true');
    await execAsync('pkill -9 -f "Google Chrome.*zoom" 2>/dev/null || true');
  } catch (error) {
    // Ignore
  }
  
  // Method 2: Kill by process name pattern
  try {
    await execAsync('killall -9 chrome 2>/dev/null || true');
  } catch (error) {
    // Ignore - some Chrome processes may not be killable
  }
  
  // Wait for processes to terminate
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 4: Final verification (using pgrep for better performance)
  console.log('\n🔍 Verifying all processes stopped...');
  try {
    // Use pgrep instead of ps aux for better performance
    let remainingCount = 0;
    
    try {
      const { stdout: botPids } = await execAsync('pgrep -f "botWrapper.js" 2>/dev/null || true', {
        maxBuffer: 10 * 1024 * 1024
      });
      if (botPids.trim()) {
        remainingCount += botPids.trim().split('\n').filter(l => l).length;
      }
    } catch (e) {
      // No bots found
    }
    
    try {
      const { stdout: chromePids } = await execAsync('pgrep -f "puppeteer_profile" 2>/dev/null || true', {
        maxBuffer: 10 * 1024 * 1024
      });
      if (chromePids.trim()) {
          remainingCount += chromePids.trim().split('\n').filter(l => l).length;
      }
    } catch (e) {
      // No Chrome processes found
    }
    
    if (remainingCount > 0) {
      console.log(`   ⚠️  ${remainingCount} process(es) may still be running. Final cleanup...`);
      
      // Final aggressive cleanup
      await execAsync('pkill -9 -f "botWrapper" 2>/dev/null || true');
      await execAsync('pkill -9 -f "puppeteer" 2>/dev/null || true');
      await execAsync('killall -9 chrome 2>/dev/null || true');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check one more time
      try {
        const { stdout: finalCheck } = await execAsync('pgrep -f "botWrapper|puppeteer_profile" 2>/dev/null || true', {
          maxBuffer: 10 * 1024 * 1024
        });
        if (finalCheck.trim()) {
          const stillRunning = finalCheck.trim().split('\n').filter(l => l).length;
          console.log(`   ⚠️  ${stillRunning} process(es) still running. They may be stuck.`);
        } else {
          console.log('   ✅ All processes stopped successfully!');
        }
      } catch (e) {
        console.log('   ✅ All processes stopped!');
      }
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
