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

    // Chrome path detected (no log for performance)

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
        '--window-size=1024,768',
        // Memory optimization flags (NEW)
        '--disable-software-rasterizer',
        '--disable-2d-canvas-image-chromium',
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-video-decode',
        '--disable-accelerated-video-encode',
        '--disable-canvas-aa',
        '--disable-composited-antialiasing',
        '--disable-gl-drawing-for-tests',
        '--disable-lcd-text',
        '--disable-partial-raster',
        '--disable-skia-runtime-opts',
        '--disable-threaded-animation',
        '--disable-threaded-scrolling',
        '--disable-checker-imaging',
        '--disable-new-content-rendering-timeout',
        '--disable-features=UseChromeOSDirectVideoDecoder',
        '--disable-features=VaapiVideoDecoder',
        '--disable-features=UseSkiaRenderer',
        '--disable-features=CanvasOopRasterization',
        '--js-flags=--max-old-space-size=128',
        '--renderer-process-limit=2',
        '--max-active-webgl-contexts=1',
        '--process-per-site',
        '--disable-site-isolation-trials',
        '--disable-features=IsolateOrigins,site-per-process',
        '--aggressive-cache-discard',
        '--memory-pressure-off',
        '--disable-features=AudioServiceOutOfProcess'
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
    await context.overridePermissions('https://zoom.us', ['camera']);
    await context.overridePermissions('https://app.zoom.us', ['camera']);
    
    // Override getUserMedia: Create video stream with DISABLED track from start
    await page.evaluateOnNewDocument(() => {
      // Create fake video stream function
      function createFakeVideoStream() {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const stream = canvas.captureStream(30);
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          Object.defineProperty(videoTrack, 'label', { value: 'Fake Video Device', writable: false });
          Object.defineProperty(videoTrack, 'kind', { value: 'video', writable: false });
          // CRITICAL: Create ENABLED track first (so Zoom detects it and shows icon)
          // We'll disable it immediately after joining
          videoTrack.enabled = true;
          videoTrack.muted = false;
        }
        return stream;
      }
      
      // Create navigator.mediaDevices if it doesn't exist
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
      }
      
      // Override getUserMedia: Provide video stream with ENABLED track (we'll disable after joining)
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints && constraints.video) {
          const stream = createFakeVideoStream();
          window.localStream = stream;
          window.fakeVideoStream = stream;
          return stream; // Return stream with ENABLED track (so icon appears)
        }
        throw new Error('Audio permission denied');
      };
      
      // Override enumerateDevices to list fake video device
      if (navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = async () => {
          const devices = await originalEnumerateDevices();
          const hasVideoDevice = devices.some(d => d.kind === 'videoinput');
          if (!hasVideoDevice) {
            devices.push({
              deviceId: 'fake-video-device',
              kind: 'videoinput',
              label: 'Fake Video Device',
              groupId: 'fake-video-group'
            });
          }
          return devices;
        };
      }
      
      // Override permissions API - allow camera, deny microphone
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async (permissionDesc) => {
          if (permissionDesc.name === 'camera') return { state: 'granted' };
          if (permissionDesc.name === 'microphone') return { state: 'denied' };
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
    
    // Page type detected (no log for performance)
    
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
        // Trying selector (no log for performance)
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
        // Input elements found (no log for performance)
        
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
    
    // Wait for meeting to load (minimal wait for speed)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Handle permission popup: Click "Use camera" to initialize video, then disable it
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await page.evaluate((attemptNum) => {
          // Priority 1: Click "Use camera" or "Join with video" to initialize video icon
          const permissionDialog = document.querySelector('.pepc-permission-dialog') || 
                                  document.querySelector('[class*="permission-dialog"]');
          
          if (permissionDialog) {
            // Look for <permission type="camera"> element
            const useCameraButton = permissionDialog.querySelector('permission[type="camera"]') ||
                                   Array.from(permissionDialog.querySelectorAll('button')).find(btn => {
                                     const text = (btn.textContent || '').toLowerCase();
                                     const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                                     return text.includes('use camera') || text.includes('join with video') ||
                                            ariaLabel.includes('use camera') || ariaLabel.includes('join with video');
                                   });
            
            if (useCameraButton) {
              useCameraButton.click();
              return { handled: true, action: 'use_camera_clicked' };
            }
          }
          
          // Fallback: Look for permission element anywhere
          const permissionElement = document.querySelector('permission[type="camera"]');
          if (permissionElement) {
            permissionElement.click();
            return { handled: true, action: 'permission_element_clicked' };
          }
          
          return { handled: false, action: null };
        }, attempt);
        
        if (result && result.handled) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for video to initialize
          break;
        }
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (e) {
        // Continue
      }
    }
    
    // NOW disable video immediately after it's initialized - MULTIPLE AGGRESSIVE ATTEMPTS
    for (let disableAttempt = 1; disableAttempt <= 5; disableAttempt++) {
      try {
        const disableResult = await page.evaluate((attemptNum) => {
          const logs = [];
          let videoDisabled = false;
          
          // Method 1: Permanently stop all video tracks
          try {
            if (window.localStream || window.fakeVideoStream) {
              const stream = window.localStream || window.fakeVideoStream;
              const videoTracks = stream.getVideoTracks();
              logs.push(`[Attempt ${attemptNum}] Found ${videoTracks.length} video track(s)`);
              
              videoTracks.forEach(track => {
                track.enabled = false;
                track.muted = true;
                track.stop(); // PERMANENTLY stop - prevents re-enabling
                logs.push(`[Attempt ${attemptNum}] Stopped video track: ${track.label || 'unknown'}`);
              });
            }
          } catch (e) {
            logs.push(`[Attempt ${attemptNum}] Error stopping tracks: ${e.message}`);
          }
          
          // Method 2: Find and click "Stop Video" button - try ALL possible selectors
          try {
            const allButtons = Array.from(document.querySelectorAll('button, [role="button"], [data-testid*="video"], [data-testid*="camera"]'));
            logs.push(`[Attempt ${attemptNum}] Found ${allButtons.length} buttons`);
            
            // Try multiple selectors for video button
            const videoButtonSelectors = [
              // Exact "Stop Video" or "Turn off video"
              btn => {
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                return ariaLabel.includes('stop video') || ariaLabel.includes('turn off video');
              },
              // Any video button that says "stop" or "off"
              btn => {
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                const text = btn.textContent.toLowerCase();
                return (ariaLabel.includes('video') || ariaLabel.includes('camera')) &&
                       (ariaLabel.includes('stop') || ariaLabel.includes('off') || text.includes('stop'));
              },
              // By data-testid
              btn => {
                const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
                return dataTestId.includes('video') && (dataTestId.includes('stop') || dataTestId.includes('off'));
              },
              // By class name containing video and stop/off
              btn => {
                const className = btn.className.toLowerCase();
                return (className.includes('video') || className.includes('camera')) &&
                       (className.includes('stop') || className.includes('off'));
              }
            ];
            
            for (const selector of videoButtonSelectors) {
              const videoButton = allButtons.find(selector);
              if (videoButton && !videoButton.disabled) {
                const ariaLabel = videoButton.getAttribute('aria-label') || '';
                logs.push(`[Attempt ${attemptNum}] Found video button: "${ariaLabel}"`);
                
                // Click multiple times to ensure it's off
                videoButton.click();
                logs.push(`[Attempt ${attemptNum}] Clicked video button`);
                videoDisabled = true;
                
                // Also try dispatching events
                videoButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                break;
              }
            }
            
            if (!videoDisabled) {
              logs.push(`[Attempt ${attemptNum}] No "Stop Video" button found`);
            }
          } catch (e) {
            logs.push(`[Attempt ${attemptNum}] Error finding button: ${e.message}`);
          }
          
          // Method 3: Press 'v' key multiple times (Zoom shortcut)
          try {
            for (let i = 0; i < 3; i++) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', keyCode: 86, bubbles: true, cancelable: true }));
              document.dispatchEvent(new KeyboardEvent('keyup', { key: 'v', code: 'KeyV', keyCode: 86, bubbles: true, cancelable: true }));
            }
            logs.push(`[Attempt ${attemptNum}] Pressed 'v' key 3 times`);
          } catch (e) {
            logs.push(`[Attempt ${attemptNum}] Error pressing key: ${e.message}`);
          }
          
          return { logs, videoDisabled };
        }, disableAttempt);
        
        // Log results
        if (disableResult && disableResult.logs) {
          disableResult.logs.forEach(log => console.log(`🎥 [${botName}] ${log}`));
        }
        
        // Wait before next attempt
        if (disableAttempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        // Continue to next attempt
      }
    }
    
    // Also press 'v' key from Puppeteer side multiple times
    try {
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('v');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (e) {
      // Silent fail
    }
    
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
    
    // Quick validation
    const finalUrl = page.url();
    const inMeeting = await page.evaluate(() => {
      const stillConnected = !document.querySelector('[class*="disconnected"], [class*="reconnect"]');
      return { connected: stillConnected };
    });
    
    if ((finalUrl.includes('zoom.us/wc/') || finalUrl.includes('zoom.us/j/') || finalUrl.includes('app.zoom.us')) && inMeeting.connected) {
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