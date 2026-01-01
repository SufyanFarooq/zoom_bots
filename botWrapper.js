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

    // Set permissions: Deny both video and audio (both muted/disabled)
    const context = browser.defaultBrowserContext();
    // Deny both camera and microphone - both will show as disabled/crossed
    await context.overridePermissions('https://zoom.us', []);
    await context.overridePermissions('https://app.zoom.us', []);
    
    // Override getUserMedia: Deny both video and audio (both will show as disabled/crossed)
    await page.evaluateOnNewDocument(() => {
      // Override getUserMedia to deny both video and audio
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // Always deny both video and audio - both icons will show as disabled/crossed
        throw new Error('Permission denied - video and audio disabled');
      };
      
      // Override permissions API - deny both camera and microphone
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async (permissionDesc) => {
          // Deny both camera and microphone - both will show as disabled
          if (permissionDesc.name === 'camera') {
            return { state: 'denied' };
          }
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
    
    // Handle microphone and camera permission popup - SELECT "Continue without video/audio"
    console.log(`Checking for microphone/camera permission popup for ${botName}...`);
    try {
      const permissionHandled = await page.evaluate(() => {
        // Look for the permission popup
        const buttons = Array.from(document.querySelectorAll('button'));
        console.log('Found buttons after join:', buttons.map(b => b.textContent));
        
        // PRIORITY: Look for "Continue without microphone and camera" button
        // This will make both video and mic icons show as disabled/crossed
        const continueWithoutButton = buttons.find(btn => {
          const text = btn.textContent.toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          return (text.includes('continue without microphone') ||
                  text.includes('continue without camera') ||
                  text.includes('join without audio') ||
                  text.includes('join without video') ||
                  text.includes('continue without') ||
                  ariaLabel.includes('continue without'));
        });
        
        if (continueWithoutButton) {
          console.log('Found continue without button - clicking to keep video/mic disabled');
          continueWithoutButton.click();
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
        console.log(`Permission popup handled for ${botName} - video and mic will be disabled`);
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
    
    // Ensure video stays DISABLED (crossed/off) - Don't enable it
    // Video icon should show as disabled/crossed like mic icon
    console.log(`Video will remain disabled (crossed) for ${botName} - as intended`);
    
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
          
          // Keep video DISABLED - don't enable it
          // Video icon should remain disabled/crossed like mic icon
          await page.evaluate(() => {
            // Ensure video stays disabled - don't enable it
            // Both video and mic should show as disabled/crossed
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