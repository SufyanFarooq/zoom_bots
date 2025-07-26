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
    
    browser = await puppeteer.launch({
      //   headless: process.env.NODE_ENV === 'production' ? true : false,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    // Track browser instance
    activeBrowsers.push({ browser, userName });

    page = await browser.newPage();
    
    // Track page instance
    activePages.push({ page, userName });
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Handle permissions automatically
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://zoom.us', ['camera', 'microphone']);
    
    // Go directly to Zoom join URL
    const zoomJoinUrl = `https://zoom.us/wc/join/${meetingNumber}`;
    console.log(`Navigating to: ${zoomJoinUrl}`);
    
    await page.goto(zoomJoinUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log(`Page loaded for ${userName}, waiting for form...`);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // After page load, always mute audio and stop video before joining
    try {
      // Wait for audio and video control buttons to appear
      await page.waitForSelector('#preview-audio-control-button', { timeout: 7000 });
      await page.waitForSelector('#preview-video-control-button', { timeout: 7000 });

      // Click mute (audio off)
      const muteBtn = await page.$('#preview-audio-control-button');
      if (muteBtn) {
        await muteBtn.click();
        console.log(`Muted audio for ${userName}`);
      }

      // Click stop video (video off)
      const videoBtn = await page.$('#preview-video-control-button');
      if (videoBtn) {
        await videoBtn.click();
        console.log(`Stopped video for ${userName}`);
      }
    } catch (err) {
      console.log(`Audio/video controls not found for ${userName}, skipping mute/video off.`);
    }
    
    // Fill in the meeting details form
    console.log(`Looking for meeting form for ${userName}...`);
    
    // Look for name input field
    const nameInput = await page.$('input[name="inputname"]') || 
                     await page.$('#inputname') || 
                     await page.$('input[placeholder*="name"]') ||
                     await page.$('input[placeholder*="Name"]') ||
                     await page.$('input[aria-label*="name"]') ||
                     await page.$('input[aria-label*="Name"]');
    
    if (nameInput) {
      console.log(`Found name input for ${userName}, entering name...`);
      await nameInput.click();
      await nameInput.type(userName, { delay: 100 });
    } else {
      console.log(`Name input not found for ${userName}, trying alternative selectors...`);
      // Try alternative selectors
      const nameInputAlt = await page.$('input[type="text"]') || await page.$('input');
      if (nameInputAlt) {
        await nameInputAlt.click();
        await nameInputAlt.type(userName, { delay: 100 });
        console.log(`Entered name using alternative selector for ${userName}`);
      }
    }
    
    // Look for password input if needed
    if (passWord) {
      const passwordInput = await page.$('input[name="inputpasscode"]') || 
                           await page.$('#inputpasscode') || 
                           await page.$('input[placeholder*="passcode"]') ||
                           await page.$('input[placeholder*="Passcode"]') ||
                           await page.$('input[type="password"]');
      
      if (passwordInput) {
        console.log(`Found password input for ${userName}, entering password...`);
        await passwordInput.click();
        await passwordInput.type(passWord, { delay: 100 });
      }
    }
    
    // Wait a bit for form to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Look for join button
    console.log(`Looking for join button for ${userName}...`);
    
    const joinButton = await page.$('.preview-join-button') || 
                      await page.$('button[class*="preview-join-button"]') ||
                      await page.$('button:contains("Join")') ||
                      await page.$('button[aria-label*="Join"]') ||
                      await page.$('button[type="submit"]');
    
    if (joinButton) {
      console.log(`Found join button for ${userName}, clicking...`);
      await joinButton.click();
      console.log(`Join button clicked successfully for ${userName}`);
    } else {
      // Try to find any button with "Join" text
      const joinButtonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const joinBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes('join'));
        if (joinBtn) {
          joinBtn.click();
          return true;
        }
        return false;
      });
      
      if (joinButtonFound) {
        console.log(`Join button clicked via text search for ${userName}`);
      } else {
        // Debug: Show all available buttons
        const allButtons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim(),
            className: btn.className,
            id: btn.id
          }));
        });
        console.log(`Available buttons for ${userName}:`, allButtons);
        throw new Error(`Join button not found for ${userName}`);
      }
    }
    
    // Wait to see if join was successful
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      success: true,
      message: `${userName} successfully joined meeting`,
      userName: userName
    };
    
  } catch (error) {
    console.error(`Error for ${userName}:`, error.message);
    return {
      success: false,
      error: error.message,
      userName: userName
    };
  }
}

