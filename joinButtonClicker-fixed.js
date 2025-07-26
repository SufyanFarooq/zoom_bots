import puppeteer from 'puppeteer';

// Global array to track all browser instances
let activeBrowsers = [];
let activePages = [];
let isClosing = false; // Flag to prevent multiple close operations

export async function joinZoomMeeting(meetingNumber, passWord, userName) {
  let browser;
  let page;
  try {
    console.log(`Starting Puppeteer for ${userName} to join meeting: ${meetingNumber}`);
    
    // Clear any environment variables that might interfere
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`Cleared PUPPETEER_EXECUTABLE_PATH environment variable`);
    
    // Simple launch options - use correct Chromium path for production
    const launchOptions = {
      headless: process.env.NODE_ENV === 'production' ? true : false, // Headless in production
      protocolTimeout: 120000, // 2 minutes timeout
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-images',
        '--mute-audio',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--no-default-browser-check',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--single-process',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--disable-site-isolation-trials'
      ]
    };
    
    // Set executablePath based on environment
    if (process.env.NODE_ENV === 'production') {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
      console.log('Using production Chromium path');
    } else {
      launchOptions.executablePath = '/Users/mac/.cache/puppeteer/chrome/mac-138.0.7204.168/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
      console.log('Using local Chromium path');
    }
    
    // NEVER set executablePath - use bundled Chromium
    console.log(`Launch options:`, { 
      headless: launchOptions.headless, 
      executablePath: launchOptions.executablePath,
      argsCount: launchOptions.args.length,
      environment: process.env.NODE_ENV
    });
    
    browser = await puppeteer.launch(launchOptions);
    console.log(`Browser launched for ${userName}`);
    
    page = await browser.newPage();
    console.log(`Page created for ${userName}`);
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to Zoom join URL
    const zoomJoinUrl = `https://zoom.us/wc/join/${meetingNumber}`;
    console.log(`Navigating to: ${zoomJoinUrl}`);
    
    await page.goto(zoomJoinUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`Page loaded for ${userName}, waiting for form...`);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Handle cookie consent popup if present
    console.log(`Checking for cookie popup for ${userName}...`);
    try {
      // Try to find and click "Accept Cookies" button
      const cookieSelectors = [
        'button:contains("Accept Cookies")',
        'button[class*="accept"]',
        'button[id*="accept"]',
        'button:contains("Accept")',
        '#onetrust-accept-btn-handler',
        '.onetrust-accept-btn-handler'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log(`Cookie popup accepted for ${userName} using selector: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Alternative: Use page.evaluate to find and click accept button
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
        console.log(`Cookie popup accepted via page.evaluate for ${userName}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log(`No cookie popup found for ${userName} or already handled`);
    }
    
    // Take debug screenshot
    await page.screenshot({ path: `/tmp/${userName}_debug_initial.png` });
    console.log(`Debug screenshot saved for ${userName}`);
    
    // Handle camera/microphone permissions if present
    console.log(`Looking for meeting form for ${userName}...`);
    
    // Enter bot name
    console.log(`Entering name for ${userName}...`);
    try {
      await page.waitForSelector('input[type="text"]', { timeout: 10000 });
      await page.type('input[type="text"]', userName);
      console.log(`Name entered for ${userName}`);
    } catch (error) {
      console.log(`Name input not found for ${userName}, trying alternative selectors...`);
      try {
        await page.type('input[placeholder*="name"], input[name*="name"]', userName);
        console.log(`Name entered via alternative selector for ${userName}`);
      } catch (error2) {
        console.log(`Error for ${userName}: Name input not found`);
        throw new Error(`Name input not found for ${userName}`);
      }
    }
    
    // Enter passcode
    console.log(`Entering passcode for ${userName}...`);
    try {
      // Try multiple selectors for passcode input
      const passcodeSelectors = [
        '#input-for-pwd',
        'input[type="password"]',
        'input[placeholder*="passcode"]',
        'input[placeholder*="password"]',
        'input[name*="passcode"]',
        'input[name*="password"]',
        'input[aria-label*="passcode"]',
        'input[aria-label*="password"]'
      ];
      
      let passcodeInput = null;
      for (const selector of passcodeSelectors) {
        try {
          passcodeInput = await page.waitForSelector(selector, { timeout: 2000 });
          if (passcodeInput) {
            console.log(`Found passcode input for ${userName} using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (passcodeInput) {
        await passcodeInput.type(passWord);
        console.log(`Passcode entered for ${userName}`);
      } else {
        // Try page.evaluate as fallback
        const entered = await page.evaluate((pwd) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const passcodeInput = inputs.find(input => 
            input.type === 'password' ||
            input.placeholder?.toLowerCase().includes('passcode') ||
            input.placeholder?.toLowerCase().includes('password') ||
            input.name?.toLowerCase().includes('passcode') ||
            input.name?.toLowerCase().includes('password') ||
            input.id?.toLowerCase().includes('pwd') ||
            input.id?.toLowerCase().includes('pass')
          );
          if (passcodeInput) {
            passcodeInput.value = pwd;
            passcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        }, passWord);
        
        if (entered) {
          console.log(`Passcode entered via page.evaluate for ${userName}`);
        } else {
          throw new Error('No passcode input found');
        }
      }
    } catch (error) {
      console.log(`Error for ${userName}: Passcode input not found - ${error.message}`);
      throw new Error(`Passcode input not found for ${userName}`);
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take screenshot before join
    await page.screenshot({ path: `/tmp/${userName}_debug_before_join.png` });
    
    // Click Join button
    console.log(`Looking for join button for ${userName}...`);
    try {
      await page.click('button[class*="join"]');
      console.log(`Join button clicked for ${userName}`);
    } catch (error) {
      console.log(`Direct click failed for ${userName}, trying page.evaluate...`);
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
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
        console.log(`Join button clicked via page.evaluate for ${userName}`);
      } catch (error2) {
        console.log(`Error for ${userName}: Join button not found`);
        throw new Error(`Join button not found for ${userName}`);
      }
    }
    
    // Wait for navigation
    console.log(`Waiting for meeting to load for ${userName}...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL for ${userName}: ${currentUrl}`);
    
    if (currentUrl.includes('app.zoom.us/wc/')) {
      console.log(`Successfully joined meeting for ${userName}`);
      
      // Take final screenshot
      await page.screenshot({ path: `/tmp/${userName}_final.png` });
      console.log(`Final screenshot saved for ${userName}`);
      
      // Add to active browsers/pages
      activeBrowsers.push(browser);
      activePages.push(page);
      
      return {
        success: true,
        message: `${userName} successfully joined meeting`,
        userName: userName,
        url: currentUrl
      };
    } else {
      console.log(`Meeting interface check failed for ${userName}: Still on join page`);
      throw new Error(`Meeting interface check failed for ${userName}`);
    }
    
  } catch (error) {
    console.log(`Error for ${userName}: ${error.message}`);
    
    // Take error screenshot
    try {
      if (page) {
        await page.screenshot({ path: `/tmp/${userName}_error.png` });
        console.log(`Error screenshot saved for ${userName}`);
      }
    } catch (screenshotError) {
      console.log(`Could not save error screenshot for ${userName}: ${screenshotError.message}`);
    }
    
    // Close browser on error
    if (browser) {
      try {
        await browser.close();
        console.log(`Browser closed for ${userName} due to error`);
      } catch (closeError) {
        console.log(`Could not close browser for ${userName}: ${closeError.message}`);
      }
    }
    
    return {
      success: false,
      error: error.message,
      userName: userName
    };
  }
}

export async function closeAllBots() {
  if (isClosing) {
    console.log('Already closing bots...');
    return { message: 'Already closing bots...', closedCount: 0 };
  }
  
  isClosing = true;
  console.log('Closing all bots...');
  
  try {
    const closePromises = [];
    
    // Close all pages
    for (const page of activePages) {
      if (page && !page.isClosed()) {
        closePromises.push(page.close().catch(err => console.log('Error closing page:', err.message)));
      }
    }
    
    // Close all browsers
    for (const browser of activeBrowsers) {
      if (browser && browser.process()) {
        closePromises.push(browser.close().catch(err => console.log('Error closing browser:', err.message)));
      }
    }
    
    // Wait for all to close
    await Promise.allSettled(closePromises);
    
    // Clear arrays
    activeBrowsers = [];
    activePages = [];
    
    console.log('All bots closed successfully');
    return { message: 'All bots closed successfully', closedCount: closePromises.length };
    
  } catch (error) {
    console.log('Error closing bots:', error.message);
    return { message: 'Error closing bots', error: error.message, closedCount: 0 };
  } finally {
    isClosing = false;
  }
}

export async function leaveAllMeetings() {
  console.log('Leaving all meetings...');
  
  try {
    const leavePromises = [];
    
    // Close all pages (this will leave meetings)
    for (const page of activePages) {
      if (page && !page.isClosed()) {
        leavePromises.push(page.close().catch(err => console.log('Error leaving meeting:', err.message)));
      }
    }
    
    // Close all browsers
    for (const browser of activeBrowsers) {
      if (browser && browser.process()) {
        leavePromises.push(browser.close().catch(err => console.log('Error closing browser:', err.message)));
      }
    }
    
    // Wait for all to close
    await Promise.allSettled(leavePromises);
    
    // Clear arrays
    activeBrowsers = [];
    activePages = [];
    
    console.log('All meetings left successfully');
    return { message: 'All meetings left successfully', leftCount: leavePromises.length };
    
  } catch (error) {
    console.log('Error leaving meetings:', error.message);
    return { message: 'Error leaving meetings', error: error.message, leftCount: 0 };
  }
}

export function getBotStatus() {
  const activeBots = activeBrowsers.length;
  const botNames = activeBrowsers.map((browser, index) => {
    // Generate a bot name based on index
    const names = ['Bot_1', 'Bot_2', 'Bot_3', 'Bot_4', 'Bot_5', 'Bot_6', 'Bot_7', 'Bot_8', 'Bot_9', 'Bot_10'];
    return names[index] || `Bot_${index + 1}`;
  });
  
  return {
    activeBots: activeBots,
    botNames: botNames
  };
} 