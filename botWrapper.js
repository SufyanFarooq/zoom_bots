import puppeteer from 'puppeteer-core';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

function getChromeExecutablePath() {
  // Check multiple environment variable names
  const envPath = (process.env.CHROME_PATH || 
                   process.env.PUPPETEER_EXECUTABLE_PATH || 
                   process.env.CHROMIUM_PATH || '').trim();
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
    // Detect Chrome executable path - check multiple environment variable names
    let chromePath = process.env.CHROME_PATH || 
                     process.env.PUPPETEER_EXECUTABLE_PATH || 
                     process.env.CHROMIUM_PATH;
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

    // ========== BROWSER DETECTION & LOGGING ==========
    console.log(`\n🔍 ========== BROWSER DETECTION [${botName}] ==========`);
    
    // Get browser version
    try {
      const browserVersion = await browser.version();
      console.log(`🌐 Browser Version: ${browserVersion}`);
    } catch (e) {
      console.log(`⚠️ Could not get browser version: ${e.message}`);
    }
    
    // Get Chrome executable path info
    try {
      const { execSync } = await import('child_process');
      const detectedChromePath = chromePath || getChromeExecutablePath();
      console.log(`📍 Chrome Executable: ${detectedChromePath}`);
      
      // Get Chrome version from command line (handle spaces in path)
      try {
        const chromeVersion = execSync(`"${detectedChromePath}" --version`, { encoding: 'utf-8', timeout: 5000 }).trim();
        console.log(`🔧 Chrome CLI Version: ${chromeVersion}`);
      } catch (e) {
        // Try without quotes if path has no spaces
        try {
          const chromeVersion = execSync(`${detectedChromePath} --version`, { encoding: 'utf-8', timeout: 5000 }).trim();
          console.log(`🔧 Chrome CLI Version: ${chromeVersion}`);
        } catch (e2) {
          console.log(`⚠️ Could not get Chrome CLI version: ${e2.message}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ Could not get Chrome path info: ${e.message}`);
    }
    
    // Get user agent
    try {
      const userAgent = await page.evaluate(() => navigator.userAgent);
      console.log(`👤 User Agent: ${userAgent}`);
    } catch (e) {
      console.log(`⚠️ Could not get user agent: ${e.message}`);
    }
    
    // Get platform info
    try {
      const platformInfo = await page.evaluate(() => ({
        platform: navigator.platform,
        vendor: navigator.vendor,
        language: navigator.language,
        languages: navigator.languages,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory || 'N/A',
        maxTouchPoints: navigator.maxTouchPoints || 0
      }));
      console.log(`💻 Platform Info:`, JSON.stringify(platformInfo, null, 2));
    } catch (e) {
      console.log(`⚠️ Could not get platform info: ${e.message}`);
    }
    
    // Check browser capabilities
    try {
      const capabilities = await page.evaluate(() => ({
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        hasPermissions: !!navigator.permissions,
        hasWebRTC: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),
        isHeadless: navigator.webdriver || false,
        webdriver: navigator.webdriver || false
      }));
      console.log(`🔧 Browser Capabilities:`, JSON.stringify(capabilities, null, 2));
    } catch (e) {
      console.log(`⚠️ Could not get browser capabilities: ${e.message}`);
    }
    
    // Check if headless
    try {
      const isHeadless = await page.evaluate(() => {
        return navigator.webdriver || 
               !window.chrome || 
               window.chrome.runtime === undefined ||
               navigator.plugins.length === 0;
      });
      console.log(`🎭 Headless Mode: ${isHeadless ? 'YES (Detected)' : 'NO (Not detected)'}`);
      console.log(`🎭 Launch Option Headless: ${launchOptions.headless}`);
    } catch (e) {
      console.log(`⚠️ Could not detect headless mode: ${e.message}`);
    }
    
    // Get viewport info
    try {
      const viewport = page.viewport();
      console.log(`📐 Viewport: ${JSON.stringify(viewport)}`);
    } catch (e) {
      console.log(`⚠️ Could not get viewport: ${e.message}`);
    }
    
    // Check environment
    console.log(`🖥️  System Platform: ${process.platform}`);
    console.log(`🖥️  Node Version: ${process.version}`);
    console.log(`🖥️  Chrome Path Env: ${process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || 'Not set'}`);
    
    // Set permissions: Allow camera (so video icon appears), deny microphone
    const context = browser.defaultBrowserContext();
    // Allow camera so Zoom shows video icon, deny microphone
    await context.overridePermissions('https://zoom.us', ['camera']);
    await context.overridePermissions('https://app.zoom.us', ['camera']);
    
    // Override getUserMedia: Provide video stream (so icon appears), then we'll stop it
    // IMPORTANT: This must run BEFORE browser detection to ensure mediaDevices exists
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
      
      // CRITICAL: Create navigator.mediaDevices if it doesn't exist (headless mode issue)
      if (!navigator.mediaDevices) {
        console.log(`[Browser] navigator.mediaDevices is undefined - creating it`);
        navigator.mediaDevices = {};
      }
      
      // Store the original getUserMedia if it exists, otherwise create a placeholder
      let originalGetUserMedia = null;
      if (navigator.mediaDevices.getUserMedia) {
        originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      }
      
      // Override getUserMedia: ALWAYS provide video (so icon appears), deny audio
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        console.log(`[Browser] getUserMedia called with constraints:`, JSON.stringify(constraints));
        
        // Always deny audio
        if (constraints && constraints.audio) {
          constraints.audio = false;
        }
        
        // If video is requested, ALWAYS provide it (we'll stop it later in the UI)
        // This is CRITICAL for video icon to appear in participant list
        if (constraints && constraints.video) {
          console.log(`[Browser] Video requested - providing fake video stream so icon appears`);
          // Return fake video stream - we'll stop it after joining
          const stream = createFakeVideoStream();
          // Store globally so we can access it later to disable
          window.localStream = stream;
          window.fakeVideoStream = stream;
          console.log(`[Browser] Video stream created and stored globally`);
          return stream;
        }
        
        // If only audio requested, deny
        console.log(`[Browser] Only audio requested - denying`);
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
    
    // Now check browser capabilities AFTER mediaDevices override
    console.log(`\n🔍 ========== POST-SETUP BROWSER DETECTION [${botName}] ==========`);
    try {
      const capabilitiesAfter = await page.evaluate(() => ({
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        hasPermissions: !!navigator.permissions,
        hasWebRTC: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),
        isHeadless: navigator.webdriver || false,
        webdriver: navigator.webdriver || false,
        mediaDevicesType: typeof navigator.mediaDevices,
        getUserMediaType: typeof (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      }));
      console.log(`🔧 Browser Capabilities (After Setup):`, JSON.stringify(capabilitiesAfter, null, 2));
    } catch (e) {
      console.log(`⚠️ Could not get browser capabilities after setup: ${e.message}`);
    }
    console.log(`🔍 ========== END POST-SETUP DETECTION ==========\n`);

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
    
    // Handle microphone and camera permission popup - SELECT "Join with video" so icon appears, then disable it
    // CRITICAL: Wait longer for permission dialog to appear before checking for OK button
    console.log(`🎥 [${botName}] Checking for microphone/camera permission popup...`);
    
    // Wait longer for permission dialog to appear - it may take time to load
    // Don't check for OK button until we've given permission dialog enough time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Wait for permission dialog to appear - try multiple selectors with longer timeout
    let permissionDialogFound = false;
    try {
      await page.waitForSelector('.pepc-permission-dialog', { timeout: 8000 });
      permissionDialogFound = true;
      console.log(`🎥 [${botName}] Permission dialog appeared!`);
    } catch (e) {
      try {
        await page.waitForSelector('[class*="permission-dialog"]', { timeout: 5000 });
        permissionDialogFound = true;
        console.log(`🎥 [${botName}] Permission dialog found with alternative selector!`);
      } catch (e2) {
        try {
          await page.waitForSelector('permission[type="camera"]', { timeout: 5000 });
          permissionDialogFound = true;
          console.log(`🎥 [${botName}] Permission element found directly!`);
        } catch (e3) {
          console.log(`⚠️ [${botName}] Permission dialog not found immediately, will retry...`);
        }
      }
    }
    
    // Additional wait to ensure dialog is fully loaded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Wait longer for permission dialog to appear (2s, 4s, 6s, 8s, 10s)
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const permissionResult = await page.evaluate(() => {
          // Look for the permission dialog - it has a specific structure
          // <permission type="camera"> element is the "Use camera" button
          const permissionDialog = document.querySelector('.pepc-permission-dialog');
          
          // Also try alternative selectors
          const altDialog1 = document.querySelector('[class*="permission-dialog"]');
          const altDialog2 = document.querySelector('[class*="permission"]');
          const permissionDialogElement = permissionDialog || altDialog1 || altDialog2;
        
          if (permissionDialogElement) {
            console.log(`[Browser] Found permission dialog (selector: ${permissionDialog ? '.pepc-permission-dialog' : 'alternative'})`);
            
            // DEBUG: Log entire dialog HTML structure
            console.log(`[Browser] Dialog HTML (first 500 chars): ${permissionDialogElement.innerHTML.substring(0, 500)}`);
            
            // PRIORITY 1: Look for <permission type="camera"> element - this is the "Use camera" button
            // Try multiple ways to find it
            let useCameraButton = permissionDialogElement.querySelector('permission[type="camera"]');
            
            // If not found, try querySelectorAll and filter
            if (!useCameraButton) {
              const allPermissions = permissionDialogElement.querySelectorAll('permission');
              console.log(`[Browser] Found ${allPermissions.length} permission elements total`);
              for (const perm of allPermissions) {
                const type = perm.getAttribute('type');
                console.log(`[Browser] Permission element: type="${type}", tagName="${perm.tagName}"`);
                if (type === 'camera') {
                  useCameraButton = perm;
                  console.log(`[Browser] Found camera permission element via querySelectorAll`);
                  break;
                }
              }
            }
            
            // Also try finding by shadow DOM or nested structure
            if (!useCameraButton) {
              // Try finding in shadow roots
              const walker = document.createTreeWalker(permissionDialogElement, NodeFilter.SHOW_ELEMENT);
              let node;
              while (node = walker.nextNode()) {
                if (node.tagName && node.tagName.toLowerCase() === 'permission' && node.getAttribute('type') === 'camera') {
                  useCameraButton = node;
                  console.log(`[Browser] Found camera permission via tree walker`);
                  break;
                }
              }
            }
            
            if (useCameraButton) {
              const isVisible = useCameraButton.offsetWidth > 0 && useCameraButton.offsetHeight > 0;
              const computedStyle = window.getComputedStyle(useCameraButton);
              const display = computedStyle.display;
              const visibility = computedStyle.visibility;
              console.log(`[Browser] Found <permission type="camera"> button, visible: ${isVisible}, display: ${display}, visibility: ${visibility}`);
              
              if (isVisible && display !== 'none' && visibility !== 'hidden') {
                console.log(`[Browser] Clicking <permission type="camera"> button to enable video`);
                
                // Try multiple click methods
                useCameraButton.click();
                useCameraButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                useCameraButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                useCameraButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                
                // Also try programmatic click via button if it's a button
                if (useCameraButton.tagName.toLowerCase() === 'button' || useCameraButton.onclick) {
                  if (useCameraButton.onclick) {
                    useCameraButton.onclick();
                  }
                }
                
                return { handled: true, button: 'use_camera_permission', label: 'Use camera (permission element)' };
              } else {
                console.log(`[Browser] Camera permission button found but not visible (display: ${display}, visibility: ${visibility})`);
              }
            } else {
              // Log all permission elements found for debugging
              const allPermissionElements = permissionDialogElement.querySelectorAll('permission');
              console.log(`[Browser] Found ${allPermissionElements.length} permission elements in dialog`);
              allPermissionElements.forEach((perm, idx) => {
                const type = perm.getAttribute('type');
                const visible = perm.offsetWidth > 0 && perm.offsetHeight > 0;
                console.log(`[Browser] Permission element ${idx + 1}: type="${type}", visible=${visible}, tagName="${perm.tagName}"`);
              });
              
              // Also log all buttons in dialog
              const allButtons = permissionDialogElement.querySelectorAll('button, [role="button"]');
              console.log(`[Browser] Found ${allButtons.length} buttons in dialog`);
              allButtons.forEach((btn, idx) => {
                const text = btn.textContent.trim();
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const visible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
                console.log(`[Browser] Button ${idx + 1}: text="${text.substring(0, 50)}", aria-label="${ariaLabel}", visible=${visible}`);
              });
            }
          
          // PRIORITY 2: Look for button with "Use camera" text inside permission dialog
          const buttons = Array.from(permissionDialogElement.querySelectorAll('button, [role="button"], permission'));
          const useCameraTextButton = buttons.find(btn => {
            const text = btn.textContent.toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const isVisible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
            return isVisible && (
              text.includes('use camera') ||
              text.includes('use microphone and camera') ||
              text.includes('join with video') ||
              text.includes('turn on video') ||
              ariaLabel.includes('use camera') ||
              ariaLabel.includes('use microphone and camera') ||
              ariaLabel.includes('join with video'));
          });
          
          if (useCameraTextButton) {
            const label = useCameraTextButton.getAttribute('aria-label') || useCameraTextButton.textContent;
            console.log(`[Browser] Found use camera button: "${label}" - clicking to initialize video`);
            useCameraTextButton.click();
            return { handled: true, button: 'use_camera_text', label };
          }
          
          // Don't click "Continue without camera" - we want video enabled
          const footerButton = permissionDialogElement.querySelector('.pepc-permission-dialog__footer-button') ||
                              permissionDialogElement.querySelector('[class*="footer-button"]');
          if (footerButton && footerButton.textContent.toLowerCase().includes('continue without')) {
            console.log(`[Browser] Found "Continue without camera" button - NOT clicking (we want video)`);
          }
        } else {
          console.log(`[Browser] Permission dialog NOT found - checking for permission elements anywhere...`);
        }
        
        // Fallback: Look for buttons outside permission dialog
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"], permission'));
        const buttonInfo = allButtons.map(b => ({
          text: b.textContent,
          ariaLabel: b.getAttribute('aria-label'),
          tagName: b.tagName,
          type: b.getAttribute('type'),
          visible: b.offsetWidth > 0 && b.offsetHeight > 0
        }));
        
        console.log(`[Browser] Found ${allButtons.length} total buttons:`, buttonInfo.filter(b => b.visible).slice(0, 15));
        
        // Look for <permission type="camera"> element anywhere
        const permissionElement = document.querySelector('permission[type="camera"]');
        if (permissionElement) {
          const isVisible = permissionElement.offsetWidth > 0 && permissionElement.offsetHeight > 0;
          console.log(`[Browser] Found <permission type="camera"> element anywhere, visible: ${isVisible}`);
          if (isVisible) {
            console.log(`[Browser] Clicking <permission type="camera"> element to enable video`);
            permissionElement.click();
            permissionElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return { handled: true, button: 'permission_camera', label: 'Use camera (permission element)' };
          }
        }
        
        // Look for "Use camera" or "Join with video" button
        const joinWithVideoButton = allButtons.find(btn => {
          const text = btn.textContent.toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const isVisible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
          return isVisible && (
            text.includes('use camera') ||
            text.includes('use microphone and camera') ||
            text.includes('join with video') ||
            text.includes('turn on video') ||
            text.includes('enable video') ||
            ariaLabel.includes('use camera') ||
            ariaLabel.includes('use microphone and camera') ||
            ariaLabel.includes('join with video') ||
            ariaLabel.includes('turn on video'));
        });
        
        if (joinWithVideoButton) {
          const label = joinWithVideoButton.getAttribute('aria-label') || joinWithVideoButton.textContent;
          console.log(`[Browser] Found join with video button: "${label}" - clicking to initialize video`);
          joinWithVideoButton.click();
          return { handled: true, button: 'join_with_video', label };
        }
        
        // Look for "OK" button for floating reactions popup (ONLY if no permission dialog found)
        // CRITICAL: Never click OK if permission dialog exists - we need camera button first
        // Use more specific selectors to avoid false positives
        const permissionDialogCheck = document.querySelector('.pepc-permission-dialog') ||
                                     document.querySelector('[class*="permission-dialog"]');
        
        // Also check if there's a permission element anywhere (more specific check)
        const hasPermissionElement = document.querySelector('permission[type="camera"]') ||
                                     document.querySelector('permission[type="microphone"]');
        
        // Only click OK if:
        // 1. No permission dialog found
        // 2. No permission elements found
        // 3. We've waited long enough (this check happens in later attempts)
        if (!permissionDialogCheck && !hasPermissionElement) {
          // Additional check: make sure OK button is not inside a permission-related container
          const okButton = allButtons.find(btn => {
            const text = btn.textContent.toLowerCase().trim();
            const isVisible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
            
            // Check if button is inside permission dialog (should not click)
            let parent = btn.parentElement;
            let isInPermissionDialog = false;
            while (parent) {
              if (parent.classList && (
                  parent.classList.contains('pepc-permission-dialog') ||
                  parent.className.includes('permission-dialog') ||
                  parent.tagName === 'PERMISSION'
              )) {
                isInPermissionDialog = true;
                break;
              }
              parent = parent.parentElement;
            }
            
            // Only click OK if it's a simple popup (not permission dialog) and not in permission container
            return isVisible && 
                   text === 'ok' && 
                   text.length <= 3 &&
                   !isInPermissionDialog;
          });
          
          if (okButton) {
            console.log(`[Browser] Found OK button for popup (no permission dialog found, attempt ${attemptNum})`);
            // Only click OK on later attempts (after we've given permission dialog time to appear)
            if (attemptNum >= 3) {
              okButton.click();
              return { handled: true, button: 'ok', label: 'OK' };
            } else {
              console.log(`[Browser] Skipping OK button click on early attempt (${attempt}) - waiting for permission dialog`);
            }
          }
        } else {
          if (permissionDialogCheck) {
            console.log(`[Browser] Permission dialog exists - NOT clicking OK button (need camera button first)`);
          }
          if (hasPermissionElement) {
            console.log(`[Browser] Permission element found - NOT clicking OK button (need camera button first)`);
          }
        }
        
        return { handled: false, button: null, label: null };
        }, attempt);
      
        if (permissionResult && permissionResult.handled) {
          console.log(`🎥 [${botName}] Permission popup handled (attempt ${attempt}): ${permissionResult.button} - "${permissionResult.label}"`);
          if (permissionResult.button === 'ok') {
            console.log(`⚠️ [${botName}] WARNING: Only "OK" button clicked - video might not initialize!`);
            // Don't break, continue trying to find permission dialog
          } else if (permissionResult.button === 'use_camera_permission' || permissionResult.button === 'permission_camera') {
            console.log(`✅ [${botName}] Successfully clicked permission[type="camera"] - video should initialize!`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            break; // Success, exit loop
          } else if (permissionResult.button === 'join_with_video' || permissionResult.button === 'use_camera_text') {
            console.log(`✅ [${botName}] Successfully clicked video button - video should initialize!`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            break; // Success, exit loop
          }
          if (permissionResult.button === 'continue_without_video') {
            console.log(`⚠️ [${botName}] WARNING: Selected "Continue without video" - video icon might not appear!`);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Check if dialog was found but button wasn't clicked
          if (permissionResult && permissionResult.dialogFound) {
            console.log(`⚠️ [${botName}] Permission dialog found but camera button not clicked (attempt ${attempt}/5), retrying...`);
            // Wait longer before retry
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else if (attempt < 5) {
            console.log(`⚠️ [${botName}] Permission popup not found (attempt ${attempt}/5), retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.log(`⚠️ [${botName}] No permission popup found after 5 attempts - video might not initialize`);
          }
        }
      } catch (error) {
        console.log(`❌ [${botName}] Error handling permission popup (attempt ${attempt}): ${error.message}`);
      }
    }
    
    // Wait for meeting to load (reduced wait time to disable video faster)
    console.log(`Waiting for meeting interface to load for ${botName}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Disable video IMMEDIATELY after joining (so icon appears but is crossed/disabled)
    // This is critical: video must be initialized (so icon appears) but then disabled (so it's crossed)
    console.log(`🎥 [${botName}] Starting video disable process...`);
    
    // Try disabling video multiple times with different methods
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        console.log(`🎥 [${botName}] Attempt ${attempt}/5 to disable video...`);
        
        const result = await page.evaluate(async () => {
          const logs = [];
          logs.push(`[Browser] Starting video disable attempt...`);
          
          // Method 1: Stop all video tracks immediately
          try {
            logs.push(`[Browser] Method 1: Stopping video tracks...`);
            const allStreams = [];
            
            // Get stream from global storage
            if (window.localStream) {
              allStreams.push(window.localStream);
              logs.push(`[Browser] Found window.localStream`);
            }
            if (window.fakeVideoStream) {
              allStreams.push(window.fakeVideoStream);
              logs.push(`[Browser] Found window.fakeVideoStream`);
            }
            
            // Try to get current stream
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                allStreams.push(stream);
                logs.push(`[Browser] Got new stream from getUserMedia`);
              } catch (e) {
                logs.push(`[Browser] Could not get new stream: ${e.message}`);
              }
            }
            
            let totalTracksStopped = 0;
            allStreams.forEach(stream => {
              const videoTracks = stream.getVideoTracks();
              videoTracks.forEach(track => {
                logs.push(`[Browser] Stopping track: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
                track.enabled = false;
                track.stop();
                totalTracksStopped++;
              });
            });
            
            logs.push(`[Browser] Stopped ${totalTracksStopped} video track(s)`);
          } catch (e) {
            logs.push(`[Browser] Error stopping video tracks: ${e.message}`);
          }
          
          // Method 2: Find and click "Stop Video" button - try ALL possible selectors
          logs.push(`[Browser] Method 2: Finding video button in UI...`);
          const allButtons = Array.from(document.querySelectorAll('button, [role="button"], [data-testid*="video"], [data-testid*="camera"], [class*="video"], [class*="camera"]'));
          logs.push(`[Browser] Found ${allButtons.length} total buttons`);
          
          // Log all buttons with video-related text for debugging
          const videoRelatedButtons = allButtons.filter(btn => {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const text = btn.textContent.toLowerCase();
            const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
            const className = btn.className.toLowerCase();
            return ariaLabel.includes('video') || ariaLabel.includes('camera') ||
                   text.includes('video') || text.includes('camera') ||
                   dataTestId.includes('video') || dataTestId.includes('camera') ||
                   className.includes('video') || className.includes('camera');
          });
          
          logs.push(`[Browser] Found ${videoRelatedButtons.length} video-related buttons`);
          videoRelatedButtons.forEach((btn, idx) => {
            logs.push(`[Browser] Video button ${idx + 1}: aria-label="${btn.getAttribute('aria-label')}", text="${btn.textContent.substring(0, 50)}", data-testid="${btn.getAttribute('data-testid')}"`);
          });
          
          // Try multiple selectors for video button
          const videoButtonSelectors = [
            // Exact matches for "Stop Video"
            btn => {
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              return ariaLabel.includes('stop video') || ariaLabel.includes('turn off video');
            },
            // Any video button that says "stop" or "turn off"
            btn => {
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              const text = btn.textContent.toLowerCase();
              return (ariaLabel.includes('video') || ariaLabel.includes('camera')) &&
                     (ariaLabel.includes('stop') || ariaLabel.includes('turn off') || text.includes('stop'));
            },
            // By data-testid
            btn => {
              const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
              return dataTestId.includes('video') && (dataTestId.includes('stop') || dataTestId.includes('off'));
            },
            // By class name
            btn => {
              const className = btn.className.toLowerCase();
              return (className.includes('video') || className.includes('camera')) &&
                     (className.includes('stop') || className.includes('off'));
            }
          ];
          
          let videoDisabled = false;
          let clickedButton = null;
          
          for (const selector of videoButtonSelectors) {
            const videoButton = allButtons.find(selector);
            if (videoButton) {
              const ariaLabel = videoButton.getAttribute('aria-label') || '';
              logs.push(`[Browser] Found video button with selector: "${ariaLabel}"`);
              clickedButton = ariaLabel;
              videoButton.click();
              logs.push(`[Browser] Clicked video button`);
              await new Promise(resolve => setTimeout(resolve, 500));
              // Click again to ensure it's off
              videoButton.click();
              logs.push(`[Browser] Clicked video button again`);
              videoDisabled = true;
              break;
            }
          }
          
          // Method 3: If no "Stop Video" button found, try to find ANY video button and click it
          if (!videoDisabled) {
            logs.push(`[Browser] Method 3: Trying to find any video button...`);
            const anyVideoButton = allButtons.find(btn => {
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              const text = btn.textContent.toLowerCase();
              return (ariaLabel.includes('video') || ariaLabel.includes('camera') || text.includes('video')) &&
                     !ariaLabel.includes('start') && !ariaLabel.includes('turn on') &&
                     !text.includes('start');
            });
            
            if (anyVideoButton) {
              const ariaLabel = anyVideoButton.getAttribute('aria-label') || '';
              logs.push(`[Browser] Found general video button: "${ariaLabel}", clicking to toggle off...`);
              clickedButton = ariaLabel;
              anyVideoButton.click();
              await new Promise(resolve => setTimeout(resolve, 500));
              anyVideoButton.click(); // Click again
              logs.push(`[Browser] Clicked general video button twice`);
              videoDisabled = true;
            } else {
              logs.push(`[Browser] No video button found to disable`);
            }
          }
          
          return { logs, videoDisabled, clickedButton };
        });
        
        // Log browser console messages
        if (result && result.logs) {
          result.logs.forEach(log => console.log(`🎥 [${botName}] ${log}`));
        }
        
        if (result && result.videoDisabled) {
          console.log(`✅ [${botName}] Video disabled successfully via button: "${result.clickedButton}"`);
        } else {
          console.log(`⚠️ [${botName}] Video button not found or not clicked`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Method 4: Press 'v' key multiple times (Zoom shortcut to toggle video)
        console.log(`🎥 [${botName}] Method 4: Pressing 'v' key to toggle video...`);
        await page.keyboard.press('v');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.keyboard.press('v'); // Press again to ensure it's off
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ [${botName}] Error in attempt ${attempt} to disable video: ${error.message}`);
      }
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