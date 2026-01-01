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

    // Set permissions: Allow video, deny audio (muted)
    const context = browser.defaultBrowserContext();
    // Allow camera (video) but not microphone (audio)
    await context.overridePermissions('https://zoom.us', ['camera']);
    await context.overridePermissions('https://app.zoom.us', ['camera']);
    
    // Override getUserMedia: Always provide video (fake if needed), deny audio
    await page.evaluateOnNewDocument(() => {
      // Create a fake video stream that Zoom will recognize
      function createFakeVideoStream() {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // Draw a simple pattern (black background)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some text to make it look like a video
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Video', canvas.width / 2, canvas.height / 2);
        
        // Capture stream at 30fps
        const stream = canvas.captureStream(30);
        
        // Ensure video track has proper properties and is ACTIVE
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
          videoTrack.muted = false; // Ensure not muted
          videoTrack.readyState = 'live'; // Set to live state
          
          // Set constraints to make it look like a real camera
          Object.defineProperty(videoTrack, 'label', { value: 'Fake Video Device', writable: false });
          Object.defineProperty(videoTrack, 'kind', { value: 'video', writable: false });
          
          // Override stop to prevent accidental stopping
          const originalStop = videoTrack.stop.bind(videoTrack);
          videoTrack.stop = function() {
            // Don't actually stop, just log
            console.log('Video track stop called but ignored');
          };
        }
        
        return stream;
      }
      
      // Override getUserMedia to always provide video (fake), deny audio
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // Always deny audio
        if (constraints && constraints.audio) {
          constraints.audio = false;
        }
        
        // If video is requested, always provide it (fake stream) - ENABLED
        if (constraints && constraints.video) {
          // Always return fake video stream (works in headless mode)
          const stream = createFakeVideoStream();
          
          // Ensure video track is ACTIVE and ENABLED (not disabled)
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.enabled = true;
            videoTrack.muted = false;
            
            // Force video to be active state
            try {
              Object.defineProperty(videoTrack, 'readyState', {
                value: 'live',
                writable: false,
                configurable: true
              });
            } catch (e) {
              // Some browsers don't allow setting readyState
            }
            
            // Monitor and prevent video from being disabled
            videoTrack.addEventListener('ended', () => {
              console.log('Video track ended, recreating...');
              const newStream = createFakeVideoStream();
              stream.getVideoTracks().forEach(t => {
                try { t.stop(); } catch (e) {}
              });
              const newTrack = newStream.getVideoTracks()[0];
              if (newTrack) {
                newTrack.enabled = true;
                newTrack.muted = false;
                stream.addTrack(newTrack);
              }
            });
          }
          
          // If audio was also requested, add empty audio track (muted)
          if (constraints.audio) {
            // Create silent audio track
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 0; // Muted
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.start();
              
              const audioStream = audioContext.createMediaStreamDestination();
              stream.addTrack(audioStream.stream.getAudioTracks()[0]);
            } catch (e) {
              // Audio context creation failed, that's fine
            }
          }
          
          return stream;
        }
        
        // If only audio requested, deny
        throw new Error('Audio permission denied');
      };
      
      // Override permissions API - always allow camera, deny microphone
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async (permissionDesc) => {
          if (permissionDesc.name === 'camera') {
            return { state: 'granted' };
          }
          if (permissionDesc.name === 'microphone') {
            return { state: 'denied' };
          }
          return originalQuery(permissionDesc);
        };
      }
      
      // Also override mediaDevices.enumerateDevices to show video device
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = async () => {
          const devices = await originalEnumerate();
          // Ensure video device is listed
          const hasVideo = devices.some(d => d.kind === 'videoinput');
          if (!hasVideo) {
            devices.push({
              deviceId: 'fake-video-device',
              kind: 'videoinput',
              label: 'Fake Video Device',
              groupId: 'fake-group'
            });
          }
          return devices;
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
    
    // Enable video in Zoom UI if it's disabled
    try {
      console.log(`Ensuring video is enabled for ${botName}...`);
      await page.evaluate(() => {
        // Look for video button and enable it if disabled
        const videoButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const videoButton = videoButtons.find(btn => {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const text = btn.textContent.toLowerCase();
          return (ariaLabel.toLowerCase().includes('video') || 
                  ariaLabel.toLowerCase().includes('camera') ||
                  text.includes('video') ||
                  text.includes('camera')) &&
                 !ariaLabel.toLowerCase().includes('stop');
        });
        
        if (videoButton) {
          // Check if video is currently off
          const isVideoOff = videoButton.getAttribute('aria-label')?.toLowerCase().includes('start') ||
                            videoButton.getAttribute('aria-label')?.toLowerCase().includes('turn on') ||
                            videoButton.classList.toString().toLowerCase().includes('off');
          
          if (isVideoOff) {
            console.log('Video is off, enabling...');
            videoButton.click();
          }
        }
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`Error enabling video for ${botName}: ${error.message}`);
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
          
          // Keep video stream active and ensure it's enabled in Zoom UI
          await page.evaluate(() => {
            // Ensure video track is still enabled
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              // Video should already be active, but ensure it stays that way
            }
            
            // Check and enable video button in Zoom if it got disabled
            const videoButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const videoButton = videoButtons.find(btn => {
              const ariaLabel = btn.getAttribute('aria-label') || '';
              return (ariaLabel.toLowerCase().includes('video') || 
                      ariaLabel.toLowerCase().includes('camera')) &&
                     !ariaLabel.toLowerCase().includes('stop');
            });
            
            if (videoButton) {
              const isVideoOff = videoButton.getAttribute('aria-label')?.toLowerCase().includes('start') ||
                                videoButton.getAttribute('aria-label')?.toLowerCase().includes('turn on');
              if (isVideoOff) {
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