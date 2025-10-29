import puppeteer from 'puppeteer-core';

let activeBrowsers = [];
let activePages = [];
let isClosing = false;

function getChromeExecutablePath() {
  if (process.env.CHROME_PATH && process.env.CHROME_PATH.trim()) {
    return process.env.CHROME_PATH.trim();
  }
  const platform = process.platform;
  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (platform === 'win32') {
    return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  }
  // linux default
  return '/usr/bin/google-chrome';
}

// Function to generate real user names
function generateRealName() {
  const firstNames = [
    'Ali', 'Sara', 'Omar', 'Ayesha', 'Zain', 'Fatima', 'Usman', 'Hira', 'Bilal', 'Mina',
    'Hamza', 'Noor', 'Danish', 'Iqra', 'Saad', 'Sana', 'Raza', 'Mariam', 'Tariq', 'Laila',
    'Ahmed', 'Zara', 'Hassan', 'Aisha', 'Yusuf', 'Khadija', 'Ibrahim', 'Maryam', 'Khalid', 'Amina',
    'Abdullah', 'Fatima', 'Muhammad', 'Zainab', 'Yasin', 'Hafsa', 'Mustafa', 'Ayesha', 'Junaid', 'Sadia'
  ];
  
  const lastNames = [
    'Khan', 'Ahmed', 'Ali', 'Hassan', 'Hussain', 'Malik', 'Raza', 'Shah', 'Farooq', 'Iqbal',
    'Saleem', 'Rashid', 'Nadeem', 'Saeed', 'Waqar', 'Tariq', 'Usman', 'Bilal', 'Danish', 'Saad'
  ];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomNumber = Math.floor(Math.random() * 9999) + 1000;
  
  return `${firstName}_${lastName}_${randomNumber}`;
}

export async function joinZoomMeeting(meetingNumber, passWord, userName, keepAliveMinutes = 0) {
  let browser;
  let page;
  try {
    console.log(`Starting Puppeteer for ${userName} to join meeting: ${meetingNumber}`);

    // Launch options for local development
    const launchOptions = {
      headless: true, // Run in background for better performance
      executablePath: getChromeExecutablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-images',
        '--mute-audio',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-video-capture',
        '--disable-video',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    };

    console.log(`Launch options:`, {
      headless: launchOptions.headless,
      argsCount: launchOptions.args.length
    });

    browser = await puppeteer.launch(launchOptions);
    console.log(`Browser launched for ${userName}`);

    page = await browser.newPage();
    console.log(`Page created for ${userName}`);

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Handle permissions - deny video and audio
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://zoom.us', []);
    await context.overridePermissions('https://app.zoom.us', []);
    
    // Set permissions to deny video and audio
    await page.evaluateOnNewDocument(() => {
      // Override getUserMedia to deny video and audio
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error('Permission denied');
      };
    });
    
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
        console.log(`Cookie popup accepted for ${userName}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log(`No cookie popup found for ${userName}`);
    }
    
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
      await page.waitForSelector('#input-for-pwd', { timeout: 10000 });
      await page.type('#input-for-pwd', passWord);
      console.log(`Passcode entered for ${userName}`);
    } catch (error) {
      console.log(`Passcode input not found for ${userName}, trying fallback...`);
      try {
        await page.type('input[type="password"]', passWord);
        console.log(`Passcode entered via fallback for ${userName}`);
      } catch (error2) {
        console.log(`Error for ${userName}: Passcode input not found`);
        throw new Error(`Passcode input not found for ${userName}`);
      }
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
      
      // Add to active browsers/pages
      activeBrowsers.push(browser);
      // attach for status reporting
      try { page.userName = userName; } catch {}
      activePages.push(page);

      // optional auto-leave after keepAliveMinutes
      if (keepAliveMinutes && keepAliveMinutes > 0) {
        const ms = keepAliveMinutes * 60 * 1000;
        setTimeout(async () => {
          try {
            console.log(`⏰ ${userName} leaving meeting after ${keepAliveMinutes} minutes`);
            try { await page.close(); } catch {}
            try { await browser.close(); } catch {}
          } finally {
            // cleanup from active lists
            activePages = activePages.filter(p => p !== page);
            activeBrowsers = activeBrowsers.filter(b => b !== browser);
          }
        }, ms).unref?.();
      }
      
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
    throw error;
  } finally {
    if (!activeBrowsers.includes(browser)) {
      try {
        if (page) await page.close();
        if (browser) await browser.close();
        console.log(`Browser closed for ${userName} due to error`);
      } catch (closeError) {
        console.log(`Error closing browser for ${userName}: ${closeError.message}`);
      }
    }
  }
}

export async function closeAllBots() {
  if (isClosing) {
    return 0;
  }
  
  isClosing = true;
  console.log('Closing all bots...');
  
  try {
    const closePromises = activeBrowsers.map(async (browser, index) => {
      try {
        await browser.close();
        console.log(`Closed browser ${index + 1}`);
        return true;
      } catch (error) {
        console.log(`Error closing browser ${index + 1}: ${error.message}`);
        return false;
      }
    });
    
    const results = await Promise.allSettled(closePromises);
    const closedCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    activeBrowsers = [];
    activePages = [];
    isClosing = false;
    
    console.log(`Successfully closed ${closedCount} bots`);
    return closedCount;
  } catch (error) {
    isClosing = false;
    console.error('Error in closeAllBots:', error);
    throw error;
  }
}

export async function leaveAllMeetings() {
  console.log('Leaving all meetings...');
  
  try {
    const leavePromises = activePages.map(async (page, index) => {
      try {
        await page.close();
        console.log(`Left meeting ${index + 1}`);
        return true;
      } catch (error) {
        console.log(`Error leaving meeting ${index + 1}: ${error.message}`);
        return false;
      }
    });
    
    const results = await Promise.allSettled(leavePromises);
    const leftCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    activePages = [];
    
    console.log(`Successfully left ${leftCount} meetings`);
    return leftCount;
  } catch (error) {
    console.error('Error in leaveAllMeetings:', error);
    throw error;
  }
}

export function getBotStatus() {
  return {
    activeBots: activeBrowsers.length,
    botNames: activePages.map(page => page.userName || 'Unknown'),
    isClosing: isClosing
  };
} 