// Function to close all bots
export async function closeAllBots() {
  // Prevent multiple simultaneous close operations
  if (isClosing) {
    console.log('Close operation already in progress...');
    return {
      success: false,
      message: 'Close operation already in progress',
      closedCount: 0
    };
  }
  
  isClosing = true;
  const botCount = activeBrowsers.length;
  
  if (botCount === 0) {
    isClosing = false;
    return {
      success: true,
      message: 'No bots to close',
      closedCount: 0
    };
  }
  
  console.log(`Closing ${botCount} bots...`);
  
  const closedBots = [];
  
  // Close all browsers in parallel with timeout
  const closePromises = activeBrowsers.map(async (browserInstance) => {
    try {
      if (browserInstance.browser && !browserInstance.browser.isConnected()) {
        console.log(`Browser for ${browserInstance.userName} already closed`);
        return browserInstance.userName;
      }
      
      // Add timeout to browser close operation (increased to 10 seconds)
      const closePromise = browserInstance.browser.close();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Close timeout')), 10000)
      );
      
      await Promise.race([closePromise, timeoutPromise]);
      console.log(`Closed browser for ${browserInstance.userName}`);
      return browserInstance.userName;
    } catch (err) {
      console.error(`Error closing browser for ${browserInstance.userName}:`, err.message);
      // Force close if timeout or error
      try {
        if (browserInstance.browser && browserInstance.browser.isConnected()) {
          console.log(`Force closing browser for ${browserInstance.userName}...`);
          await browserInstance.browser.close();
          console.log(`Force closed browser for ${browserInstance.userName}`);
        }
      } catch (forceErr) {
        console.error(`Force close failed for ${browserInstance.userName}:`, forceErr.message);
        // Kill process if browser is stuck
        try {
          if (browserInstance.browser && browserInstance.browser.process()) {
            browserInstance.browser.process().kill('SIGKILL');
            console.log(`Killed browser process for ${browserInstance.userName}`);
          }
        } catch (killErr) {
          console.error(`Failed to kill process for ${browserInstance.userName}:`, killErr.message);
        }
      }
      return browserInstance.userName;
    }
  });
  
  // Wait for all browsers to close with overall timeout
  try {
    const results = await Promise.allSettled(closePromises);
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        closedBots.push(result.value);
      } else {
        console.error('Browser close failed:', result.reason);
        // Still count as closed since we tried
        if (result.reason && result.reason.message && result.reason.message.includes('timeout')) {
          closedBots.push('timeout_closed');
        }
      }
    });
  } catch (err) {
    console.error('Error in parallel close:', err.message);
  }
  
  // Clear arrays immediately
  activeBrowsers = [];
  activePages = [];
  
  isClosing = false;
  
  const successCount = closedBots.filter(name => name !== 'timeout_closed').length;
  const timeoutCount = closedBots.filter(name => name === 'timeout_closed').length;
  
  let message = `Closed ${successCount} bots successfully`;
  if (timeoutCount > 0) {
    message += `, ${timeoutCount} bots force closed due to timeout`;
  }
  
  return {
    success: true,
    message: message,
    closedCount: closedBots.length,
    successCount: successCount,
    timeoutCount: timeoutCount
  };
}

