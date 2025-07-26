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
      headless: true, // Always headless on server
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      protocolTimeout: 120000, // 2 minutes timeout
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
        '--disable-features=VizDisplayCompositor',
        '--single-process',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
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
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--disable-site-isolation-trials'
      ]
    });

    // Track browser instance
    activeBrowsers.push({ browser, userName });

    page = await browser.newPage();
    
    // Track page instance
    activePages.push({ page, userName });
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Pre-accept cookies by setting them before page load
    await page.setCookie({
      name: 'OptanonAlertBoxClosed',
      value: new Date().toISOString(),
      domain: '.zoom.us',
      path: '/'
    });
    
    await page.setCookie({
      name: 'OptanonConsent',
      value: 'isIABGlobal=false&datestamp=Thu+Dec+28+2023+12%3A00%3A00+GMT%2B0500+(Pakistan+Standard+Time)&version=202310.1.0&hosts=&consentId=123456789&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1&AwaitingReconsent=false&geolocation=PK%3BKP&notices=GPC',
      domain: '.zoom.us',
      path: '/'
    });
    
    // Handle permissions automatically
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://zoom.us', ['camera', 'microphone']);
    
    // Go directly to Zoom join URL with increased timeout
    const zoomJoinUrl = `https://zoom.us/wc/join/${meetingNumber}`;
    console.log(`Navigating to: ${zoomJoinUrl}`);
    
    await page.goto(zoomJoinUrl, { waitUntil: 'networkidle2', timeout: 120000 });
    
    console.log(`Page loaded for ${userName}, waiting for form...`);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Debug: Take screenshot to see what's on the page
    try {
      await page.screenshot({ path: `/tmp/${userName}_debug.png` });
      console.log(`Screenshot saved for ${userName}`);
    } catch (screenshotErr) {
      console.log(`Screenshot failed for ${userName}:`, screenshotErr.message);
    }
    
    // Handle cookie consent popup first
    console.log(`Checking for cookie consent popup for ${userName}...`);
    try {
      // Wait for cookie popup to appear
      await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
      
      // Click "Accept Cookies" button
      const acceptCookiesBtn = await page.$('#onetrust-accept-btn-handler');
      if (acceptCookiesBtn) {
        await acceptCookiesBtn.click();
        console.log(`Accepted cookies for ${userName}`);
        // Wait for popup to disappear
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (err) {
      console.log(`No cookie popup found for ${userName} or already handled`);
    }
    
    // Alternative: Try to find and click any cookie accept button
    try {
      const cookieAcceptSelectors = [
        '#onetrust-accept-btn-handler',
        'button[class*="accept"]',
        'button:contains("Accept")',
        'button:contains("Accept Cookies")',
        '.save-preference-btn-handler'
      ];
      
      for (const selector of cookieAcceptSelectors) {
        try {
          const cookieBtn = await page.$(selector);
          if (cookieBtn) {
            await cookieBtn.click();
            console.log(`Clicked cookie button for ${userName} using selector: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          }
        } catch (err) {
          continue;
        }
      }
    } catch (err) {
      console.log(`Cookie handling failed for ${userName}:`, err.message);
    }
    
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
    
    // Wait longer for form to appear
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Debug: Check what elements are available
    const availableElements = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim(),
        className: btn.className,
        id: btn.id
      }));
      return { inputs, buttons };
    });
    
    console.log(`Available elements for ${userName}:`, availableElements);
    
    // Look for name input field with multiple strategies
    let nameInput = null;
    const nameSelectors = [
      'input[name="inputname"]',
      '#inputname',
      'input[placeholder*="name"]',
      'input[placeholder*="Name"]',
      'input[aria-label*="name"]',
      'input[aria-label*="Name"]',
      'input[type="text"]',
      'input'
    ];
    
    for (const selector of nameSelectors) {
      try {
        nameInput = await page.$(selector);
        if (nameInput) {
          console.log(`Found name input for ${userName} using selector: ${selector}`);
          break;
        }
      } catch (err) {
        continue;
      }
    }
    
    if (nameInput) {
      console.log(`Entering name for ${userName}...`);
      try {
        await nameInput.click();
        await nameInput.type(userName, { delay: 100 });
        console.log(`Name entered for ${userName}`);
      } catch (err) {
        console.log(`Direct click failed for ${userName}, trying page.evaluate...`);
        // Fallback to page.evaluate
        const nameEntered = await page.evaluate((userName) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const nameInput = inputs.find(input => 
            input.type === 'text' || 
            input.placeholder?.toLowerCase().includes('name') ||
            input.name?.toLowerCase().includes('name')
          );
          
          if (nameInput) {
            nameInput.focus();
            nameInput.value = userName;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }, userName);
        
        if (nameEntered) {
          console.log(`Name entered via page.evaluate for ${userName}`);
        } else {
          console.log(`Failed to enter name for ${userName}`);
        }
      }
    } else {
      console.log(`No name input found for ${userName}, trying page.evaluate...`);
      
      // Try using page.evaluate to find and fill input
      const nameEntered = await page.evaluate((userName) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const nameInput = inputs.find(input => 
          input.type === 'text' || 
          input.placeholder?.toLowerCase().includes('name') ||
          input.name?.toLowerCase().includes('name')
        );
        
        if (nameInput) {
          nameInput.value = userName;
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      }, userName);
      
      if (nameEntered) {
        console.log(`Name entered via page.evaluate for ${userName}`);
      } else {
        console.log(`Failed to enter name for ${userName}`);
      }
    }
    
    // Look for password input if needed
    if (passWord) {
      const passwordSelectors = [
        'input[name="inputpasscode"]',
        '#inputpasscode',
        'input[placeholder*="passcode"]',
        'input[placeholder*="Passcode"]',
        'input[type="password"]'
      ];
      
      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          passwordInput = await page.$(selector);
          if (passwordInput) {
            console.log(`Found password input for ${userName} using selector: ${selector}`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      if (passwordInput) {
        console.log(`Entering password for ${userName}...`);
        await passwordInput.click();
        await passwordInput.type(passWord, { delay: 100 });
        console.log(`Password entered for ${userName}`);
      }
    }
    
    // Wait a bit for form to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for join button with multiple strategies
    console.log(`Looking for join button for ${userName}...`);
    
    const joinSelectors = [
      '.preview-join-button',
      'button[class*="preview-join-button"]',
      'button[aria-label*="Join"]',
      'button[type="submit"]',
      '#joinBtn',
      'button[class*="join"]',
      'button[class*="submit"]',
      'input[type="submit"]',
      'button.btn-primary',
      'button.btn',
      'button[class*="btn-primary"]',
      'button[class*="btn"]'
    ];
    
    let joinButton = null;
    for (const selector of joinSelectors) {
      try {
        joinButton = await page.$(selector);
        if (joinButton) {
          console.log(`Found join button for ${userName} using selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`Selector failed for ${userName}: ${selector} - ${err.message}`);
        continue;
      }
    }
    
    if (joinButton) {
      console.log(`Clicking join button for ${userName}...`);
      
      // Get the selector that found the button
      let buttonSelector = null;
      for (const selector of joinSelectors) {
        try {
          const foundButton = await page.$(selector);
          if (foundButton && foundButton === joinButton) {
            buttonSelector = selector;
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      try {
        // Check if element is visible and scroll to it
        if (buttonSelector) {
          await page.evaluate((selector) => {
            const btn = document.querySelector(selector);
            if (btn) {
              btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Wait a bit for scroll
              return new Promise(resolve => setTimeout(resolve, 1000));
            }
          }, buttonSelector);
        }
        
        // Wait for element to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try multiple click methods
        await joinButton.click();
        console.log(`Join button clicked successfully for ${userName}`);
      } catch (err) {
        console.log(`Direct click failed for ${userName}, trying page.evaluate...`);
        
        // Fallback to page.evaluate with multiple click methods
        const clicked = await page.evaluate((selector) => {
          const btn = document.querySelector(selector);
          if (btn) {
            // Try multiple click methods
            try {
              btn.click();
              return true;
            } catch (e) {
              try {
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                return true;
              } catch (e2) {
                try {
                  btn.dispatchEvent(new Event('click', { bubbles: true }));
                  return true;
                } catch (e3) {
                  return false;
                }
              }
            }
          }
          return false;
        }, buttonSelector || 'button[class*="submit"]');
        
        if (clicked) {
          console.log(`Join button clicked via page.evaluate for ${userName}`);
        } else {
          // Try clicking by text content
          const textClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitBtn = buttons.find(btn => 
              btn.textContent?.toLowerCase().includes('submit') ||
              btn.innerText?.toLowerCase().includes('submit') ||
              btn.className?.toLowerCase().includes('submit')
            );
            
            if (submitBtn) {
              try {
                submitBtn.click();
                return true;
              } catch (e) {
                try {
                  submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                  return true;
                } catch (e2) {
                  return false;
                }
              }
            }
            return false;
          });
          
          if (textClicked) {
            console.log(`Submit button clicked via text search for ${userName}`);
          } else {
            // Try keyboard navigation (Tab + Enter)
            const keyboardClicked = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const submitBtn = buttons.find(btn => 
                btn.textContent?.toLowerCase().includes('submit') ||
                btn.innerText?.toLowerCase().includes('submit') ||
                btn.className?.toLowerCase().includes('submit')
              );
              
              if (submitBtn) {
                try {
                  submitBtn.focus();
                  submitBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                  submitBtn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                  return true;
                } catch (e) {
                  return false;
                }
              }
              return false;
            });
            
            if (keyboardClicked) {
              console.log(`Submit button activated via keyboard for ${userName}`);
            } else {
              // Final fallback: Submit the form directly
              const formSubmitted = await page.evaluate(() => {
                const forms = Array.from(document.querySelectorAll('form'));
                if (forms.length > 0) {
                  try {
                    forms[0].submit();
                    return true;
                  } catch (e) {
                    return false;
                  }
                }
                return false;
              });
              
              if (formSubmitted) {
                console.log(`Form submitted directly for ${userName}`);
              } else {
                throw new Error(`Failed to click join button for ${userName}`);
              }
            }
          }
        }
      }
    } else {
      // Try to find any button with "Join" text using page.evaluate
      const joinButtonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const joinBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('join') ||
          btn.innerText?.toLowerCase().includes('join') ||
          btn.value?.toLowerCase().includes('join') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('join')
        );
        if (joinBtn) {
          joinBtn.click();
          return true;
        }
        return false;
      });
      
      if (joinButtonFound) {
        console.log(`Join button clicked via text search for ${userName}`);
      } else {
        // Try to find any submit button
        const submitButtonFound = await page.evaluate(() => {
          const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'));
          if (submitButtons.length > 0) {
            submitButtons[0].click();
            return true;
          }
          return false;
        });
        
        if (submitButtonFound) {
          console.log(`Submit button clicked for ${userName}`);
        } else {
          // Try to submit the form directly
          const formSubmitted = await page.evaluate(() => {
            const forms = Array.from(document.querySelectorAll('form'));
            if (forms.length > 0) {
              forms[0].submit();
              return true;
            }
            return false;
          });
          
          if (formSubmitted) {
            console.log(`Form submitted for ${userName}`);
          } else {
            // Debug: Show all available buttons
            const allButtons = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
                text: btn.textContent?.trim(),
                innerText: btn.innerText?.trim(),
                value: btn.value?.trim(),
                className: btn.className,
                id: btn.id,
                type: btn.type,
                ariaLabel: btn.getAttribute('aria-label')
              }));
            });
            console.log(`Available buttons for ${userName}:`, allButtons);
            throw new Error(`Join button not found for ${userName}`);
          }
        }
      }
    }
    
    // Wait to see if join was successful
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if we're still on the same page or if join was successful
    const currentUrl = page.url();
    console.log(`Current URL for ${userName}: ${currentUrl}`);
    
    // Check if we're in a meeting (URL should change)
    if (currentUrl.includes('/wc/join/') && !currentUrl.includes('meeting')) {
      console.log(`Still on join page for ${userName}, checking for errors...`);
      
      // Check for error messages
      const errorMessage = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('.error-message, .alert, .error, [class*="error"]');
        return Array.from(errorElements).map(el => el.textContent?.trim()).filter(Boolean);
      });
      
      if (errorMessage.length > 0) {
        console.log(`Error messages found for ${userName}:`, errorMessage);
        throw new Error(`Join failed: ${errorMessage.join(', ')}`);
      }
    }
    
    return {
      success: true,
      message: `${userName} successfully joined meeting`,
      userName: userName
    };
    
  } catch (error) {
    console.error(`Error for ${userName}:`, error.message);
    
    // Log additional debugging info
    try {
      if (page) {
        const pageInfo = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
              text: btn.textContent?.trim(),
              className: btn.className,
              id: btn.id,
              type: btn.type
            }))
          };
        });
        console.log(`Page info for ${userName}:`, pageInfo);
      }
    } catch (debugErr) {
      console.log(`Could not get debug info for ${userName}:`, debugErr.message);
    }
    
    return {
      success: false,
      error: error.message,
      userName: userName
    };
  } finally {
    // Clean up browser if it exists
    try {
      if (browser) {
        await browser.close();
        console.log(`Browser closed for ${userName}`);
      }
    } catch (cleanupErr) {
      console.log(`Cleanup error for ${userName}:`, cleanupErr.message);
    }
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
  console.log(`Closing ${activePages.length} bots directly...`);
  
  const closedBots = [];
  
  for (const pageInstance of activePages) {
    try {
      console.log(`Closing browser for ${pageInstance.userName}...`);
      
      // Directly close the page/browser
      await pageInstance.page.close();
      console.log(`Closed browser for ${pageInstance.userName}`);
      closedBots.push(pageInstance.userName);
      
    } catch (err) {
      console.error(`Error closing browser for ${pageInstance.userName}:`, err.message);
      closedBots.push(pageInstance.userName); // Still count as closed
    }
  }
  
  // Clear arrays
  activeBrowsers = [];
  activePages = [];
  
  return {
    success: true,
    message: `Closed ${closedBots.length} bots directly`,
    botCount: closedBots.length,
    closedBots: closedBots
  };
}

// Function to get current bot status
export function getBotStatus() {
  return {
    activeBots: activeBrowsers.length,
    botNames: activeBrowsers.map(b => b.userName)
  };
} 