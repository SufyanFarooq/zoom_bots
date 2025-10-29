import puppeteer from 'puppeteer-core';
import fs from 'fs';

function getChromeExecutablePath() {
  const envPath = (process.env.CHROME_PATH || '').trim();
  if (envPath) return envPath;

  const candidates = [];
  if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else if (process.platform === 'win32') {
    candidates.push('C:/Program Files/Google/Chrome/Application/chrome.exe');
    candidates.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
  } else {
    // Linux
    candidates.push('/usr/bin/google-chrome-stable');
    candidates.push('/usr/bin/google-chrome');
    candidates.push('/usr/bin/chromium');
    candidates.push('/usr/bin/chromium-browser');
    candidates.push('/snap/bin/chromium');
    candidates.push('/opt/google/chrome/chrome');
  }

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return process.platform === 'win32' ? 'chrome.exe' : 'google-chrome';
}

// Configuration
const botName = process.argv[2];
const meetingId = process.argv[3].split('/').pop(); // Extract meeting ID from URL
const passcode = process.argv[4];
const keepAliveMinutes = parseInt(process.env.KEEP_ALIVE_MINUTES) || 5;

console.log(`🤖 Starting bot: ${botName} for meeting: ${meetingId}`);

async function joinZoomMeeting() {
  let browser;
  
  try {
    // Launch browser with detached mode
    const launchOptions = {
      headless: true, // Keep visible for debugging
      executablePath: getChromeExecutablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=30',  // Reduced from 50 to 30
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-video-capture',
        '--disable-video',
        '--remote-debugging-port=0',
        '--user-data-dir=/tmp/puppeteer_profile_' + Math.random().toString(36).substring(7),
        '--disable-javascript-harmony-shipping',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-web-resources',
        '--no-pings',
        '--process-per-tab',
        '--max-memory-usage=50'  // Limit memory to 50MB per process
      ]
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set permissions to deny microphone and camera
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://zoom.us', []);
    await context.overridePermissions('https://app.zoom.us', []);
    
    // Override getUserMedia to deny permissions
    await page.evaluateOnNewDocument(() => {
      // Override getUserMedia to deny video and audio
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error('Permission denied');
      };
      
      // Override permissions API
      if (navigator.permissions) {
        navigator.permissions.query = async () => {
          return { state: 'denied' };
        };
      }
    });

    // Navigate to Zoom join URL
    const zoomJoinUrl = `https://zoom.us/wc/join/${meetingId}`;
    console.log(`Navigating to: ${zoomJoinUrl}`);
    
    await page.goto(zoomJoinUrl, { waitUntil: 'networkidle2', timeout: 120000 });
    console.log(`Page loaded for ${botName}, waiting for form...`);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    
    // Handle cookie consent popup if present
    console.log(`Checking for cookie popup for ${botName}...`);
    try {
      const cookieAccepted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const acceptButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('accept') ||
          btn.textContent.toLowerCase().includes('accept cookies') ||
          btn.className.toLowerCase().includes('accept') ||
          btn.id.toLowerCase().includes('accept')
        );
        if (acceptButton) {
          acceptButton.click();
          return true;
        }
        return false;
      });
      
      if (cookieAccepted) {
        console.log(`Cookie popup accepted for ${botName}`);
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      }
    } catch (error) {
      console.log(`No cookie popup found for ${botName}`);
    }
    
    // Random delay before entering name
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Enter bot name
    console.log(`Entering name for ${botName}...`);
    try {
      await page.waitForSelector('input[type="text"]', { timeout: 30000 });
      await page.type('input[type="text"]', botName, { delay: 100 + Math.random() * 200 });
      console.log(`Name entered for ${botName}`);
    } catch (error) {
      console.log(`Name input not found for ${botName}, trying alternative selectors...`);
      try {
        await page.type('input[placeholder*="name"], input[name*="name"]', botName, { delay: 100 + Math.random() * 200 });
        console.log(`Name entered via alternative selector for ${botName}`);
      } catch (error2) {
        console.log(`Error for ${botName}: Name input not found`);
        throw new Error(`Name input not found for ${botName}`);
      }
    }
    
    // Helper to type passcode across main frame and iframes
    async function tryTypePasscodeAcrossFrames(timeoutMs = 8000) {
      const selectors = [
        '#input-for-pwd',
        'input[name="passcode"]',
        'input[name="pwd"]',
        'input[placeholder*="passcode" i]',
        'input[aria-label*="passcode" i]',
        'input[type="password"]',
        'input[type="text"][name*="pass"]'
      ];
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        // Main frame first
        for (const sel of selectors) {
          try {
            const handle = await page.$(sel);
            if (handle) {
              await handle.type(String(passcode), { delay: 80 + Math.random() * 120 });
              return true;
            }
          } catch {}
        }
        // Child frames
        for (const frame of page.frames()) {
          for (const sel of selectors) {
            try {
              const handle = await frame.$(sel);
              if (handle) {
                await handle.type(String(passcode), { delay: 80 + Math.random() * 120 });
                return true;
              }
            } catch {}
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return false;
    }

    // Try to enter passcode if visible pre-join; otherwise continue and retry later
    let passcodeTypedInitially = false;
    try {
      console.log(`Checking for passcode field (pre-join) for ${botName}...`);
      passcodeTypedInitially = await tryTypePasscodeAcrossFrames(3000);
      if (passcodeTypedInitially) {
        console.log(`Passcode entered (pre-join) for ${botName}`);
      } else {
        console.log(`Passcode field not visible yet for ${botName}; will try after clicking Join`);
      }
    } catch {}
    
    // Random delay before clicking join
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // Click Join button across frames
    console.log(`Looking for join button for ${botName}...`);
    async function clickJoinAcrossFrames() {
      try { await page.click('button[class*="join"]'); return true; } catch {}
      try { await page.click('button[type="submit"]'); return true; } catch {}
      try {
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const candidate = buttons.find(btn => {
            const text = (btn.textContent || '').toLowerCase();
            const cls = (btn.className || '').toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            return text.includes('join') || cls.includes('join') || cls.includes('submit') || aria.includes('join');
          });
          if (candidate) { candidate.click(); return true; }
          return false;
        });
        if (clicked) return true;
      } catch {}
      for (const frame of page.frames()) {
        try {
          const clicked = await frame.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const candidate = buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase();
              const cls = (btn.className || '').toLowerCase();
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              return text.includes('join') || cls.includes('join') || cls.includes('submit') || aria.includes('join');
            });
            if (candidate) { candidate.click(); return true; }
            return false;
          });
          if (clicked) return true;
        } catch {}
      }
      return false;
    }
    const joinClicked = await clickJoinAcrossFrames();
    if (joinClicked) {
      console.log(`Join button clicked for ${botName}`);
    } else {
      console.log(`Error for ${botName}: Join button not found`);
      throw new Error(`Join button not found for ${botName}`);
    }

    // Short wait, then if passcode wasn't typed pre-join, try now
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));
    if (!passcodeTypedInitially) {
      const typedAfterJoin = await tryTypePasscodeAcrossFrames(12000);
      if (typedAfterJoin) {
        console.log(`Passcode entered after Join click for ${botName}`);
        await new Promise(r => setTimeout(r, 500));
        const secondJoin = await clickJoinAcrossFrames();
        if (secondJoin) {
          console.log(`Join/Submit clicked after entering passcode for ${botName}`);
        }
      }
    }
    
    // Wait for navigation with longer timeout
    console.log(`Waiting for meeting to load for ${botName}...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL for ${botName}: ${currentUrl}`);
    
    // Wait a bit more to ensure we're actually in the meeting
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Handle microphone and camera permission popup
    console.log(`Checking for microphone/camera permission popup for ${botName}...`);
    try {
      const permissionHandled = await page.evaluate(() => {
        // Look for the permission popup
        const buttons = Array.from(document.querySelectorAll('button'));
        console.log('Found buttons after join:', buttons.map(b => b.textContent));
        
        // Look for "Continue without microphone and camera" button
        const continueWithoutButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('continue without microphone') ||
          btn.textContent.toLowerCase().includes('continue without camera') ||
          btn.textContent.toLowerCase().includes('join without audio') ||
          btn.textContent.toLowerCase().includes('join without video')
        );
        
        if (continueWithoutButton) {
          console.log('Found continue without microphone/camera button');
          continueWithoutButton.click();
          return true;
        }
        
        // Look for "Use microphone and camera" button (if we want to allow)
        const useMicButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('use microphone and camera') ||
          btn.textContent.toLowerCase().includes('allow microphone') ||
          btn.textContent.toLowerCase().includes('allow camera')
        );
        
        if (useMicButton) {
          console.log('Found use microphone/camera button');
          useMicButton.click();
          return true;
        }
        
        // Look for "OK" button for floating reactions popup
        const okButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('ok') &&
          btn.textContent.length <= 3
        );
        
        if (okButton) {
          console.log('Found OK button for popup');
          okButton.click();
          return true;
        }
        
        return false;
      });
      
      if (permissionHandled) {
        console.log(`Permission popup handled for ${botName}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log(`No permission popup found for ${botName}`);
      }
    } catch (error) {
      console.log(`Error handling permission popup for ${botName}: ${error.message}`);
    }
    
    // Wait longer for meeting to fully load
    console.log(`Waiting for meeting interface to fully load for ${botName}...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Handle any additional popups that might appear
    try {
      await page.evaluate(() => {
        // Close any notification bars or popups
        const closeButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        closeButtons.forEach(btn => {
          const text = btn.textContent.toLowerCase();
          if (text.includes('close') || text.includes('dismiss') || text.includes('×') || text === 'ok') {
            btn.click();
          }
        });
      });
    } catch (error) {
      console.log(`Error closing additional popups for ${botName}: ${error.message}`);
    }
    
    // Check URL again after waiting
    const finalUrl = page.url();
    console.log(`Final URL for ${botName}: ${finalUrl}`);
    
    // Skip screenshot to avoid delays - REMOVED FOR PERFORMANCE
    // try {
    //   await page.screenshot({ path: `debug_${botName}.png` });
    //   console.log(`Screenshot saved as debug_${botName}.png`);
    // } catch (e) {
    //   console.log(`Could not take screenshot: ${e.message}`);
    // }
    
    // Check if we're actually in the meeting by looking for meeting controls
    const inMeeting = await page.evaluate(() => {
      // Look for meeting controls like mute, video, participants buttons
      const meetingControls = document.querySelectorAll('[data-testid], [aria-label*="mute"], [aria-label*="video"], [aria-label*="participant"]');
      
      // Also check for participant count or meeting indicators
      const participantIndicators = document.querySelectorAll('[aria-label*="participant"], [class*="participant"], [data-testid*="participant"]');
      
      // Check for actual meeting interface elements
      const meetingInterface = document.querySelectorAll('[class*="meeting"], [class*="conference"], [id*="meeting"]');
      
      return {
        controls: meetingControls.length,
        participants: participantIndicators.length,
        interface: meetingInterface.length,
        url: window.location.href,
        title: document.title
      };
    });
    
    console.log(`Meeting validation for ${botName}:`, inMeeting);
    
    // Wait additional time to ensure stable connection
    console.log(`⏳ ${botName} waiting additional time to ensure stable connection...`);
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds extra wait
    
    // Final validation - check if still in meeting
    const finalValidation = await page.evaluate(() => {
      // Check if we're still connected to meeting
      const stillConnected = !document.querySelector('[class*="disconnected"], [class*="reconnect"], [class*="connection-error"]');
      const hasAudio = document.querySelector('[aria-label*="mute"], [class*="audio"]');
      const hasVideo = document.querySelector('[aria-label*="video"], [class*="video"]');
      
      return {
        connected: stillConnected,
        hasAudio: !!hasAudio,
        hasVideo: !!hasVideo,
        pageVisible: !document.hidden
      };
    });
    
    console.log(`Final validation for ${botName}:`, finalValidation);
    
    if ((finalUrl.includes('zoom.us/wc/') || finalUrl.includes('zoom.us/j/') || finalUrl.includes('app.zoom.us') || inMeeting.controls > 0) && finalValidation.connected) {
      console.log(`✅ ${botName} successfully joined and validated in meeting!`);
      
      // Keep alive for specified time
      console.log(`⏰ ${botName} will stay in meeting for ${keepAliveMinutes} minutes`);
      
      // Wait a bit more to ensure we're fully in the meeting
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Bot stays in meeting - NO process.exit()
      console.log(`✅ ${botName} successfully joined meeting and will stay for ${keepAliveMinutes} minutes`);
      
      // Keep the bot alive in the meeting
      setTimeout(() => {
        console.log(`👋 ${botName} leaving meeting after ${keepAliveMinutes} minutes`);
        process.exit(0);
      }, keepAliveMinutes * 60 * 1000);
      
      // Return success to indicate bot joined successfully
      return true;
      
    } else {
      console.log(`❌ ${botName} failed validation. URL: ${finalUrl}, Controls: ${inMeeting.controls}, Connected: ${finalValidation.connected}`);
      throw new Error(`Failed meeting validation for ${botName}`);
    }
    
  } catch (error) {
    console.log(`❌ Error for ${botName}: ${error.message}`);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.log(`❌ Error closing browser for ${botName}: ${e.message}`);
      }
    }
    process.exit(1);
  }
}

// Start the bot
joinZoomMeeting().catch(error => {
  console.error(`💥 Fatal error for ${botName}:`, error);
  process.exit(1);
}); 