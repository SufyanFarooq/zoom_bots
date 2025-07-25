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
      headless: process.env.NODE_ENV === 'production' ? true : false,
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
        '--disable-ipc-flooding-protection'
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
    
    // Handle camera/microphone permissions if they appear
    try {
      await page.waitForSelector('button[data-testid="preview-audio-control-button"]', { timeout: 5000 });
      console.log(`Found audio/video controls for ${userName}, handling permissions...`);
      
      // Click mute button to turn off microphone
      const muteButton = await page.$('button[data-testid="preview-audio-control-button"]');
      if (muteButton) {
        await muteButton.click();
        console.log(`Muted microphone for ${userName}`);
      }
      
      // Click stop video button to turn off camera
      const videoButton = await page.$('button[data-testid="preview-video-control-button"]');
      if (videoButton) {
        await videoButton.click();
        console.log(`Stopped video for ${userName}`);
      }
    } catch (err) {
      console.log(`No audio/video controls found for ${userName}, continuing...`);
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
  
  for (const browserInstance of activeBrowsers) {
    try {
      if (browserInstance.browser && !browserInstance.browser.isConnected()) {
        console.log(`Browser for ${browserInstance.userName} already closed`);
        closedBots.push(browserInstance.userName);
        continue;
      }
      
      await browserInstance.browser.close();
      console.log(`Closed browser for ${browserInstance.userName}`);
      closedBots.push(browserInstance.userName);
    } catch (err) {
      console.error(`Error closing browser for ${browserInstance.userName}:`, err.message);
      // Still count as closed if there was an error
      closedBots.push(browserInstance.userName);
    }
  }
  
  // Clear arrays
  activeBrowsers = [];
  activePages = [];
  
  isClosing = false;
  
  return {
    success: true,
    message: `Closed ${closedBots.length} bots: ${closedBots.join(', ')}`,
    closedCount: closedBots.length
  };
}

// Function to leave all meetings
export async function leaveAllMeetings() {
  console.log(`Leaving meetings for ${activePages.length} bots...`);
  
  for (const pageInstance of activePages) {
    try {
      // Try to find and click leave button
      const leaveButton = await pageInstance.page.$('button[data-testid="leave-meeting-button"]') ||
                         await pageInstance.page.$('button[aria-label*="Leave"]') ||
                         await pageInstance.page.$('button[aria-label*="leave"]') ||
                         await pageInstance.page.$('button:contains("Leave")') ||
                         await pageInstance.page.$('button:contains("End")');
      
      if (leaveButton) {
        await leaveButton.click();
        console.log(`Left meeting for ${pageInstance.userName}`);
      } else {
        // Try to find leave button by text
        const leaveClicked = await pageInstance.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const leaveBtn = buttons.find(btn => 
            btn.textContent?.toLowerCase().includes('leave') || 
            btn.textContent?.toLowerCase().includes('end')
          );
          if (leaveBtn) {
            leaveBtn.click();
            return true;
          }
          return false;
        });
        
        if (leaveClicked) {
          console.log(`Left meeting via text search for ${pageInstance.userName}`);
        } else {
          console.log(`No leave button found for ${pageInstance.userName}`);
        }
      }
    } catch (err) {
      console.error(`Error leaving meeting for ${pageInstance.userName}:`, err.message);
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