#!/usr/bin/env node

/**
 * Detailed Resource Report for Zoom Bots
 * Usage: node resource-report.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getResourceReport() {
  console.log('📊 Detailed Resource Report for Zoom Bots\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Get bot processes
    const { stdout: botProcesses } = await execAsync('ps aux | grep "botWrapper.js" | grep -v grep');
    const botCount = botProcesses.trim().split('\n').filter(l => l).length;

    // Get Chrome processes
    const { stdout: chromeProcesses } = await execAsync('ps aux | grep "puppeteer_profile" | grep -v grep');
    const chromeCount = chromeProcesses.trim().split('\n').filter(l => l).length;

    console.log(`🤖 Bot Processes: ${botCount}`);
    console.log(`🌐 Chrome Processes: ${chromeCount}\n`);

    // System resources
    const { stdout: memInfo } = await execAsync('free -h');
    const { stdout: cpuInfo } = await execAsync('nproc');
    const { stdout: loadAvg } = await execAsync('uptime');
    const { stdout: diskInfo } = await execAsync('df -h / | tail -1');

    console.log('💻 System Resources:');
    console.log(`   CPU Cores: ${cpuInfo.trim()}`);
    console.log(`   Load Average: ${loadAvg.split('load average:')[1]?.trim() || 'N/A'}`);
    
    const memLines = memInfo.split('\n');
    const memLine = memLines.find(l => l.startsWith('Mem:'));
    if (memLine) {
      const parts = memLine.split(/\s+/);
      console.log(`   RAM Total: ${parts[1]}`);
      console.log(`   RAM Used: ${parts[2]} (${parts[4]})`);
      console.log(`   RAM Available: ${parts[6]}`);
    }

    const diskParts = diskInfo.trim().split(/\s+/);
    console.log(`   Disk Total: ${diskParts[1]}`);
    console.log(`   Disk Used: ${diskParts[2]} (${diskParts[4]})`);
    console.log(`   Disk Available: ${diskParts[3]}\n`);

    // Per bot detailed stats
    let totalCpu = 0;
    let totalMem = 0;
    let totalRss = 0;
    
    if (botCount > 0) {
      console.log('📈 Per Bot Resource Usage:\n');
      
      const botLines = botProcesses.trim().split('\n');

      botLines.forEach((line, index) => {
        if (!line) return;
        
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        const cpu = parseFloat(parts[2]);
        const mem = parseFloat(parts[3]);
        const rss = parseInt(parts[5]); // RSS in KB
        const botName = parts[10] || 'Unknown';

        totalCpu += cpu;
        totalMem += mem;
        totalRss += rss;

        const rssMB = (rss / 1024).toFixed(2);
        const rssGB = (rss / 1024 / 1024).toFixed(3);

        console.log(`   Bot ${index + 1}: ${botName}`);
        console.log(`      PID: ${pid}`);
        console.log(`      CPU: ${cpu.toFixed(2)}%`);
        console.log(`      RAM: ${mem.toFixed(2)}% (${rssMB} MB / ${rssGB} GB)`);
        console.log('');
      });

      console.log('📊 Total Bot Resources:');
      console.log(`   Total CPU: ${totalCpu.toFixed(2)}%`);
      console.log(`   Total RAM: ${totalMem.toFixed(2)}%`);
      console.log(`   Total RSS: ${(totalRss / 1024).toFixed(2)} MB / ${(totalRss / 1024 / 1024).toFixed(3)} GB`);
      console.log('');
      console.log('📊 Average Per Bot:');
      console.log(`   CPU: ${(totalCpu / botCount).toFixed(2)}%`);
      console.log(`   RAM: ${(totalMem / botCount).toFixed(2)}%`);
      console.log(`   RSS: ${(totalRss / botCount / 1024).toFixed(2)} MB`);
      console.log('');
    }

    // Chrome processes stats
    if (chromeCount > 0) {
      console.log('🌐 Chrome Processes Resource Usage:\n');
      
      const chromeLines = chromeProcesses.trim().split('\n');
      let chromeCpu = 0;
      let chromeMem = 0;
      let chromeRss = 0;

      chromeLines.forEach((line) => {
        if (!line) return;
        
        const parts = line.trim().split(/\s+/);
        const cpu = parseFloat(parts[2]);
        const mem = parseFloat(parts[3]);
        const rss = parseInt(parts[5]);

        chromeCpu += cpu;
        chromeMem += mem;
        chromeRss += rss;
      });

      console.log(`   Total Chrome Processes: ${chromeCount}`);
      console.log(`   Total CPU: ${chromeCpu.toFixed(2)}%`);
      console.log(`   Total RAM: ${chromeMem.toFixed(2)}%`);
      console.log(`   Total RSS: ${(chromeRss / 1024).toFixed(2)} MB / ${(chromeRss / 1024 / 1024).toFixed(3)} GB`);
      console.log('');
      console.log(`   Average Per Chrome Process:`);
      console.log(`   CPU: ${(chromeCpu / chromeCount).toFixed(2)}%`);
      console.log(`   RAM: ${(chromeMem / chromeCount).toFixed(2)}%`);
      console.log(`   RSS: ${(chromeRss / chromeCount / 1024).toFixed(2)} MB`);
      console.log('');
    }

    // Scaling estimates
    if (botCount > 0 && totalCpu > 0) {
      const avgCpu = totalCpu / botCount;
      const avgMem = totalMem / botCount;
      const avgRss = totalRss / botCount;

      console.log('💡 Scaling Estimates:\n');
      
      [50, 100, 200, 500].forEach(numBots => {
        const estCpu = (avgCpu * numBots).toFixed(1);
        const estMem = (avgMem * numBots).toFixed(1);
        const estRss = (avgRss * numBots / 1024 / 1024).toFixed(2);
        console.log(`   ${numBots} bots: ~${estCpu}% CPU, ~${estMem}% RAM, ~${estRss} GB RSS`);
      });
    }

    console.log('\n════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    process.exit(1);
  }
}

getResourceReport();

