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
    // Detect Chrome executable path
    let chromePath = process.env.CHROME_PATH;
    if (!chromePath) {
      // Try different possible Chrome paths (macOS first)
      const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/opt/google/chrome/chrome'
      ];
      
      for (const path of possiblePaths) {
        try {
          const { execSync } = await import('child_process');
          // For macOS app bundles, check if file exists directly
          if (path.includes('.app/')) {
            execSync(`test -f "${path}"`, { stdio: 'ignore' });
            chromePath = path;
            break;
          } else {
            // For system binaries, use which command
            execSync(`which ${path.split('/').pop()}`, { stdio: 'ignore' });
            chromePath = path;
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
    }

    console.log(`🔍 Using Chrome path: ${chromePath}`);

    // Enhanced launch options for Docker environment
    const launchOptions = {
      headless: true,
      executablePath: chromePath || getChromeExecutablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-zygote',
        '--memory-pressure-off',
        '--max_old_space_size=128',
        `--user-data-dir=/tmp/puppeteer_profile_${botName}_${Date.now()}`,
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--disable-audio-output',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-hang-monitor',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=TranslateUI',
        '--disable-features=BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--window-size=1024,768'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      ignoreHTTPSErrors: true,
      defaultViewport: { width: 1024, height: 768 },
      timeout: 120000,
      protocolTimeout: 120000
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set permissions: Allow camera (so video icon appears), deny microphone
    const context = browser.defaultBrowserContext();
    // Allow camera so Zoom shows video icon, deny microphone
    await context.overridePermissions('https://zoom.us', ['camera']);
    await context.overridePermissions('https://app.zoom.us', ['camera']);
    
    // Override getUserMedia: Provide video stream (so icon appears), then we'll stop it
    await page.evaluateOnNewDocument(() => {
      // Create a fake video stream - we'll provide it initially so Zoom shows the icon
      function createFakeVideoStream() {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // Draw a simple pattern (black background)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Capture stream at 30fps
        const stream = canvas.captureStream(30);
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          Object.defineProperty(videoTrack, 'label', { value: 'Fake Video Device', writable: false });
          Object.defineProperty(videoTrack, 'kind', { value: 'video', writable: false });
        }
        
        return stream;
      }
      
      // Store the original getUserMedia
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      
      // Override getUserMedia: Provide video (so icon appears), deny audio
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // Always deny audio
        if (constraints && constraints.audio) {
          constraints.audio = false;
        }
        
        // If video is requested, provide it (we'll stop it later in the UI)
        if (constraints && constraints.video) {
          // Return fake video stream - we'll stop it after joining
          const stream = createFakeVideoStream();
          return stream;
        }
        
        // If only audio requested, deny
        throw new Error('Audio permission denied');
      };
      
      // Override permissions API - allow camera (so icon appears), deny microphone
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async (permissionDesc) => {
          // Allow camera (so video icon appears in participant list)
          if (permissionDesc.name === 'camera') {
            return { state: 'granted' };
          }
          // Deny microphone
          if (permissionDesc.name === 'microphone') {
            return { state: 'denied' };
          }
          return originalQuery(permissionDesc);
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
    
    // Enter bot name with enhanced selectors
    console.log(`Entering name for ${botName}...`);
    
    // First, detect what type of Zoom page we're on
    const pageType = await page.evaluate(() => {
      const title = document.title;
      const url = window.location.href;
      const hasJoinForm = document.querySelector('form') !== null;
      const hasNameInput = document.querySelector('input[type="text"]') !== null;
      const bodyText = document.body.innerText;
      
      return {
        title,
        url,
        hasJoinForm,
        hasNameInput,
        bodyTextLength: bodyText.length,
        hasZoomBranding: bodyText.includes('Zoom') || bodyText.includes('zoom'),
        hasJoinButton: bodyText.includes('Join') || bodyText.includes('join')
      };
    });
    
    console.log(`🔍 Page analysis for ${botName}:`, JSON.stringify(pageType, null, 2));
    
    const nameSelectors = [
      // Primary selectors
      'input[type="text"]',
      'input[placeholder*="name" i]',
      'input[name*="name" i]',
      'input[id*="name" i]',
      'input[class*="name" i]',
      'input[aria-label*="name" i]',
      
      // Zoom-specific selectors
      '#input-for-name',
      '.name-input',
      'input[data-testid*="name" i]',
      'input[data-cy*="name" i]',
      'input[data-qa*="name" i]',
      
      // Generic form selectors
      'input:not([type="password"]):not([type="email"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
      'input[maxlength="64"]',
      'input[autocomplete="name"]',
      'input[autocomplete="given-name"]',
      'input[autocomplete="family-name"]',
      
      // Fallback selectors
      'input[size="30"]',
      'input[tabindex="1"]',
      'form input:first-of-type',
      '.form-control',
      '.input-field',
      '[contenteditable="true"]',
      
      // Last resort - any visible input
      'input[style*="display: block"]',
      'input:not([style*="display: none"]):not([style*="visibility: hidden"])'
    ];
    
    let nameEntered = false;
    
    for (const selector of nameSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        
        // Check if element is visible and interactable
        const element = await page.$(selector);
        const isVisible = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && 
                 window.getComputedStyle(el).visibility !== 'hidden' &&
                 window.getComputedStyle(el).display !== 'none';
        }, element);
        
        if (isVisible) {
          // Clear and type name
          await element.click({ clickCount: 3 });
          await element.press('Backspace');
          await element.type(botName, { delay: 100 + Math.random() * 200 });
          
          // Verify text was entered
          const value = await page.evaluate(el => el.value, element);
          if (value.includes(botName)) {
            console.log(`✅ Name entered successfully with selector: ${selector}`);
            nameEntered = true;
            break;
          }
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }
    
    if (!nameEntered) {
      console.log(`❌ Error for ${botName}: Name input not found with any selector`);
      
      // Take debug screenshot for failed bots
      try {
        const screenshot = await page.screenshot({ 
          path: `/tmp/debug-${botName}-${Date.now()}.png`,
          fullPage: true 
        });
        console.log(`📸 Debug screenshot saved for ${botName}`);
        
        // Also log page HTML for debugging
        const html = await page.content();
        console.log(`📝 Page HTML length for ${botName}: ${html.length} characters`);
        
        // Log all input elements found
        const inputs = await page.$$eval('input', elements => 
          elements.map(el => ({
            type: el.type,
            placeholder: el.placeholder,
            name: el.name,
            id: el.id,
            className: el.className,
            visible: el.offsetWidth > 0 && el.offsetHeight > 0
          }))
        );
        console.log(`🔍 Found ${inputs.length} input elements for ${botName}:`, JSON.stringify(inputs, null, 2));
        
      } catch (debugError) {
        console.log(`⚠️ Debug capture failed for ${botName}: ${debugError.message}`);
      }
      
      throw new Error(`Name input not found for ${botName}`);
    }
    
    // Random delay before entering passcode
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Enter passcode (if required)
    if (passcode && passcode.trim() !== '') {
      console.log(`Entering passcode for ${botName}...`);
      try {
        await page.waitForSelector('#input-for-pwd', { timeout: 10000 });
        await page.type('#input-for-pwd', passcode, { delay: 100 + Math.random() * 200 });
        console.log(`Passcode entered for ${botName}`);
      } catch (error) {
        console.log(`Passcode input not found for ${botName}, trying fallback...`);
        try {
          const passwordInput = await page.$('input[type="password"]');
          if (passwordInput) {
            await passwordInput.type(passcode, { delay: 100 + Math.random() * 200 });
            console.log(`Passcode entered via fallback for ${botName}`);
          } else {
            console.log(`No passcode field found for ${botName} - meeting may not require one`);
          }
        } catch (error2) {
          console.log(`No passcode field found for ${botName} - meeting may not require one`);
        }
      }
    } else {
      console.log(`No passcode provided for ${botName} - skipping passcode entry`);
    }
    
    // Random delay before clicking join
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // Click Join button
    console.log(`Looking for join button for ${botName}...`);
    try {
      const clickResult = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        console.log('Found buttons:', buttons.map(b => b.textContent));
        const joinButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('join') ||
          btn.className.toLowerCase().includes('join') ||
          btn.className.toLowerCase().includes('submit')
        );
        if (joinButton) {
          joinButton.click();
          return true;
        }
        return false;
      });
      if (clickResult) {
        console.log(`Join button clicked via page.evaluate for ${botName}`);
      } else {
        console.log(`No join button found for ${botName}`);
        throw new Error(`Join button not found for ${botName}`);
      }
    } catch (error) {
      console.log(`Direct click failed for ${botName}, trying page.evaluate...`);
      try {
        const clickResult = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          console.log('Found buttons:', buttons.map(b => b.textContent));
          const joinButton = buttons.find(btn => 
            btn.textContent.toLowerCase().includes('join') ||
            btn.className.toLowerCase().includes('join') ||
            btn.className.toLowerCase().includes('submit')
          );
          if (joinButton) {
            joinButton.click();
            return true;
          }
          return false;
        });
        if (clickResult) {
          console.log(`Join button clicked via page.evaluate for ${botName}`);
        } else {
          console.log(`No join button found for ${botName}`);
          throw new Error(`Join button not found for ${botName}`);
        }
      } catch (error2) {
        console.log(`Error for ${botName}: Join button not found`);
        throw new Error(`Join button not found for ${botName}`);
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
    
    // Handle microphone and camera permission popup - SELECT "Join with video" then disable it
    console.log(`Checking for microphone/camera permission popup for ${botName}...`);
    try {
      const permissionHandled = await page.evaluate(() => {
        // Look for the permission popup
        const buttons = Array.from(document.querySelectorAll('button'));
        console.log('Found buttons after join:', buttons.map(b => b.textContent));
        
        // PRIORITY: Look for "Join with video" or "Use microphone and camera" button
        // We'll accept video so the icon appears, then disable it
        const joinWithVideoButton = buttons.find(btn => {
          const text = btn.textContent.toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          return (text.includes('use microphone and camera') ||
                  text.includes('join with video') ||
                  text.includes('turn on video') ||
                  ariaLabel.includes('use microphone and camera') ||
                  ariaLabel.includes('join with video'));
        });
        
        if (joinWithVideoButton) {
          console.log('Found join with video button - clicking to initialize video (will disable later)');
          joinWithVideoButton.click();
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
        console.log(`Permission popup handled for ${botName} - video will be initialized then disabled`);
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
    
    // Disable video after it's been initialized (so icon appears but is crossed/disabled)
    // Try multiple times to ensure video is properly disabled
    console.log(`Disabling video for ${botName} so icon shows as crossed/disabled...`);
    
    // Wait a bit for meeting UI to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try disabling video multiple times with different methods
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Attempt ${attempt} to disable video for ${botName}...`);
        
        await page.evaluate(async () => {
          // Method 1: Stop all video tracks
          try {
            const streams = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            const videoTracks = streams.getVideoTracks();
            videoTracks.forEach(track => {
              track.enabled = false;
              track.stop();
            });
            console.log(`Stopped ${videoTracks.length} video track(s)`);
          } catch (e) {
            // Stream might not be available, try getting active tracks
            try {
              const mediaStreams = await navigator.mediaDevices.enumerateDevices();
              // Try to stop any active video tracks
            } catch (e2) {
              // Ignore
            }
          }
          
          // Method 2: Find and click "Stop Video" button multiple times
          const allButtons = Array.from(document.querySelectorAll('button, [role="button"], [data-testid*="video"], [data-testid*="camera"]'));
          
          // Try multiple selectors for video button
          const videoButtonSelectors = [
            btn => {
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              return (ariaLabel.includes('stop video') ||
                      ariaLabel.includes('turn off video') ||
                      ariaLabel.includes('disable video'));
            },
            btn => {
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              const text = btn.textContent.toLowerCase();
              return (ariaLabel.includes('video') || ariaLabel.includes('camera')) &&
                     (ariaLabel.includes('stop') || ariaLabel.includes('turn off') || text.includes('stop video'));
            },
            btn => {
              const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
              return dataTestId.includes('video') && (dataTestId.includes('stop') || dataTestId.includes('off'));
            }
          ];
          
          for (const selector of videoButtonSelectors) {
            const videoButton = allButtons.find(selector);
            if (videoButton) {
              console.log('Found video button, clicking to disable...');
              videoButton.click();
              await new Promise(resolve => setTimeout(resolve, 500));
              // Click again to ensure it's off
              videoButton.click();
              break;
            }
          }
          
          // Method 3: Try to find video button by checking if video is on
          const anyVideoButton = allButtons.find(btn => {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            return (ariaLabel.includes('video') || ariaLabel.includes('camera')) &&
                   !ariaLabel.includes('start') && !ariaLabel.includes('turn on');
          });
          
          if (anyVideoButton) {
            const ariaLabel = (anyVideoButton.getAttribute('aria-label') || '').toLowerCase();
            // If button says "Stop Video" or similar, video is on - click to turn off
            if (ariaLabel.includes('stop') || ariaLabel.includes('turn off')) {
              console.log('Video appears to be on, clicking to turn off...');
              anyVideoButton.click();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Method 4: Press 'v' key multiple times (Zoom shortcut to toggle video)
        await page.keyboard.press('v');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.keyboard.press('v'); // Press again to ensure it's off
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`Error in attempt ${attempt} to disable video for ${botName}: ${error.message}`);
      }
    }
    
    // Final check and disable
    try {
      await page.evaluate(() => {
        // One more time - find video button and ensure it's off
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const videoBtn = buttons.find(btn => {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          return (label.includes('video') || label.includes('camera')) &&
                 (label.includes('stop') || label.includes('turn off'));
        });
        if (videoBtn) {
          videoBtn.click();
        }
      });
    } catch (e) {
      // Ignore
    }
    
    console.log(`✅ Video disabled for ${botName} - icon should show as crossed/disabled`);
    
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
    
    // Reduced wait time - connection is already stable
    console.log(`⏳ ${botName} ensuring stable connection...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Reduced to 5 seconds
    
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
      
      // Minimal wait - already validated
      await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1 second
      
      // Bot stays in meeting - NO process.exit()
      console.log(`✅ ${botName} successfully joined meeting and will stay for ${keepAliveMinutes} minutes`);
      
      // Keep connection alive - periodic checks to prevent disconnection
      const keepAliveInterval = setInterval(async () => {
        try {
          // Check if still in meeting
          const stillConnected = await page.evaluate(() => {
            // Check for disconnection indicators
            const disconnected = document.querySelector('[class*="disconnected"], [class*="reconnect"], [class*="connection-error"]');
            const inMeeting = window.location.href.includes('zoom.us/wc/') || 
                            window.location.href.includes('zoom.us/j/') || 
                            window.location.href.includes('app.zoom.us');
            
            return !disconnected && inMeeting;
          });
          
          if (!stillConnected) {
            console.log(`⚠️  ${botName} appears disconnected. Attempting to stay connected...`);
            // Try to refresh or stay on page
            try {
              await page.evaluate(() => {
                // Keep page active
                if (document.hidden) {
                  document.dispatchEvent(new Event('visibilitychange'));
                }
              });
            } catch (e) {
              // Ignore
            }
          }
          
          // Keep video DISABLED - ensure it stays off and icon remains visible
          // Video icon should remain disabled/crossed like mic icon
          await page.evaluate(() => {
            // Method 1: Stop any active video tracks
            try {
              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                  .then(stream => {
                    stream.getVideoTracks().forEach(track => {
                      track.enabled = false;
                      track.stop();
                    });
                  })
                  .catch(() => {});
              }
            } catch (e) {}
            
            // Method 2: Check video button and ensure it's off
            const videoButtons = Array.from(document.querySelectorAll('button, [role="button"], [data-testid*="video"]'));
            const videoButton = videoButtons.find(btn => {
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
              return (ariaLabel.includes('video') || ariaLabel.includes('camera') || dataTestId.includes('video')) &&
                     !ariaLabel.includes('start') && !ariaLabel.includes('turn on');
            });
            
            // If video button shows video is on (says "Stop Video"), turn it off
            if (videoButton) {
              const ariaLabel = (videoButton.getAttribute('aria-label') || '').toLowerCase();
              const isVideoOn = ariaLabel.includes('stop') || ariaLabel.includes('turn off');
              if (isVideoOn) {
                videoButton.click();
              }
            }
          });
          
        } catch (error) {
          // Ignore errors in keep-alive checks
        }
      }, 30000); // Check every 30 seconds
      
      // Keep the bot alive in the meeting
      setTimeout(() => {
        clearInterval(keepAliveInterval);
        console.log(`👋 ${botName} leaving meeting after ${keepAliveMinutes} minutes`);
        process.exit(0);
      }, keepAliveMinutes * 60 * 1000);
      
      // Also keep page active to prevent timeout
      setInterval(async () => {
        try {
          // Small interaction to keep page active
          await page.evaluate(() => {
            // Dispatch a small event to keep page alive
            document.dispatchEvent(new Event('mousemove'));
          });
        } catch (e) {
          // Ignore
        }
      }, 60000); // Every minute
      
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