// Function to leave all meetings
export async function leaveAllMeetings() {
  console.log(`Leaving meetings for ${activePages.length} bots...`);
  
  for (const pageInstance of activePages) {
    try {
      // Wait a bit before trying to leave
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to find and click leave button using the actual HTML structure
      const leaveButton = await pageInstance.page.$('button[aria-label="Leave"]') ||
                         await pageInstance.page.$('button.footer-button__button') ||
                         await pageInstance.page.$('button[class*="footer-button"]') ||
                         await pageInstance.page.$('button[data-testid="leave-meeting-button"]') ||
                         await pageInstance.page.$('button[aria-label*="Leave"]') ||
                         await pageInstance.page.$('button[aria-label*="leave"]') ||
                         await pageInstance.page.$('button:contains("Leave")') ||
                         await pageInstance.page.$('button:contains("End")');
      
      if (leaveButton) {
        console.log(`Found leave button for ${pageInstance.userName}, clicking...`);
        await leaveButton.click();
        
        // Wait for leave confirmation dialog if it appears
        try {
          // Wait for the leave meeting popup container
          await pageInstance.page.waitForSelector('.leave-meeting-options.leave-meeting-options-position', {timeout: 5000});
          // Try the exact button
          const confirmButton = await pageInstance.page.$('.leave-meeting-options__btn--danger');
          if (confirmButton) {
            await confirmButton.click();
            console.log(`Clicked popup Leave Meeting button for ${pageInstance.userName}`);
          } else {
            // Fallback: text search
            await pageInstance.page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('button'));
              const leaveBtn = btns.find(btn => btn.textContent && btn.textContent.trim() === 'Leave Meeting');
              if (leaveBtn) leaveBtn.click();
            });
            console.log(`Clicked popup Leave Meeting button by text for ${pageInstance.userName}`);
          }
        } catch (err) {
          console.log(`No leave meeting popup for ${pageInstance.userName}`);
        }
        
        // Wait for page to navigate away from meeting
        try {
          await pageInstance.page.waitForNavigation({ timeout: 5000 });
          console.log(`Successfully left meeting for ${pageInstance.userName}`);
        } catch (navErr) {
          console.log(`Navigation timeout for ${pageInstance.userName}, but leave button was clicked`);
        }
        
      } else {
        // Try to find leave button by text using evaluate
        const leaveClicked = await pageInstance.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const leaveBtn = buttons.find(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
            const className = btn.className?.toLowerCase() || '';
            
            return text.includes('leave') || 
                   ariaLabel.includes('leave') || 
                   className.includes('footer-button') ||
                   btn.querySelector('.footer-button-base__button-label')?.textContent?.toLowerCase().includes('leave');
          });
          
          if (leaveBtn) {
            console.log('Found leave button, clicking...');
            leaveBtn.click();
            return true;
          }
          return false;
        });
        
        if (leaveClicked) {
          console.log(`Left meeting via text search for ${pageInstance.userName}`);
          
          // Wait for confirmation dialog
          try {
            await pageInstance.page.waitForSelector('button[data-testid="leave-meeting-confirm"]', { timeout: 3000 });
            await pageInstance.page.evaluate(() => {
              const confirmBtn = document.querySelector('button[data-testid="leave-meeting-confirm"]');
              if (confirmBtn) confirmBtn.click();
            });
          } catch (confirmErr) {
            // No confirmation needed
          }
        } else {
          console.log(`No leave button found for ${pageInstance.userName}`);
          
          // Try alternative method - close browser directly
          console.log(`Closing browser directly for ${pageInstance.userName} to force leave`);
          try {
            await pageInstance.page.close();
            console.log(`Closed page for ${pageInstance.userName}`);
          } catch (closeErr) {
            console.error(`Error closing page for ${pageInstance.userName}:`, closeErr.message);
          }
        }
      }
      
      // Additional wait to ensure proper exit
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (err) {
      console.error(`Error leaving meeting for ${pageInstance.userName}:`, err.message);
      
      // Fallback: close the page directly
      try {
        await pageInstance.page.close();
        console.log(`Fallback: Closed page for ${pageInstance.userName}`);
      } catch (closeErr) {
        console.error(`Fallback close failed for ${pageInstance.userName}:`, closeErr.message);
      }
    }
  }
  
  return {
    success: true,
    message: `Attempted to leave meetings for ${activePages.length} bots`,
    botCount: activePages.length
  };
}

// Function to get current bot status
export function getBotStatus() {
  return {
    activeBots: activeBrowsers.length,
    botNames: activeBrowsers.map(b => b.userName)
  };
} 